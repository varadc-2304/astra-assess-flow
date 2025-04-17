import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeQuestion } from '@/contexts/AssessmentContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Answer, Submission } from '@/types/database';
import LanguageSelector from './LanguageSelector';
import OutputDisplay from './OutputDisplay';
import ActionButtons from './ActionButtons';
import { TestResult, processTestCase } from '@/utils/codeSubmissionUtils';
import { fetchTestCases } from '@/services/testCaseService';
import { createSubmission, waitForSubmissionResult } from '@/services/judge0Service';

interface CodeEditorProps {
  question: CodeQuestion;
  onCodeChange: (language: string, code: string) => void;
  onMarksUpdate?: (questionId: string, marks: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  question, 
  onCodeChange, 
  onMarksUpdate 
}) => {
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
      const result = await waitForSubmissionResult(token);
      
      if (result.status.id >= 6) {
        const errorOutput = result.compile_output || result.stderr || 'An error occurred while running your code';
        setOutput(`Error: ${errorOutput}`);
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
      toast({
        title: "Error",
        description: "Failed to run code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
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
      
      if (testCases.length === 0) {
        throw new Error('No test cases found for this question');
      }
      
      let totalMarksEarned = 0;
      const results: TestResult[] = [];
      
      // Process test cases sequentially
      for (let i = 0; i < testCases.length; i++) {
        const result = await processTestCase(
          currentCode,
          selectedLanguage,
          testCases[i],
          i,
          testCases.length,
          setOutput
        );
        
        results.push(result);
        totalMarksEarned += result.marks || 0;
      }
      
      const totalPossibleMarks = testCases.reduce((sum, tc) => sum + (tc.marks || 0), 0);
      const allPassed = results.every(r => r.passed);
      const correctPercentage = totalPossibleMarks > 0 ? (totalMarksEarned / totalPossibleMarks) * 100 : 0;
      
      setOutput(prev => `${prev}\n\nTotal marks earned: ${totalMarksEarned}/${totalPossibleMarks} (${correctPercentage.toFixed(1)}%)`);
      
      if (onMarksUpdate) {
        onMarksUpdate(question.id, totalMarksEarned);
      }
      
      // Store results if user is logged in
      if (user) {
        try {
          const submissionData: Submission = {
            assessment_id: question.assessment_id,
            user_id: user.id,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          };

          const { data: submissionResult, error: submissionError } = await supabase
            .from('submissions')
            .insert(submissionData)
            .select()
            .single();

          if (submissionError || !submissionResult) {
            throw submissionError || new Error('No submission result returned');
          }

          const answerData: Answer = {
            submission_id: submissionResult.id,
            question_id: question.id,
            code_solution: currentCode,
            language: selectedLanguage,
            is_correct: allPassed,
            marks_obtained: totalMarksEarned,
            test_results: results
          };

          const { error: answerError } = await supabase
            .from('answers')
            .insert(answerData);

          if (answerError) {
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
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
        />
        <ActionButtons
          onRun={handleRunCode}
          onSubmit={handleSubmitCode}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
        />
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
            <OutputDisplay output={output} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default CodeEditor;
