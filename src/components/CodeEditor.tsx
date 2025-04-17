
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeQuestion } from '@/contexts/AssessmentContext';
import { Terminal, Play, Check, Loader2 } from 'lucide-react';
import { createSubmission, waitForSubmissionResult } from '@/services/judge0Service';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Submission, Answer, TestCase } from '@/types/database';

interface CodeEditorProps {
  question: CodeQuestion;
  onCodeChange: (language: string, code: string) => void;
  onMarksUpdate?: (questionId: string, marks: number) => void;
}

interface TestResult {
  passed: boolean;
  actualOutput?: string;
  marks?: number;
  isHidden?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ question, onCodeChange, onMarksUpdate }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const currentCode = question.userSolution[selectedLanguage] || question.solutionTemplate[selectedLanguage] || '';

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onCodeChange(selectedLanguage, e.target.value);
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
    setOutput('Running code...');
    
    try {
      const input = question.examples[0]?.input || '';
      const token = await createSubmission(currentCode, selectedLanguage, input);
      
      // Wait for the result
      const result = await waitForSubmissionResult(token);
      
      if (result.status.id >= 6) {
        const errorOutput = result.compile_output || result.stderr || 'An error occurred while running your code';
        setOutput(`Error: ${errorOutput}`);
        setIsRunning(false);
        
        toast({
          title: "Error",
          description: "Your code contains errors. Please fix them and try again.",
          variant: "destructive",
        });
        
        return;
      }
      
      let formattedOutput = `Running test case...\n`;
      const actualOutput = result.stdout?.trim() || '';
      const example = question.examples[0];
      const expectedOutput = example.output.trim().replace(/\r\n/g, '\n');
      const passed = actualOutput === expectedOutput;
      
      formattedOutput += `Input: ${example.input}\n`;
      formattedOutput += `Expected Output: ${expectedOutput}\n`;
      formattedOutput += `Your Output: ${actualOutput}\n`;
      formattedOutput += `Result: ${passed ? 'Passed' : 'Failed'}\n`;
      
      setOutput(formattedOutput);
      setIsRunning(false);
      
      toast({
        title: passed ? "Success!" : "Test Case Failed",
        description: passed 
          ? "Your code produced the expected output!" 
          : "Your code's output doesn't match the expected output.",
        variant: passed ? "default" : "destructive",
      });
      
    } catch (error) {
      console.error('Error running code:', error);
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      setIsRunning(false);
      
      toast({
        title: "Error",
        description: "Failed to run code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchTestCases = async (questionId: string): Promise<TestCase[]> => {
    try {
      const { data: testCases, error } = await supabase
        .from('test_cases')
        .select('*')
        .eq('question_id', questionId)
        .order('order_index', { ascending: true });
        
      if (error) {
        throw error;
      }
      
      // Ensure the returned data matches the TestCase interface
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
      
      // Create submission for current test case
      const token = await createSubmission(currentCode, selectedLanguage, testCase.input);
      
      // Wait for the result of this specific test case
      const result = await waitForSubmissionResult(token);
      
      if (result.status.id >= 6) {
        const errorOutput = result.compile_output || result.stderr || 'An error occurred while running your code';
        setOutput(prev => `${prev}\nError in test case ${index + 1}: ${errorOutput}`);
        
        // Add failed result with error
        const newResult: TestResult = { 
          passed: false, 
          actualOutput: `Error: ${errorOutput}`,
          marks: 0,
          isHidden
        };
        const updatedResults = [...allResults, newResult];
        setTestResults(updatedResults);
        
        // Display results summary
        if (!isHidden) {
          setOutput(prev => `${prev}\n\nTest case ${index + 1}/${testCases.length}: Failed (Error)\n`);
        } else {
          setOutput(prev => `${prev}\n\nHidden test case ${index + 1}/${testCases.length}: Failed (Error)\n`);
        }
        
        // Process the next test case without adding any marks
        return processTestCase(index + 1, testCases, updatedResults, totalMarks);
      }
      
      const actualOutput = result.stdout?.trim() || '';
      const expectedOutput = testCase.output.trim().replace(/\r\n/g, '\n');
      const passed = actualOutput === expectedOutput;
      
      // Calculate marks for this test case
      const marksEarned = passed ? testMarks : 0;
      const updatedTotalMarks = totalMarks + marksEarned;
      
      // Add this result to our results array
      const newResult: TestResult = { 
        passed, 
        actualOutput,
        marks: marksEarned,
        isHidden
      };
      const updatedResults = [...allResults, newResult];
      setTestResults(updatedResults);
      
      // Display result for this test case
      if (!isHidden) {
        const testResultOutput = `Test case ${index + 1}/${testCases.length} (${testMarks} marks): ${passed ? 'Passed' : 'Failed'}\n` + 
          (!passed ? `Expected Output: "${expectedOutput}"\nYour Output: "${actualOutput}"\n` : '');
        setOutput(prev => `${prev}\n${testResultOutput}`);
      } else {
        setOutput(prev => `${prev}\nHidden test case ${index + 1}/${testCases.length} (${testMarks} marks): ${passed ? 'Passed' : 'Failed'}\n`);
      }
      
      // Process the next test case after this one completes
      return processTestCase(index + 1, testCases, updatedResults, updatedTotalMarks);
    } catch (error) {
      console.error(`Error processing test case ${index + 1}:`, error);
      setOutput(prev => `${prev}\nError processing test case ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      
      // Add failed result for this test case
      const newResult: TestResult = { 
        passed: false, 
        actualOutput: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      // Fetch test cases with marks information
      const testCases = await fetchTestCases(question.id);
      console.log('Fetched test cases:', testCases);
      
      if (testCases.length === 0) {
        throw new Error('No test cases found for this question');
      }
      
      // Process all test cases sequentially and collect marks
      const { results: finalResults, totalMarksEarned } = await processTestCase(0, testCases);
      const allPassed = finalResults.every(r => r.passed);
      const totalPossibleMarks = testCases.reduce((sum, tc) => sum + (tc.marks || 0), 0);
      const correctPercentage = totalPossibleMarks > 0 ? (totalMarksEarned / totalPossibleMarks) * 100 : 0;
      
      setOutput(prev => `${prev}\n\nTotal marks earned: ${totalMarksEarned}/${totalPossibleMarks} (${correctPercentage.toFixed(1)}%)`);
      
      // Update the onMarksUpdate callback with earned marks
      if (onMarksUpdate) {
        onMarksUpdate(question.id, totalMarksEarned);
      }
      
      // Store results if user is logged in
      if (user) {
        try {
          // Create a submission record with the required fields
          const submissionData: Submission = {
            assessment_id: question.assessment_id || '',
            user_id: user.id,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          };

          console.log('Creating submission with data:', submissionData);

          const { data: submissionResult, error: submissionError } = await supabase
            .from('submissions')
            .insert(submissionData)
            .select()
            .single();

          if (submissionError) {
            console.error('Error creating submission:', submissionError);
            throw submissionError;
          }

          if (!submissionResult) {
            throw new Error('No submission result returned');
          }

          console.log('Submission created:', submissionResult);

          // Store answer details with the required fields
          const answerData: Answer = {
            submission_id: submissionResult.id,
            question_id: question.id,
            code_solution: currentCode,
            language: selectedLanguage,
            is_correct: allPassed,
            marks_obtained: totalMarksEarned,
            test_results: finalResults
          };

          console.log('Creating answer with data:', answerData);

          const { error: answerError } = await supabase
            .from('answers')
            .insert(answerData);

          if (answerError) {
            console.error('Error storing answer:', answerError);
            throw answerError;
          }
          
          toast({
            title: allPassed ? "Success!" : "Test Cases Evaluation Complete",
            description: `You earned ${totalMarksEarned} out of ${totalPossibleMarks} marks (${correctPercentage.toFixed(1)}%).`,
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
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="c">C</SelectItem>
            <SelectItem value="cpp">C++</SelectItem>
            <SelectItem value="java">Java</SelectItem>
            <SelectItem value="python">Python</SelectItem>
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
            <Textarea
              value={currentCode}
              onChange={handleCodeChange}
              className="h-full font-mono text-sm resize-none p-4"
              spellCheck="false"
            />
          </TabsContent>
          <TabsContent value="output" className="flex-1 h-full m-0">
            <div className="h-full bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm overflow-auto">
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
