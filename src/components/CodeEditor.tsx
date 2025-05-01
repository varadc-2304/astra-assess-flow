import React, { useState, useEffect, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { CodeQuestion } from '@/contexts/AssessmentContext';
import { Button } from '@/components/ui/button';
import { PlayIcon, XCircleIcon, CheckCircleIcon, AlertCircleIcon, SpinnerIcon } from 'lucide-react';
import { runCode, Language } from '@/services/judge0Service';
import { TestResult } from '@/types/database';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useToast } from '@/hooks/use-toast';

interface CodeEditorProps {
  question: CodeQuestion;
  onCodeChange: (language: string, code: string) => void;
  onMarksUpdate: (questionId: string, marks: number) => void;
}

const supportedLanguages = [
  { name: 'JavaScript', value: 'javascript', id: 63 },
  { name: 'Python', value: 'python', id: 71 },
  { name: 'C++', value: 'cpp', id: 54 },
  { name: 'Java', value: 'java', id: 62 }
];

const CodeEditor: React.FC<CodeEditorProps> = ({ question, onCodeChange, onMarksUpdate }) => {
  const [selectedLanguage, setSelectedLanguage] = useState(supportedLanguages[0].value);
  const [code, setCode] = useState(question.solutionTemplate?.[selectedLanguage] || '');
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [totalMarks, setTotalMarks] = useState(0);
  const editorRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (question.solutionTemplate && question.solutionTemplate[selectedLanguage]) {
      setCode(question.solutionTemplate[selectedLanguage]);
    }
  }, [question.solutionTemplate, selectedLanguage]);

  useEffect(() => {
    onCodeChange(selectedLanguage, code);
  }, [code, selectedLanguage, onCodeChange]);

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    setCode(question.solutionTemplate?.[language] || '');
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
  };

  const executeCode = async () => {
    setIsExecuting(true);
    setTestResults([]);
    setTotalMarks(0);

    if (!question.testCases || question.testCases.length === 0) {
      toast({
        title: "No Test Cases",
        description: "This question does not have any test cases.",
        variant: "warning",
      });
      setIsExecuting(false);
      return;
    }

    try {
      const languageObject = supportedLanguages.find(lang => lang.value === selectedLanguage);
      if (!languageObject) {
        throw new Error(`Language ${selectedLanguage} not supported.`);
      }

      const results = await runCode(
        languageObject.id,
        code,
        question.testCases
      );

      setTestResults(results);

      let marks = 0;
      results.forEach((result, index) => {
        if (result.passed && question.testCases && question.testCases[index].marks) {
          marks += question.testCases[index].marks || 0;
        }
      });

      setTotalMarks(marks);
      onMarksUpdate(question.id, marks);

      toast({
        title: "Execution Complete",
        description: `Code executed with ${results.filter(r => r.passed).length} passed test cases.`,
      });
    } catch (error: any) {
      console.error("Code execution error:", error);
      toast({
        title: "Execution Error",
        description: error.message || "Failed to execute code.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  const handleEditorDidMount = (monaco: Monaco) => {
    // Configure Monaco editor
    monaco.editor.defineTheme('astraTheme', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#333333',
        'editor.lineHighlightBackground': '#f8f9fa',
        'editorLineNumber.foreground': '#aaaaaa',
        'editor.selectionBackground': '#e3f2fd',
        'editor.inactiveSelectionBackground': '#f5f5f5'
      }
    });

    monaco.editor.setTheme('astraTheme');
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
    autoIndent: 'advanced' as const,
    suggest: {
      showIcons: true,
      showFunctions: true,
      showConstructors: true,
      showMethods: true
    },
    contextmenu: true,
    quickSuggestions: true,
    folding: true,
    renderLineHighlight: 'all' as const,
    renderIndentGuides: true,
    lineNumbers: 'on' as const,
    lightbulb: { enabled: true }
  };
  
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>Code Editor</CardTitle>
        <CardDescription>Write and test your code here.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col h-full p-0">
        <Tabs defaultValue={selectedLanguage} className="flex flex-col h-full">
          <TabsList className="border-b">
            {supportedLanguages.map(lang => (
              <TabsTrigger 
                key={lang.value} 
                value={lang.value}
                onClick={() => handleLanguageChange(lang.value)}
              >
                {lang.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {supportedLanguages.map(lang => (
            <TabsContent 
              key={lang.value} 
              value={lang.value} 
              className="p-4 flex-1 min-h-0"
            >
              <Editor
                height="40vh"
                defaultLanguage={lang.value}
                value={code}
                onChange={handleCodeChange}
                beforeMount={(monaco) => {}}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  handleEditorDidMount(monaco);
                }}
                options={editorOptions}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={executeCode} 
            disabled={isExecuting}
          >
            {isExecuting ? (
              <>
                <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <PlayIcon className="mr-2 h-4 w-4" />
                Run Code
              </>
            )}
          </Button>
          <span>Total Marks: {totalMarks} / {question.marks}</span>
        </div>
      </CardFooter>
      {testResults.length > 0 && (
        <div className="p-4">
          <Separator className="my-2" />
          <h4 className="text-sm font-medium">Test Results:</h4>
          <div className="space-y-2 mt-2">
            {testResults.map((result, index) => (
              <Alert
                key={index}
                variant={result.passed ? "success" : "destructive"}
              >
                {question.testCases && question.testCases[index].isHidden && (
                  <Badge className="mr-1">Hidden</Badge>
                )}
                <AlertTitle>
                  Test Case #{index + 1}:{" "}
                  {result.passed ? "Passed" : "Failed"}
                </AlertTitle>
                <AlertDescription>
                  {result.passed ? (
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span>Test case passed.</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <XCircleIcon className="h-4 w-4 text-red-500" />
                        <span>Test case failed.</span>
                      </div>
                      {result.actualOutput && (
                        <div className="text-xs">
                          <strong>Expected Output:</strong>
                          <pre className="bg-gray-100 p-1 rounded mt-1">
                            {question.testCases[index].output}
                          </pre>
                          <strong>Actual Output:</strong>
                          <pre className="bg-gray-100 p-1 rounded mt-1">
                            {result.actualOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CodeEditor;
