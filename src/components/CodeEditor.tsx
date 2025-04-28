import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeQuestion } from '@/contexts/AssessmentContext';
import { Terminal, Play, Check, Loader2 } from 'lucide-react';
import { createSubmission, waitForSubmissionResult } from '@/services/judge0Service';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { QuestionSubmission, TestCase, TestResult, Json } from '@/types/database';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  question: CodeQuestion;
  onCodeChange: (language: string, code: string) => void;
  onMarksUpdate?: (questionId: string, marks: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ question, onCodeChange, onMarksUpdate }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    Object.keys(question.solutionTemplate || {})[0] || 'python'
  );
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const currentCode =
    question.userSolution?.[selectedLanguage] ??
    question.solutionTemplate?.[selectedLanguage] ??
    '';

  useEffect(() => {
    if (currentCode && !question.userSolution?.[selectedLanguage]) {
      onCodeChange(selectedLanguage, currentCode);
    }
  }, [selectedLanguage, question.solutionTemplate]);

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      onCodeChange(selectedLanguage, value);
    }
  };

  const handleRunCode = async () => {
    if (!currentCode.trim()) {
      toast({
        title: "Error",
        description: "Please write some code before running.",
        variant: "destructive",
      });
      return;
    }
    
    setIsRunning(true);
    setOutput('Running code on visible test cases...\n');
    
    try {
      const { data: testCases, error: testCasesError } = await supabase
        .from('test_cases')
        .select('*')
        .eq('coding_question_id', question.id)
        .eq('is_hidden', false)
        .order('order_index', { ascending: true });
        
      if (testCasesError) {
        throw new Error(`Failed to load test cases: ${testCasesError.message}`);
      }
      
      if (!testCases || testCases.length === 0) {
        throw new Error('No visible test cases found for this question');
      }
      
      let passedCount = 0;
      let totalTestCases = testCases.length;
      
      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        setOutput(prev => `${prev}\nRunning test case ${i + 1}/${totalTestCases}...\n`);
        
        const token = await createSubmission(currentCode, selectedLanguage, testCase.input);
        const result = await waitForSubmissionResult(token);
        
        if (result.status.id >= 6) {
          const errorOutput = result.compile_output || result.stderr || 'An error occurred while running your code';
          const plainTextError = errorOutput.replace(/<[^>]*>/g, '');
          setOutput(prev => `${prev}\nError in test case ${i + 1}: ${plainTextError}\n`);
          continue;
        }
        
        const actualOutput = result.stdout?.trim() || '';
        const expectedOutput = testCase.output.trim().replace(/\r\n/g, '\n');
        const passed = actualOutput === expectedOutput;
        
        if (passed) {
          passedCount++;
        }
        
        setOutput(prev => `${prev}Test case ${i + 1}/${totalTestCases}: ${passed ? 'Passed' : 'Failed'}\n`);
        if (!passed) {
          setOutput(prev => `${prev}Expected Output: "${expectedOutput}"\nYour Output: "${actualOutput}"\n`);
        }
      }
      
      setOutput(prev => `${prev}\n${passedCount}/${totalTestCases} test cases passed\n`);
      
      toast({
        title: passedCount === totalTestCases ? "Success!" : "Test Cases Completed",
        description: `${passedCount}/${totalTestCases} test cases passed.`,
        variant: passedCount === totalTestCases ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error running code:', error);
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      
      toast({
        title: "Error",
        description: "Failed to run code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const fetchTestCases = async (questionId: string): Promise<TestCase[]> => {
    try {
      const { data: testCases, error } = await supabase
        .from('test_cases')
        .select('*')
        .eq('coding_question_id', questionId)
        .order('order_index', { ascending: true });
        
      if (error) {
        throw error;
      }
      
      return testCases || [];
    } catch (error) {
      console.error('Error fetching test cases:', error);
      return [];
    }
  };

  const processTestCase = async (
    index: number, 
    testCases: TestCase[], 
    allResults: TestResult[] = [], 
    totalMarks: number = 0
  ): Promise<{results: TestResult[], totalMarksEarned: number}> => {
    if (index >= testCases.length) {
      return { results: allResults, totalMarksEarned: totalMarks };
    }
    
    try {
      const testCase = testCases[index];
      const isHidden = testCase.is_hidden;
      const testMarks = testCase.marks || 0;
      
      setOutput(prev => `${prev}\n\nProcessing test case ${index + 1}/${testCases.length}...\n`);
      
      const token = await createSubmission(currentCode, selectedLanguage, testCase.input);
      
      const result = await waitForSubmissionResult(token);
      
      if (result.status.id >= 6) {
        const errorOutput = result.compile_output || result.stderr || 'An error occurred while running your code';
        const plainTextError = errorOutput.replace(/<[^>]*>/g, '');
        setOutput(prev => `${prev}\nError in test case ${index + 1}: ${plainTextError}`);
        
        const newResult: TestResult = { 
          passed: false, 
          actual_output: `Error: ${plainTextError}`,
          marks: 0,
          is_hidden: isHidden
        };
        const updatedResults = [...allResults, newResult];
        setTestResults(updatedResults);
        
        if (!isHidden) {
          setOutput(prev => `${prev}\n\nTest case ${index + 1}/${testCases.length}: Failed (Error)\n`);
        } else {
          setOutput(prev => `${prev}\n\nHidden test case ${index + 1}/${testCases.length}: Failed (Error)\n`);
        }
        
        return processTestCase(index + 1, testCases, updatedResults, totalMarks);
      }
      
      const actualOutput = result.stdout?.trim() || '';
      const expectedOutput = testCase.output.trim().replace(/\r\n/g, '\n');
      const passed = actualOutput === expectedOutput;
      
      const marksEarned = passed ? testMarks : 0;
      const updatedTotalMarks = totalMarks + marksEarned;
      
      const newResult: TestResult = { 
        passed, 
        actual_output: actualOutput,
        marks: marksEarned,
        is_hidden: isHidden
      };
      const updatedResults = [...allResults, newResult];
      setTestResults(updatedResults);
      
      if (!isHidden) {
        const testResultOutput = `Test case ${index + 1}/${testCases.length} (${testMarks} marks): ${passed ? 'Passed' : 'Failed'}\n` + 
          (!passed ? `Expected Output: "${expectedOutput}"\nYour Output: "${actualOutput}"\n` : '');
        setOutput(prev => `${prev}\n${testResultOutput}`);
      } else {
        setOutput(prev => `${prev}\nHidden test case ${index + 1}/${testCases.length} (${testMarks} marks): ${passed ? 'Passed' : 'Failed'}\n`);
      }
      
      return processTestCase(index + 1, testCases, updatedResults, updatedTotalMarks);
    } catch (error) {
      console.error(`Error processing test case ${index + 1}:`, error);
      setOutput(prev => `${prev}\nError processing test case ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      
      const newResult: TestResult = { 
        passed: false, 
        actual_output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        marks: 0,
        is_hidden: testCases[index]?.is_hidden
      };
      const updatedResults = [...allResults, newResult];
      setTestResults(updatedResults);
      
      return processTestCase(index + 1, testCases, updatedResults, totalMarks);
    }
  };

  const handleSubmitCode = async () => {
    if (!currentCode.trim()) {
      toast({
        title: "Error",
        description: "Please write some code before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    setOutput('Submitting solution...\n');
    setTestResults([]);
    
    try {
      const testCases = await fetchTestCases(question.id);
      console.log('Fetched test cases:', testCases);
      
      if (testCases.length === 0) {
        throw new Error('No test cases found for this question');
      }
      
      const { results: finalResults, totalMarksEarned } = await processTestCase(0, testCases);
      const allPassed = finalResults.every(r => r.passed);
      const totalPossibleMarks = testCases.reduce((sum, tc) => sum + (tc.marks || 0), 0);
      const correctPercentage = totalPossibleMarks > 0 ? (totalMarksEarned / totalPossibleMarks) * 100 : 0;
      
      if (onMarksUpdate) {
        onMarksUpdate(question.id, totalMarksEarned);
      }
      
      if (user) {
        try {
          const { data: submissions, error: submissionsError } = await supabase
            .from('submissions')
            .select('*')
            .eq('assessment_id', question.assessmentId || '')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (submissionsError) {
            console.error('Error finding submissions:', submissionsError);
            throw submissionsError;
          }

          let submissionId: string;

          if (!submissions || submissions.length === 0) {
            const { data: newSubmission, error: newSubmissionError } = await supabase
              .from('submissions')
              .insert({
                assessment_id: question.assessmentId || '',
                user_id: user.id,
                started_at: new Date().toISOString()
              })
              .select()
              .single();

            if (newSubmissionError) {
              console.error('Error creating submission:', newSubmissionError);
              throw newSubmissionError;
            }

            submissionId = newSubmission.id;
          } else {
            submissionId = submissions[0].id;
          }

          const { data: existingSubmission, error: existingSubmissionError } = await supabase
            .from('question_submissions')
            .select('*')
            .eq('submission_id', submissionId)
            .eq('question_type', 'code')
            .eq('question_id', question.id);

          if (existingSubmissionError) {
            console.error('Error checking existing submission:', existingSubmissionError);
            throw existingSubmissionError;
          }

          const jsonTestResults: Json = finalResults.map(result => ({
            passed: result.passed,
            actual_output: result.actual_output || null,
            marks: result.marks || 0,
            is_hidden: result.is_hidden || false
          }));

          const questionSubmissionData = {
            submission_id: submissionId,
            question_id: question.id,
            question_type: 'code',
            code_solution: currentCode,
            language: selectedLanguage,
            is_correct: allPassed,
            marks_obtained: totalMarksEarned,
            test_results: jsonTestResults
          };

          if (existingSubmission && existingSubmission.length > 0) {
            const { error: updateError } = await supabase
              .from('question_submissions')
              .update(questionSubmissionData)
              .eq('id', existingSubmission[0].id);

            if (updateError) {
              console.error('Error updating question submission:', updateError);
              throw updateError;
            }
          } else {
            const { error: insertError } = await supabase
              .from('question_submissions')
              .insert(questionSubmissionData);

            if (insertError) {
              console.error('Error creating question submission:', insertError);
              throw insertError;
            }
          }

          toast({
            title: "Solution Submitted",
            description: `Your solution was submitted successfully! You scored ${totalMarksEarned}/${totalPossibleMarks} marks.`,
            variant: allPassed ? "default" : "destructive",
          });

        } catch (dbError) {
          console.error('Error storing results:', dbError);
          toast({
            title: "Warning",
            description: "Your solution was evaluated but there was an error saving your submission.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Authentication Warning",
          description: "Your solution was evaluated but not saved. You must be logged in to submit solutions.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error submitting code:', error);
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      
      toast({
        title: "Error",
        description: "Failed to submit solution. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(question.solutionTemplate || {}).map((lang) => (
              <SelectItem value={lang} key={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Run
          </Button>
          <Button 
            className="bg-astra-red hover:bg-red-600 text-white"
            size="sm"
            onClick={handleSubmitCode}
            disabled={isRunning || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Submit
          </Button>
        </div>
      </div>

      <Tabs defaultValue="code" className="flex-1 flex flex-col">
        <TabsList className="mb-2">
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
        </TabsList>
        <div className="flex-1 flex">
          <TabsContent value="code" className="flex-1 h-full m-0">
            <Editor
              height="calc(100vh - 280px)"
              language={selectedLanguage}
              value={currentCode}
              onChange={handleCodeChange}
              options={{
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                lineNumbers: 'on',
                theme: 'vs-dark'
              }}
            />
          </TabsContent>
          <TabsContent value="output" className="flex-1 h-full m-0">
            <div className="h-[calc(100vh-280px)] bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm overflow-y-auto">
              <div className="flex items-center mb-2">
                <Terminal className="h-4 w-4 mr-2" />
                <span>Output</span>
              </div>
              <pre className="whitespace-pre-wrap">{output || 'Run your code to see output here'}</pre>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default CodeEditor;
