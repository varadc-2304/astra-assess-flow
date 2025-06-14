
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CodeQuestion } from '@/contexts/AssessmentContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Monaco } from '@monaco-editor/react';
import Editor from '@monaco-editor/react';
import { Play, CheckCircle, XCircle } from 'lucide-react';

interface CodingQuestionCardProps {
  question: CodeQuestion;
  submissionId: string | null;
}

export const CodingQuestionCard: React.FC<CodingQuestionCardProps> = ({
  question,
  submissionId
}) => {
  const { updateCodeSolution } = useAssessment();
  const [activeLanguage, setActiveLanguage] = useState<string>('');
  const [code, setCode] = useState<string>('');

  useEffect(() => {
    const languages = Object.keys(question.solutionTemplate);
    if (languages.length > 0 && !activeLanguage) {
      setActiveLanguage(languages[0]);
      setCode(question.userSolution?.[languages[0]] || question.solutionTemplate[languages[0]] || '');
    }
  }, [question, activeLanguage]);

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    if (submissionId && activeLanguage) {
      updateCodeSolution(question.id, activeLanguage, newCode);
    }
  };

  const handleLanguageChange = (language: string) => {
    setActiveLanguage(language);
    setCode(question.userSolution?.[language] || question.solutionTemplate[language] || '');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {question.description}
              </p>
            </div>

            {question.examples && question.examples.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Examples:</h4>
                <div className="space-y-4">
                  {question.examples.map((example, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium text-gray-700">Input:</span>
                          <pre className="text-sm bg-white p-2 rounded border mt-1">
                            {example.input}
                          </pre>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Output:</span>
                          <pre className="text-sm bg-white p-2 rounded border mt-1">
                            {example.output}
                          </pre>
                        </div>
                      </div>
                      {example.explanation && (
                        <div className="mt-3">
                          <span className="font-medium text-gray-700">Explanation:</span>
                          <p className="text-sm text-gray-600 mt-1">{example.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {question.constraints && question.constraints.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Constraints:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {question.constraints.map((constraint, index) => (
                    <li key={index} className="text-gray-700 text-sm">
                      {constraint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Code Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeLanguage} onValueChange={handleLanguageChange} className="w-full">
            <TabsList className="mb-4">
              {Object.keys(question.solutionTemplate).map((language) => (
                <TabsTrigger key={language} value={language} className="capitalize">
                  {language}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.keys(question.solutionTemplate).map((language) => (
              <TabsContent key={language} value={language}>
                <div className="border rounded-lg overflow-hidden">
                  <Editor
                    height="400px"
                    language={language === 'cpp' ? 'cpp' : language}
                    value={code}
                    onChange={handleCodeChange}
                    theme="vs-light"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {question.testCases && question.testCases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {question.testCases
                .filter(tc => !tc.is_hidden)
                .map((testCase, index) => (
                  <div key={testCase.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Test Case {index + 1}</span>
                      <Badge variant="outline">
                        {testCase.marks} {testCase.marks === 1 ? 'mark' : 'marks'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium text-gray-700">Input:</span>
                        <pre className="text-sm bg-white p-2 rounded border mt-1">
                          {testCase.input}
                        </pre>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Expected Output:</span>
                        <pre className="text-sm bg-white p-2 rounded border mt-1">
                          {testCase.output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
