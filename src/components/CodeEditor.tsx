
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
import { Submission, Answer } from '@/types/database';

interface CodeEditorProps {
  question: CodeQuestion;
  onCodeChange: (language: string, code: string) => void;
}

interface TestResult {
  passed: boolean;
  actualOutput?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ question, onCodeChange }) => {
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

  const processTestCase = async (index: number, allResults: TestResult[] = []): Promise<TestResult[]> => {
    if (index >= question.testCases.length) {
      return allResults;
    }
    
    try {
      const testCase = question.testCases[index];
      setOutput(prev => `${prev}\n\nProcessing test case ${index + 1}/${question.testCases.length}...\n`);
      
      // Create submission for current test case
      const token = await createSubmission(currentCode, selectedLanguage, testCase.input);
      
      // Wait for the result of this specific test case
      const result = await waitForSubmissionResult(token);
      
      if (result.status.id >= 6) {
        const errorOutput = result.compile_output || result.stderr || 'An error occurred while running your code';
        setOutput(prev => `${prev}\nError in test case ${index + 1}: ${errorOutput}`);
        
        // Add failed result with error
        const newResult = { passed: false, actualOutput: `Error: ${errorOutput}` };
        const updatedResults = [...allResults, newResult];
        setTestResults(updatedResults);
        
        // Display results summary
        setOutput(prev => `${prev}\n\nTest case ${index + 1}/${question.testCases.length}: Failed (Error)\n`);
        return updatedResults;
      }
      
      const actualOutput = result.stdout?.trim() || '';
      const expectedOutput = testCase.output.trim().replace(/\r\n/g, '\n');
      const passed = actualOutput === expectedOutput;
      
      // Add this result to our results array
      const newResult = { passed, actualOutput };
      const updatedResults = [...allResults, newResult];
      setTestResults(updatedResults);
      
      // Display result for this test case
      const testResultOutput = `Test case ${index + 1}/${question.testCases.length}: ${passed ? 'Passed' : 'Failed'}\n` + 
        (!passed ? `Expected Output: "${expectedOutput}"\nYour Output: "${actualOutput}"\n` : '');
      
      setOutput(prev => `${prev}\n${testResultOutput}`);
      
      // Process the next test case after this one completes
      return processTestCase(index + 1, updatedResults);
    } catch (error) {
      console.error(`Error processing test case ${index + 1}:`, error);
      setOutput(prev => `${prev}\nError processing test case ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      
      // Add failed result for this test case
      const newResult = { passed: false, actualOutput: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
      const updatedResults = [...allResults, newResult];
      setTestResults(updatedResults);
      
      return processTestCase(index + 1, updatedResults);
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
      // Process all test cases sequentially
      const finalResults = await processTestCase(0);
      const allPassed = finalResults.every(r => r.passed);
      const correctPercentage = (finalResults.filter(r => r.passed).length / finalResults.length) * 100;
      
      // Store results if user is logged in
      if (user) {
        try {
          // Create a submission record
          const { data: submissionData, error: submissionError } = await supabase
            .from('submissions')
            .insert({
              assessment_id: question.assessmentId || '',
              user_id: user.id,
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            } as Submission)
            .select()
            .single();

          if (submissionError) throw submissionError;

          // Store answer details
          const { error: answerError } = await supabase
            .from('answers')
            .insert({
              submission_id: submissionData.id,
              question_id: question.id,
              code_solution: currentCode,
              language: selectedLanguage,
              is_correct: allPassed,
              marks_obtained: allPassed ? question.marks || 1 : 0,
              test_results: finalResults
            } as Answer);

          if (answerError) throw answerError;
          
          toast({
            title: allPassed ? "Success!" : "Test Cases Failed",
            description: allPassed 
              ? "Your solution passed all test cases and has been submitted!" 
              : `Some test cases failed. You passed ${finalResults.filter(r => r.passed).length}/${finalResults.length} test cases (${correctPercentage.toFixed(1)}%).`,
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
