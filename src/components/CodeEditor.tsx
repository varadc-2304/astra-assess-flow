import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Play, Stop, Save, AlertTriangle } from 'lucide-react';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CodeEditorProps {
  question: any;
  onCodeChange: (language: string, code: string) => void;
  onMarksUpdate: (marks: number) => void;
  onTestResultsUpdate: (passed: number, total: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ question, onCodeChange, onMarksUpdate, onTestResultsUpdate }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { assessment } = useAssessment();
  const [codeSolution, setCodeSolution] = useState<Record<string, string>>(question.userSolution || {});
  const [currentLanguage, setCurrentLanguage] = useState<string>(Object.keys(question.solutionTemplate)[0] || 'python');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [marksObtained, setMarksObtained] = useState<number>(question.marksObtained || 0);
  const editorRef = useRef<any>(null);
  const { saveSubmission } = useAssessment();
  const useAssessment = useAssessment ? useAssessment : null;

  const solutionTemplates = question.solutionTemplate;

  useEffect(() => {
    setCodeSolution(question.userSolution || {});
    setMarksObtained(question.marksObtained || 0);
  }, [question.userSolution, question.marksObtained]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleValueChange = (value: string) => {
    setCodeSolution(prev => ({ ...prev, [currentLanguage]: value }));
    onCodeChange(currentLanguage, value);
  };

  const handleLanguageChange = (language: string) => {
    setCurrentLanguage(language);
  };

  const getLanguageLabel = (language: string) => {
    switch (language) {
      case 'python':
        return 'Python';
      case 'javascript':
        return 'JavaScript';
      case 'java':
        return 'Java';
      default:
        return language;
    }
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setConsoleOutput('');
    
    try {
      const language = currentLanguage || Object.keys(solutionTemplates)[0];
      const solution = codeSolution[language] || '';

      // Save the current solution before running tests
      if (useAssessment) {
        const { saveSubmission } = useAssessment();
        await saveSubmission(question.id, 'code', {
          language,
          solution,
          results: null,
          marks: marksObtained
        });
      }
      
      const testCases = question.testCases;
      let passedCount = 0;
      const results = [];
      
      for (const testCase of testCases) {
        try {
          const response = await fetch('/api/execute-code', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              language: language,
              code: solution,
              input: testCase.input,
            }),
          });
          
          const data = await response.json();
          
          if (data.error) {
            setConsoleOutput(prev => prev + `\nTest Case ${testCase.id} Error: ${data.error}`);
            results.push({
              testCaseId: testCase.id,
              passed: false,
              actualOutput: data.error,
              expectedOutput: testCase.output,
              isHidden: testCase.is_hidden,
              marks: testCase.marks
            });
          } else {
            const passed = data.output.trim() === testCase.output.trim();
            if (passed) {
              passedCount++;
            }
            
            results.push({
              testCaseId: testCase.id,
              passed: passed,
              actualOutput: data.output,
              expectedOutput: testCase.output,
              isHidden: testCase.is_hidden,
              marks: testCase.marks
            });
            
            setConsoleOutput(prev => prev + `\nTest Case ${testCase.id} Output: ${data.output}`);
          }
        } catch (error: any) {
          console.error('Test execution error:', error);
          setConsoleOutput(prev => prev + `\nTest Case ${testCase.id} Error: ${error.message}`);
          results.push({
            testCaseId: testCase.id,
            passed: false,
            actualOutput: error.message,
            expectedOutput: testCase.output,
            isHidden: testCase.is_hidden,
            marks: testCase.marks
          });
        }
      }
      
      setTestResults(results);
      
      const totalMarks = testCases.reduce((sum, testCase) => sum + (testCase.marks || 0), 0);
      const obtainedMarks = results.reduce((sum, result) => sum + (result.passed ? (result.marks || 0) : 0), 0);
      
      setMarksObtained(obtainedMarks);
      onMarksUpdate(obtainedMarks);
      onTestResultsUpdate(passedCount, testCases.length);
      
      toast({
        title: "Tests Completed",
        description: `Passed ${passedCount} of ${testCases.length} tests.`,
      });
    } catch (error: any) {
      console.error('Error running tests:', error);
      toast({
        title: "Error",
        description: "Failed to run tests.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {Object.keys(solutionTemplates).map(language => (
            <Button
              key={language}
              variant={currentLanguage === language ? 'default' : 'outline'}
              onClick={() => handleLanguageChange(language)}
              size="sm"
            >
              {getLanguageLabel(language)}
            </Button>
          ))}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleRunTests}
            disabled={isRunning}
            className="bg-primary hover:bg-primary-600 text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Tests
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <Editor
          height="40vh"
          defaultLanguage={currentLanguage}
          defaultValue={solutionTemplates[currentLanguage]}
          value={codeSolution[currentLanguage]}
          onChange={handleValueChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            wrappingIndent: 'indent',
          }}
        />
      </div>
      
      <div className="h-1/2 flex flex-col">
        <div className="p-3 border-b bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
          <h4 className="text-sm font-medium">Test Results:</h4>
        </div>
        <ScrollArea className="flex-1 overflow-y-auto p-3">
          {testResults.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Run tests to see results.</div>
          ) : (
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    {result.passed ? (
                      <CheckCircle className="text-green-500 mr-2 h-4 w-4" />
                    ) : (
                      <XCircle className="text-red-500 mr-2 h-4 w-4" />
                    )}
                    <span className="text-sm">Test Case {result.testCaseId}</span>
                  </div>
                  {!result.isHidden && (
                    <Badge variant={result.passed ? 'success' : 'destructive'}>
                      {result.passed ? 'Passed' : 'Failed'}
                    </Badge>
                  )}
                </div>
              ))}
              <div className="mt-4">
                <h5 className="text-sm font-medium">Marks Obtained:</h5>
                <div className="text-xl font-semibold">{marksObtained}</div>
              </div>
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
          <h4 className="text-sm font-medium">Console Output:</h4>
        </div>
        <ScrollArea className="flex-1 overflow-y-auto p-3 bg-gray-100 dark:bg-gray-800">
          <pre className="text-xs whitespace-pre-wrap">{consoleOutput}</pre>
        </ScrollArea>
      </div>
    </div>
  );
};

export default CodeEditor;
