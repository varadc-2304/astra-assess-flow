import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, CheckCircle, XCircle, Clock, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { executeCode } from '@/services/judge0Service';
import { CodingQuestion } from '@/types/database';

interface CodeEditorProps {
  question: CodingQuestion;
  onSolutionChange: (language: string, solution: string) => void;
  onMarksUpdate?: (testResults: any) => void;
  readOnly?: boolean;
  showTestResults?: boolean;
  initialSolution?: Record<string, string>;
}

interface TestResult {
  passed: boolean;
  actualOutput?: string;
  marks?: number;
  isHidden?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  question,
  onSolutionChange,
  onMarksUpdate,
  readOnly = false,
  showTestResults = true,
  initialSolution = {}
}) => {
  const editorRef = useRef<any>(null);
  const [language, setLanguage] = useState(Object.keys(question.solutionTemplate || {})[0] || 'javascript');
  const [solution, setSolution] = useState(initialSolution[language] || question.solutionTemplate?.[language] || '');
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [executionTime, setExecutionTime] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    setSolution(initialSolution[language] || question.solutionTemplate?.[language] || '');
  }, [language, question.solutionTemplate, initialSolution]);

  useEffect(() => {
    onSolutionChange(language, solution);
  }, [language, solution, onSolutionChange]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
  }

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
  };

  const handleSolutionChange = (value: string) => {
    setSolution(value);
  };

  const handleResetCode = () => {
    setSolution(question.solutionTemplate?.[language] || '');
    setTestResults([]);
  };

  const executeUserCode = async () => {
    if (!question.testCases || question.testCases.length === 0) {
      toast({
        title: 'No Test Cases',
        description: 'This question does not have any test cases to execute.',
      });
      return;
    }

    setIsExecuting(true);
    setTestResults([]);
    setExecutionTime(0);

    const startTime = performance.now();
    try {
      const results = await executeCode(
        language,
        solution,
        question.testCases.map(testCase => ({
          input: testCase.input,
          output: testCase.output,
        }))
      );

      if (results && results.length > 0) {
        const newTestResults = question.testCases.map((testCase, index) => {
          const result = results[index];
          return {
            passed: result.status.id === 3,
            actualOutput: result.stdout,
            marks: testCase.marks,
            isHidden: testCase.is_hidden,
          };
        });
        setTestResults(newTestResults);
        const endTime = performance.now();
        setExecutionTime(endTime - startTime);
        if (onMarksUpdate) {
          onMarksUpdate(newTestResults);
        }
      } else {
        toast({
          title: 'Execution Error',
          description: 'Failed to execute code. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error executing code:', error);
      toast({
        title: 'Execution Error',
        description: 'An error occurred while executing the code.',
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const editorOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    wordWrap: 'on' as const,
    automaticLayout: true,
    tabSize: 2,
    formatOnPaste: true,
    formatOnType: true,
    selectOnLineNumbers: true,
    roundedSelection: false,
    readOnly: readOnly,
    cursorStyle: 'line' as const,
    mouseWheelZoom: true,
    contextmenu: false,
    lineNumbers: 'on' as const,
    glyphMargin: false,
    folding: true,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 3,
    renderLineHighlight: 'line' as const,
    scrollbar: {
      vertical: 'visible' as const,
      horizontal: 'visible' as const,
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
    },
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false
    },
    parameterHints: {
      enabled: true
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on' as const,
    tabCompletion: 'on' as const,
    wordBasedSuggestions: 'matchingDocuments' as const,
    lightbulb: {
      enabled: 'on' as const
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Code className="mr-2 h-4 w-4" />
          Code Editor
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="absolute top-2 right-2 z-10 flex items-center space-x-2">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Language" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(question.solutionTemplate || {}).map((lang) => (
                <SelectItem key={lang} value={lang}>{lang}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleResetCode}
            disabled={isExecuting}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={executeUserCode}
            disabled={isExecuting}
          >
            {isExecuting ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
        <Editor
          height="400px"
          defaultLanguage={language}
          value={solution}
          theme="vs-dark"
          options={editorOptions}
          onChange={handleSolutionChange}
          onMount={handleEditorDidMount}
          readOnly={readOnly}
        />
        {showTestResults && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Test Results:</h3>
            {testResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test results yet. Execute the code to see results.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {testResults.map((result, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    {result.passed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">
                      Test Case #{index + 1}:{' '}
                      {result.passed ? 'Passed' : 'Failed'}
                      {!result.passed && result.actualOutput && (
                        <span className="ml-2 text-xs text-gray-400">
                          (Output: {result.actualOutput})
                        </span>
                      )}
                    </span>
                    {question.testCases && question.testCases[index].marks && (
                      <Badge variant={result.passed ? 'success' : 'destructive'}>
                        {result.passed ? question.testCases[index].marks : 0} Marks
                      </Badge>
                    )}
                    {result.isHidden && (
                      <Badge variant="secondary">Hidden</Badge>
                    )}
                  </li>
                ))}
                <div className="mt-2">
                  <span className="text-sm font-medium">Execution Time:</span>
                  <span className="text-sm text-muted-foreground ml-1">{executionTime.toFixed(2)}ms</span>
                </div>
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CodeEditor;
