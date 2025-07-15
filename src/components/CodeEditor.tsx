import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, RotateCcw, Download, Upload, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CodeEditorProps {
  initialCode?: string;
  language?: string;
  onChange?: (code: string) => void;
  onLanguageChange?: (language: string) => void;
  onRun?: (code: string, language: string) => void;
  readOnly?: boolean;
  height?: string;
  testCases?: Array<{
    input: string;
    output: string;
    isHidden?: boolean;
  }>;
  questionId?: string;
  assessmentId?: string;
  userId?: string;
  autoSave?: boolean;
  showRunButton?: boolean;
  showLanguageSelector?: boolean;
  showTestCases?: boolean;
  allowDownload?: boolean;
  allowUpload?: boolean;
}

interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  isHidden?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  initialCode = '',
  language = 'python',
  onChange,
  onLanguageChange,
  onRun,
  readOnly = false,
  height = '400px',
  testCases = [],
  questionId,
  assessmentId,
  userId,
  autoSave = false,
  showRunButton = true,
  showLanguageSelector = true,
  showTestCases = true,
  allowDownload = false,
  allowUpload = false,
}) => {
  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(initialCode);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Language configurations
  const languageConfigs = {
    python: {
      id: 71,
      name: 'Python',
      template: '# Write your Python code here\n\ndef solution():\n    pass\n\n# Test your solution\nprint(solution())',
      extension: '.py'
    },
    javascript: {
      id: 63,
      name: 'JavaScript',
      template: '// Write your JavaScript code here\n\nfunction solution() {\n    // Your code here\n}\n\n// Test your solution\nconsole.log(solution());',
      extension: '.js'
    },
    java: {
      id: 62,
      name: 'Java',
      template: 'public class Main {\n    public static void main(String[] args) {\n        // Write your Java code here\n        System.out.println("Hello World");\n    }\n}',
      extension: '.java'
    },
    cpp: {
      id: 54,
      name: 'C++',
      template: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    cout << "Hello World" << endl;\n    return 0;\n}',
      extension: '.cpp'
    },
    c: {
      id: 50,
      name: 'C',
      template: '#include <stdio.h>\n\nint main() {\n    // Write your C code here\n    printf("Hello World\\n");\n    return 0;\n}',
      extension: '.c'
    }
  };

  // Save code automatically
  const saveCode = async (codeToSave: string) => {
    if (!autoSave || !questionId || !assessmentId || !userId) return;
    
    try {
      setIsSaving(true);
      const { error } = await supabase.rpc('save_user_code', {
        p_user_id: userId,
        p_assessment_id: assessmentId,
        p_question_id: questionId,
        p_language: currentLanguage,
        p_code: codeToSave
      });

      if (error) {
        console.error('Error saving code:', error);
        toast({
          title: "Save Failed",
          description: "Failed to save your code automatically",
          variant: "destructive",
        });
      } else {
        setLastSaved(new Date());
        console.log('Code saved successfully');
      }
    } catch (error) {
      console.error('Error saving code:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced save
  useEffect(() => {
    if (!autoSave) return;
    
    const timeoutId = setTimeout(() => {
      if (code !== initialCode) {
        saveCode(code);
      }
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [code, currentLanguage, autoSave, initialCode]);

  // Load saved code on mount
  useEffect(() => {
    const loadSavedCode = async () => {
      if (!questionId || !assessmentId || !userId) return;
      
      try {
        const { data, error } = await supabase
          .from('user_code_snippets')
          .select('code, language')
          .eq('user_id', userId)
          .eq('assessment_id', assessmentId)
          .eq('question_id', questionId)
          .eq('language', currentLanguage)
          .single();

        if (data && data.code && !error) {
          setCode(data.code);
          if (onChange) {
            onChange(data.code);
          }
        }
      } catch (error) {
        console.log('No saved code found or error loading:', error);
      }
    };

    loadSavedCode();
  }, [questionId, assessmentId, userId, currentLanguage]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    if (onChange) {
      onChange(newCode);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setCurrentLanguage(newLanguage);
    if (onLanguageChange) {
      onLanguageChange(newLanguage);
    }
    
    // Load template for new language if no code exists
    if (!code.trim() || code === languageConfigs[currentLanguage as keyof typeof languageConfigs]?.template) {
      const template = languageConfigs[newLanguage as keyof typeof languageConfigs]?.template || '';
      setCode(template);
      if (onChange) {
        onChange(template);
      }
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');
    setTestResults([]);

    try {
      if (testCases.length > 0) {
        // Run against test cases
        const results: TestResult[] = [];
        
        for (const testCase of testCases) {
          try {
            const response = await fetch('/api/execute', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                code,
                language: currentLanguage,
                input: testCase.input,
              }),
            });

            const result = await response.json();
            
            results.push({
              input: testCase.input,
              expectedOutput: testCase.output.trim(),
              actualOutput: result.output?.trim() || result.error || 'No output',
              passed: result.output?.trim() === testCase.output.trim(),
              isHidden: testCase.isHidden
            });
          } catch (error) {
            results.push({
              input: testCase.input,
              expectedOutput: testCase.output,
              actualOutput: 'Execution error',
              passed: false,
              isHidden: testCase.isHidden
            });
          }
        }
        
        setTestResults(results);
        
        const passedTests = results.filter(r => r.passed).length;
        setOutput(`Test Results: ${passedTests}/${results.length} tests passed`);
        
      } else {
        // Simple code execution
        const response = await fetch('/api/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            language: currentLanguage,
          }),
        });

        const result = await response.json();
        setOutput(result.output || result.error || 'No output');
      }

      if (onRun) {
        onRun(code, currentLanguage);
      }
    } catch (error) {
      setOutput('Error executing code');
      toast({
        title: "Execution Error",
        description: "Failed to execute code",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const resetCode = () => {
    const template = languageConfigs[currentLanguage as keyof typeof languageConfigs]?.template || '';
    setCode(template);
    setOutput('');
    setTestResults([]);
    if (onChange) {
      onChange(template);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Code copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy code to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solution${languageConfigs[currentLanguage as keyof typeof languageConfigs]?.extension || '.txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const uploadCode = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCode(content);
        if (onChange) {
          onChange(content);
        }
      };
      reader.readAsText(file);
    }
  };

  const editorOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    wordWrap: 'on' as const,
    automaticLayout: true,
    tabSize: 4,
    formatOnPaste: true,
    formatOnType: true,
    autoIndent: 'advanced' as const,
    bracketMatching: 'always' as const,
    autoClosingBrackets: 'always' as const,
    autoClosingQuotes: 'always' as const,
    folding: true,
    lineNumbers: 'on' as const,
    roundedSelection: false,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    lightbulb: {
      enabled: 'on' as const,
    },
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Code Editor</CardTitle>
            <div className="flex items-center gap-2">
              {autoSave && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : lastSaved ? (
                    <>Saved {lastSaved.toLocaleTimeString()}</>
                  ) : null}
                </div>
              )}
              
              {showLanguageSelector && (
                <Select value={currentLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(languageConfigs).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <Editor
              height={height}
              language={currentLanguage}
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              options={{
                ...editorOptions,
                readOnly,
              }}
              theme="vs-dark"
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {showRunButton && (
              <Button 
                onClick={runCode} 
                disabled={isRunning || readOnly}
                className="flex items-center gap-2"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isRunning ? 'Running...' : 'Run Code'}
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={resetCode} 
              disabled={readOnly}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            
            <Button 
              variant="outline" 
              onClick={copyCode}
              className="flex items-center gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            
            {allowDownload && (
              <Button 
                variant="outline" 
                onClick={downloadCode}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            )}
            
            {allowUpload && !readOnly && (
              <>
                <Button 
                  variant="outline" 
                  onClick={uploadCode}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".py,.js,.java,.cpp,.c,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </>
            )}
          </div>
          
          {output && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Output</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                  {output}
                </pre>
              </CardContent>
            </Card>
          )}
          
          {showTestCases && testResults.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Test Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {testResults.map((result, index) => (
                  !result.isHidden && (
                    <div key={index} className="border rounded p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={result.passed ? "default" : "destructive"}>
                          Test {index + 1}: {result.passed ? 'PASSED' : 'FAILED'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="font-medium text-muted-foreground">Input:</div>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {result.input}
                          </pre>
                        </div>
                        <div>
                          <div className="font-medium text-muted-foreground">Expected:</div>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {result.expectedOutput}
                          </pre>
                        </div>
                        <div>
                          <div className="font-medium text-muted-foreground">Actual:</div>
                          <pre className={`p-2 rounded text-xs overflow-x-auto ${
                            result.passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                          }`}>
                            {result.actualOutput}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )
                ))}
                
                {testResults.some(r => r.isHidden) && (
                  <div className="text-sm text-muted-foreground">
                    Some test cases are hidden and will be evaluated during submission.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CodeEditor;
