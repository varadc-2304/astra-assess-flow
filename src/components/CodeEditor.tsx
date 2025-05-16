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
import { TestCase, QuestionSubmission, TestResult, Json } from '@/types/database';
import Editor from '@monaco-editor/react';

export interface CodeEditorProps {
  question: CodeQuestion;
  onCodeChange: (language: string, code: string) => void;
  onMarksUpdate: (questionId: string, marks: number) => void;
  onTestResultsUpdate?: (passedTests: number, totalTests: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ question, onCodeChange, onMarksUpdate, onTestResultsUpdate }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    Object.keys(question.solutionTemplate)[0] || 'python'
  );
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState<boolean>(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [currentCode, setCurrentCode] = useState<string>(
    question.userSolution[selectedLanguage] ||
    question.solutionTemplate[selectedLanguage] ||
    ''
  );

  // Effect to handle language changes when question changes
  useEffect(() => {
    const fetchTemplate = async () => {
      setIsLoadingTemplate(true);
      const availableLanguages = Object.keys(question.solutionTemplate);
      if (availableLanguages.length === 0) return;

      const newLanguage = availableLanguages.includes(selectedLanguage)
        ? selectedLanguage
        : availableLanguages[0];

      setSelectedLanguage(newLanguage);

      try {
        // First check if there's a saved code snippet for this question and language
        if (user && question.assessmentId) {
          const { data: savedCode, error: savedCodeError } = await supabase
            .from('user_code_snippets')
            .select('code')
            .eq('user_id', user.id)
            .eq('assessment_id', question.assessmentId)
            .eq('question_id', question.id)
            .eq('language', newLanguage)
            .maybeSingle();
            
          if (!savedCodeError && savedCode) {
            setCurrentCode(savedCode.code);
            onCodeChange(newLanguage, savedCode.code);
            setIsLoadingTemplate(false);
            return;
          }
        }

        // If no saved code, get the template or use existing solution
        if (question.userSolution[newLanguage]) {
          setCurrentCode(question.userSolution[newLanguage]);
        } else {
          const { data, error } = await supabase
            .from('coding_languages')
            .select('solution_template')
            .eq('coding_question_id', question.id)
            .eq('coding_lang', newLanguage)
            .maybeSingle();

          if (error) {
            console.error('Error fetching solution template:', error);
            toast({
              title: "Error",
              description: "Failed to load code template",
              variant: "destructive",
            });
          } else if (data) {
            setCurrentCode(data.solution_template);
            onCodeChange(newLanguage, data.solution_template);
          }
        }
      } catch (err) {
        console.error('Error in template fetch:', err);
      } finally {
        setIsLoadingTemplate(false);
      }
    };

    fetchTemplate();
  }, [question.id, question.assessmentId, user]);

  const handleLanguageChange = async (language: string) => {
    setSelectedLanguage(language);
    setIsLoadingTemplate(true);

    try {
      // First check if there's a saved code snippet for this question and language
      if (user && question.assessmentId) {
        const { data: savedCode, error: savedCodeError } = await supabase
          .from('user_code_snippets')
          .select('code')
          .eq('user_id', user.id)
          .eq('assessment_id', question.assessmentId)
          .eq('question_id', question.id)
          .eq('language', language)
          .maybeSingle();
          
        if (!savedCodeError && savedCode) {
          setCurrentCode(savedCode.code);
          onCodeChange(language, savedCode.code);
          setIsLoadingTemplate(false);
          return;
        }
      }

      // If no saved code, check if there's a user solution already
      if (question.userSolution[language]) {
        setCurrentCode(question.userSolution[language]);
        setIsLoadingTemplate(false);
        return;
      }

      // If no user solution, get the template
      const { data, error } = await supabase
        .from('coding_languages')
        .select('solution_template')
        .eq('coding_question_id', question.id)
        .eq('coding_lang', language)
        .maybeSingle();

      if (error) {
        console.error('Error fetching solution template:', error);
        toast({
          title: "Error",
          description: "Failed to load code template",
          variant: "destructive",
        });
      } else if (data) {
        setCurrentCode(data.solution_template);
        onCodeChange(language, data.solution_template);
      }
    } catch (err) {
      console.error('Error in template fetch:', err);
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  // Save code snippet when code changes
  const handleCodeChange = async (value: string | undefined) => {
    if (value !== undefined) {
      setCurrentCode(value);
      onCodeChange(selectedLanguage, value);
      
      // Save code to database
      if (user && question.assessmentId) {
        try {
          const { data, error } = await supabase
            .from('user_code_snippets')
            .select('id')
            .eq('user_id', user.id)
            .eq('assessment_id', question.assessmentId)
            .eq('question_id', question.id)
            .eq('language', selectedLanguage);

          if (error) {
            console.error('Error checking existing code snippet:', error);
            return;
          }

          if (data && data.length > 0) {
            // Update existing code snippet
            await supabase
              .from('user_code_snippets')
              .update({
                code: value,
                updated_at: new Date().toISOString()
              })
              .eq('id', data[0].id);
          } else {
            // Insert new code snippet
            await supabase
              .from('user_code_snippets')
              .insert({
                user_id: user.id,
                assessment_id: question.assessmentId,
                question_id: question.id,
                language: selectedLanguage,
                code: value
              });
          }
        } catch (err) {
          console.error('Error saving code snippet:', err);
        }
      }
    }
  };

  const cleanErrorOutput = (errorOutput: string): string => {
    return errorOutput
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes
      .replace(/[\r\n]+/g, '\n')      // Normalize line endings
      .trim();
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
          const errorOutput = cleanErrorOutput(
            result.compile_output || result.stderr || 'An error occurred while running your code'
          );
            
          setOutput(prev => `${prev}\nError in test case ${i + 1}:\n${errorOutput}\n`);
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
      
      // Update test results to parent component
      if (onTestResultsUpdate) {
        onTestResultsUpdate(passedCount, totalTestCases);
      }
      
      toast({
        title: passedCount === totalTestCases ? "Success!" : "Test Cases Completed",
        description: `${passedCount}/${totalTestCases} test cases passed.`,
        variant: passedCount === totalTestCases ? "default" : "destructive",
      });
      
    } catch (error) {
      console.error('Error running code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setOutput(`Error: ${errorMessage}`);
      
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
        const cleanErrorOutput = (result.compile_output || result.stderr || 'An error occurred while running your code')
          .replace(/\x1b\[[0-9;]*m/g, '')  // Remove ANSI color codes
          .replace(/[\r\n]+/g, '\n')       // Normalize line endings
          .trim();
        
        setOutput(prev => `${prev}\nError in test case ${index + 1}: ${cleanErrorOutput}`);
        
        const newResult: TestResult = { 
          passed: false, 
          actualOutput: `Error: ${cleanErrorOutput}`,
          marks: 0,
          isHidden
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
        actualOutput,
        marks: marksEarned,
        isHidden
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setOutput(prev => `${prev}\nError processing test case ${index + 1}: ${errorMessage}\n`);
      
      const newResult: TestResult = { 
        passed: false, 
        actualOutput: `Error: ${errorMessage}`,
        marks: 0,
        isHidden: testCases[index]?.is_hidden
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
      
      // Update test results status
      const passedTests = finalResults.filter(r => r.passed).length;
      if (onTestResultsUpdate) {
        onTestResultsUpdate(passedTests, testCases.length);
      }
      
      if (user) {
        try {
          const { data: submissions, error: submissionError } = await supabase
            .from('submissions')
            .select('*')
            .eq('assessment_id', question.assessmentId || '')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (submissionError) {
            throw submissionError;
          }
          
          let submissionId: string;
          
          if (!submissions || submissions.length === 0) {
            const { data: newSubmission, error: submissionError } = await supabase
              .from('submissions')
              .insert({
                assessment_id: question.assessmentId || '',
                user_id: user.id,
                started_at: new Date().toISOString()
              })
              .select()
              .single();

            if (submissionError || !newSubmission) {
              console.error('Error creating submission:', submissionError);
              throw new Error('No submission result returned');
            }

            submissionId = newSubmission.id;
          } else {
            submissionId = submissions[0].id;
          }

          const { data: existingSubmission, error: existingError } = await supabase
            .from('question_submissions')
            .select('*')
            .eq('submission_id', submissionId)
            .eq('question_id', question.id)
            .eq('question_type', 'code');
            
          if (existingError) {
            throw existingError;
          }

          // Convert test results to a format that matches the Json type
          const testResultsForJson = finalResults.map(result => ({
            passed: result.passed,
            actualOutput: result.actualOutput,
            marks: result.marks,
            isHidden: result.isHidden
          }));

          const questionSubmissionData = {
            submission_id: submissionId,
            question_id: question.id,
            question_type: 'code' as const,
            code_solution: currentCode,
            language: selectedLanguage,
            is_correct: allPassed,
            marks_obtained: totalMarksEarned,
            test_results: testResultsForJson as unknown as Json
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
              console.error('Error storing question submission:', insertError);
              throw insertError;
            }
          }
          
          toast({
            title: "Submission Successful",
            description: `Your solution was evaluated. You scored ${totalMarksEarned}/${totalPossibleMarks} marks.`,
            variant: allPassed ? "default" : "default",
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setOutput(`Error: ${errorMessage}`);
      
      toast({
        title: "Error",
        description: "Failed to submit solution. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const editorOptions = {
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    fontSize: 14,
    wordWrap: 'on' as 'on',
    automaticLayout: true,
    tabSize: 2,
    formatOnPaste: true,
    formatOnType: false,
    autoIndent: 'advanced' as 'advanced',
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    fixedOverflowWidgets: true,
    cursorBlinking: 'smooth' as 'smooth',
    cursorSmoothCaretAnimation: 'off' as 'off',
    cursorStyle: 'line' as 'line',
    mouseWheelZoom: true,
    renderWhitespace: 'selection' as 'selection',
    renderLineHighlight: 'all' as 'all',
    lineNumbers: 'on' as const,
    renderValidationDecorations: 'on' as const,
    lightbulb: { enabled: true }
  };

  const handleEditorDidMount = (editor: any) => {
    setTimeout(() => {
      editor.layout();
    }, 100);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        {isLoadingTemplate && (
          <div className="text-sm text-muted-foreground ml-2 animate-pulse">
            Loading template...
          </div>
        )}

        <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(question.solutionTemplate).map((lang) => (
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
            disabled={isRunning || isSubmitting || isLoadingTemplate}
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
            disabled={isRunning || isSubmitting || isLoadingTemplate}
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
            <div className="h-[calc(100vh-280px)] border border-gray-200 rounded-md overflow-hidden">
              {isLoadingTemplate ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-400">Loading template...</span>
                </div>
              ) : (
                <Editor
                  height="100%"
                  defaultLanguage={selectedLanguage}
                  language={selectedLanguage}
                  defaultValue={currentCode}
                  onChange={handleCodeChange}
                  theme="vs-dark"
                  options={editorOptions}
                  className="monaco-editor"
                  onMount={handleEditorDidMount}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="output" className="flex-1 h-full m-0">
            <div className="h-[calc(100vh-280px)] bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm overflow-y-auto whitespace-pre-wrap">
              <div className="flex items-center mb-2">
                <Terminal className="h-4 w-4 mr-2" />
                <span>Output</span>
              </div>
              <pre className="whitespace-pre-wrap break-words">{output || 'Run your code to see output here'}</pre>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default CodeEditor;
