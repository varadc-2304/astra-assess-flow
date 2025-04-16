import React, { useState, useEffect } from 'react';
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
import { createSubmission, getSubmissionResult } from '@/services/judge0Service';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CodeEditorProps {
  question: CodeQuestion;
  onCodeChange: (language: string, code: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ question, onCodeChange }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionToken, setSubmissionToken] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{passed: boolean, actualOutput?: string}[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const currentCode = question.userSolution[selectedLanguage] || question.solutionTemplate[selectedLanguage] || '';

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (submissionToken && (isRunning || isSubmitting)) {
      intervalId = setInterval(async () => {
        try {
          const result = await getSubmissionResult(submissionToken);
          
          if (result.status.id <= 2) {
            return; // Still processing
          }
          
          clearInterval(intervalId);
          
          if (result.status.id >= 6) {
            const errorOutput = result.compile_output || result.stderr || 'An error occurred while running your code';
            setOutput(Error: ${errorOutput});
            setIsRunning(false);
            setIsSubmitting(false);
            setSubmissionToken(null);
            return;
          }
          
          let formattedOutput = '';
          const actualOutput = result.stdout?.trim() || '';
          
          if (isSubmitting) {
            formattedOutput = Running all test cases...\n\n;
            const testCase = question.testCases[testResults.length];
            const expectedOutput = testCase.output.trim().replace(/\r\n/g, '\n');
            const passed = actualOutput === expectedOutput;
            
            const newTestResults = [...testResults, { passed, actualOutput }];
            setTestResults(newTestResults);
            
            formattedOutput += Test case ${testResults.length + 1}: ${passed ? 'Passed' : 'Failed'}\n;
            if (!passed) {
              formattedOutput += Expected Output: "${expectedOutput}"\n;
              formattedOutput += Your Output: "${actualOutput}"\n;
            }
            
            if (testResults.length + 1 === question.testCases.length) {
              const allPassed = newTestResults.every(r => r.passed);
              formattedOutput += \n${allPassed ? 'All test cases passed!' : 'Some test cases failed.'}\n;
              setIsSubmitting(false);
              setSubmissionToken(null);
              
              if (user) {
                try {
                  const { data: submissionData, error: submissionError } = await supabase
                    .from('submissions')
                    .insert({
                      assessment_id: question.assessmentId || '',
                      user_id: user.id,
                      started_at: new Date().toISOString(),
                      completed_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                  if (submissionError) throw submissionError;

                  const { error: answerError } = await supabase
                    .from('answers')
                    .insert({
                      submission_id: submissionData.id,
                      question_id: question.id,
                      code_solution: currentCode,
                      language: selectedLanguage,
                      is_correct: allPassed,
                      test_results: newTestResults
                    });

                  if (answerError) throw answerError;

                  toast({
                    title: allPassed ? "Success!" : "Test Cases Failed",
                    description: allPassed 
                      ? "Your solution passed all test cases!" 
                      : "Some test cases failed. Check the output for details.",
                    variant: allPassed ? "default" : "destructive",
                  });
                } catch (dbError) {
                  console.error('Error storing results:', dbError);
                  toast({
                    title: "Error",
                    description: "Failed to save your submission. Please try again.",
                    variant: "destructive",
                  });
                }
              } else {
                toast({
                  title: "Authentication Error",
                  description: "You must be logged in to submit solutions.",
                  variant: "destructive",
                });
              }
            } else {
              const nextTestCase = question.testCases[testResults.length];
              const token = await createSubmission(currentCode, selectedLanguage, nextTestCase.input);
              setSubmissionToken(token);
            }
          } else {
            formattedOutput = Running test case...\n;
            const example = question.examples[0];
            const expectedOutput = example.output.trim().replace(/\r\n/g, '\n');
            const passed = actualOutput === expectedOutput;
            
            formattedOutput += Input: ${example.input}\n;
            formattedOutput += Expected Output: ${expectedOutput}\n;
            formattedOutput += Your Output: ${actualOutput}\n;
            formattedOutput += Result: ${passed ? 'Passed' : 'Failed'}\n;
            
            setIsRunning(false);
            setSubmissionToken(null);
            
            toast({
              title: passed ? "Success!" : "Test Case Failed",
              description: passed 
                ? "Your code produced the expected output!" 
                : "Your code's output doesn't match the expected output.",
              variant: passed ? "default" : "destructive",
            });
          }
          
          setOutput(formattedOutput);
          
        } catch (error) {
          console.error('Error checking submission status:', error);
          clearInterval(intervalId);
          setOutput('Error checking submission status. Please try again.');
          setIsRunning(false);
          setIsSubmitting(false);
          setSubmissionToken(null);
          
          toast({
            title: "Error",
            description: "Failed to check submission status. Please try again.",
            variant: "destructive",
          });
        }
      }, 2000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [submissionToken, isRunning, isSubmitting, question.examples, question.testCases, testResults, toast, currentCode, selectedLanguage, user, question.id, question.assessmentId]);

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onCodeChange(selectedLanguage, e.target.value);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Running code...');
    
    try {
      const input = question.examples[0]?.input || '';
      const token = await createSubmission(currentCode, selectedLanguage, input);
      setSubmissionToken(token);
    } catch (error) {
      console.error('Error running code:', error);
      setOutput(Error: ${error instanceof Error ? error.message : 'Unknown error occurred'});
      setIsRunning(false);
      
      toast({
        title: "Error",
        description: "Failed to run code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmitCode = async () => {
    setIsSubmitting(true);
    setOutput('Submitting solution...');
    setTestResults([]);
    
    try {
      const firstTestCase = question.testCases[0];
      const token = await createSubmission(currentCode, selectedLanguage, firstTestCase.input);
      setSubmissionToken(token);
    } catch (error) {
      console.error('Error submitting code:', error);
      setOutput(Error: ${error instanceof Error ? error.message : 'Unknown error occurred'});
      setIsSubmitting(false);
      setSubmissionToken(null);
      
      toast({
        title: "Error",
        description: "Failed to submit solution. Please try again.",
        variant: "destructive",
      });
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
