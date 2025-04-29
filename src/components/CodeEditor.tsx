import React, { useState, useEffect, useRef } from 'react';
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
import { TestCase, TestResult } from '@/types/database';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  question: CodeQuestion;
  onCodeChange: (language: string, code: string) => void;
  onMarksUpdate?: (questionId: string, marks: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ question, onCodeChange, onMarksUpdate }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    Object.keys(question.solutionTemplate)[0] || 'python'
  );
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const editorRef = useRef<any>(null);

  const currentCode =
    question.userSolution[selectedLanguage] ??
    question.solutionTemplate[selectedLanguage] ??
    '';

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      onCodeChange(selectedLanguage, value);
    }
  };

  const cleanErrorOutput = (errorOutput: string): string => {
    return errorOutput
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/[\r\n]+/g, '\n')
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
  ): Promise<{ results: TestResult[]; totalMarksEarned: number }> => {
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
        const cleanError = cleanErrorOutput(
          result.compile_output || result.stderr || 'An error occurred'
        );
        setOutput(prev => `${prev}\nError in test case ${index + 1}: ${cleanError}\n`);

        const newResult: TestResult = {
          passed: false,
          actualOutput: `Error: ${cleanError}`,
          marks: 0,
          isHidden
        };
        const updatedResults = [...allResults, newResult];
        setTestResults(updatedResults);

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

  // (Above code stays unchanged)

// Continue from `handleSubmitCode` function
      if (onMarksUpdate) {
        onMarksUpdate(question.id, totalMarksEarned);
      }

      const submission: QuestionSubmission = {
        question_id: question.id,
        user_id: user?.id || '',
        language: selectedLanguage,
        code: currentCode,
        total_marks: totalMarksEarned,
        test_results: finalResults as Json,
        submitted_at: new Date().toISOString(),
        correctness: correctPercentage,
      };

      const { error: insertError } = await supabase
        .from('question_submissions')
        .insert([submission]);

      if (insertError) {
        console.error('Failed to store submission:', insertError);
        toast({
          title: "Warning",
          description: "Submission saved locally, but failed to save on server.",
          variant: "destructive",
        });
      } else {
        toast({
          title: allPassed ? "Perfect Submission!" : "Submission Complete",
          description: `${totalMarksEarned} marks awarded.`,
        });
      }

    } catch (error) {
      console.error('Error during code submission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Error",
        description: `Submission failed: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(question.solutionTemplate).map((lang) => (
              <SelectItem key={lang} value={lang}>
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span className="ml-2">Run Code</span>
          </Button>
          <Button onClick={handleSubmitCode} disabled={isRunning || isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span className="ml-2">Submit</span>
          </Button>
        </div>
      </div>

      <Editor
        height="300px"
        defaultLanguage={selectedLanguage}
        value={currentCode}
        onChange={handleCodeChange}
        theme="vs-dark"
        onMount={(editor) => {
          editorRef.current = editor;
        }}
      />

      <Tabs defaultValue="output" className="w-full">
        <TabsList>
          <TabsTrigger value="output">
            <Terminal className="w-4 h-4 mr-2" />
            Output
          </TabsTrigger>
        </TabsList>
        <TabsContent value="output">
          <pre className="p-2 bg-muted rounded max-h-[200px] overflow-y-auto whitespace-pre-wrap">
            {output || 'Your output will appear here.'}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CodeEditor;
