import React, { useState, useRef } from 'react';
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
  const [output, setOutput] = useState<string>('Welcome! Use the buttons above to test your code.');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const editorRef = useRef<any>(null);

  const currentCode =
    question.userSolution[selectedLanguage] ?? question.solutionTemplate[selectedLanguage] ?? '';

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      onCodeChange(selectedLanguage, value);
    }
  };

  const cleanErrorOutput = (errorOutput: string): string => {
    return errorOutput.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\r\n]+/g, '\n').trim();
  };

  const handleRunCode = async () => {
    if (!currentCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please write some code before running.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    setOutput('Running code on visible test cases...\n');

    try {
      const { data: testCases, error } = await supabase
        .from('test_cases')
        .select('*')
        .eq('coding_question_id', question.id)
        .eq('is_hidden', false)
        .order('order_index', { ascending: true });

      if (error || !testCases || testCases.length === 0) {
        throw new Error(error?.message || 'No visible test cases found');
      }

      let passedCount = 0;

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        setOutput(prev => `${prev}\nRunning test case ${i + 1}...\n`);

        const token = await createSubmission(currentCode, selectedLanguage, testCase.input);
        const result = await waitForSubmissionResult(token);

        if (result.status.id >= 6) {
          const errorOutput = cleanErrorOutput(
            result.compile_output || result.stderr || 'An error occurred while running your code'
          );
          setOutput(prev => `${prev}Error in test case ${i + 1}:\n${errorOutput}\n`);
          continue;
        }

        const actualOutput = result.stdout?.trim() || '';
        const expectedOutput = testCase.output.trim().replace(/\r\n/g, '\n');
        const passed = actualOutput === expectedOutput;

        if (passed) passedCount++;

        setOutput(prev => `${prev}Test case ${i + 1}: ${passed ? 'Passed' : 'Failed'}\n`);
        if (!passed) {
          setOutput(prev => `${prev}Expected: "${expectedOutput}"\nGot: "${actualOutput}"\n`);
        }
      }

      toast({
        title: passedCount === testCases.length ? 'All Passed!' : 'Some Failed',
        description: `${passedCount}/${testCases.length} test cases passed.`,
        variant: passedCount === testCases.length ? 'default' : 'destructive',
      });
    } catch (err: any) {
      console.error(err);
      setOutput(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const fetchTestCases = async (): Promise<TestCase[]> => {
    const { data, error } = await supabase
      .from('test_cases')
      .select('*')
      .eq('coding_question_id', question.id)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const processTestCase = async (
    index: number,
    testCases: TestCase[],
    results: TestResult[] = [],
    totalMarks = 0
  ): Promise<{ results: TestResult[]; totalMarksEarned: number }> => {
    if (index >= testCases.length) return { results, totalMarksEarned: totalMarks };

    try {
      const testCase = testCases[index];
      const token = await createSubmission(currentCode, selectedLanguage, testCase.input);
      const result = await waitForSubmissionResult(token);

      let passed = false;
      let actualOutput = '';
      let errorMessage = '';
      let marks = 0;

      if (result.status.id >= 6) {
        errorMessage = cleanErrorOutput(result.compile_output || result.stderr || 'Runtime Error');
      } else {
        actualOutput = result.stdout?.trim() || '';
        const expected = testCase.output.trim().replace(/\r\n/g, '\n');
        passed = actualOutput === expected;
        marks = passed ? testCase.marks || 0 : 0;
      }

      const resultOutput = {
        passed,
        actualOutput: passed ? actualOutput : `Error: ${errorMessage}`,
        marks,
        isHidden: testCase.is_hidden,
      };

      setOutput(prev =>
        `${prev}\n${testCase.is_hidden ? 'Hidden' : 'Visible'} Test Case ${index + 1}: ${
          passed ? 'Passed' : 'Failed'
        } (${marks} marks)\n${!passed && !testCase.is_hidden ? `Expected: "${testCase.output.trim()}"\nGot: "${actualOutput || errorMessage}"\n` : ''}`
      );

      return processTestCase(index + 1, testCases, [...results, resultOutput], totalMarks + marks);
    } catch (error: any) {
      console.error(error);
      return processTestCase(index + 1, testCases, [...results, {
        passed: false,
        actualOutput: `Error: ${error.message || 'Unknown Error'}`,
        marks: 0,
        isHidden: testCases[index].is_hidden,
      }], totalMarks);
    }
  };

  const handleSubmitCode = async () => {
    if (!currentCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please write some code before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setOutput('Submitting code for evaluation...\n');
    setTestResults([]);

    try {
      const testCases = await fetchTestCases();
      const { results, totalMarksEarned } = await processTestCase(0, testCases);

      setTestResults(results);
      if (onMarksUpdate) onMarksUpdate(question.id, totalMarksEarned);

      toast({
        title: 'Submission Complete',
        description: `You scored ${totalMarksEarned} marks.`,
      });
    } catch (error: any) {
      setOutput(`Submission failed: ${error.message}`);
      toast({
        title: 'Error',
        description: 'Submission failed.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select Language" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(question.solutionTemplate).map(lang => (
              <SelectItem key={lang} value={lang}>{lang}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunCode} disabled={isRunning || isSubmitting}>
            {isRunning ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Run
          </Button>
          <Button onClick={handleSubmitCode} disabled={isRunning || isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Submit
          </Button>
        </div>
      </div>

      <Editor
        height="300px"
        defaultLanguage={selectedLanguage}
        value={currentCode}
        onChange={handleCodeChange}
        theme="vs-dark"
      />

      <Tabs defaultValue="output">
        <TabsList>
          <TabsTrigger value="output"><Terminal className="mr-2 h-4 w-4" /> Output</TabsTrigger>
        </TabsList>
        <TabsContent value="output">
          <pre className="bg-muted p-4 rounded overflow-auto max-h-64 whitespace-pre-wrap text-sm">{output}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CodeEditor;
