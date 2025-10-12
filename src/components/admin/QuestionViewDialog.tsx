
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MCQQuestion, CodingQuestion, MCQOption, CodingLanguage, CodingExample, TestCase } from '@/types/database';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

interface QuestionViewDialogProps {
  questionId: string | null;
  questionType: 'mcq' | 'code' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuestionViewDialog: React.FC<QuestionViewDialogProps> = ({
  questionId,
  questionType,
  open,
  onOpenChange,
}) => {
  const [question, setQuestion] = useState<MCQQuestion | CodingQuestion | null>(null);
  const [mcqOptions, setMcqOptions] = useState<MCQOption[]>([]);
  const [codingLanguages, setCodingLanguages] = useState<CodingLanguage[]>([]);
  const [codingExamples, setCodingExamples] = useState<CodingExample[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && questionId && questionType) {
      fetchQuestionDetails();
    }
  }, [open, questionId, questionType]);

  const fetchQuestionDetails = async () => {
    if (!questionId || !questionType) return;

    try {
      // Fetch the question details
      const { data: questionData, error: questionError } = await supabase
        .from(questionType === 'mcq' ? 'mcq_questions' : 'coding_questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (questionError) throw questionError;
      setQuestion(questionData);

      // Fetch additional details based on question type
      if (questionType === 'mcq') {
        const { data: optionsData, error: optionsError } = await supabase
          .from('mcq_options')
          .select('*')
          .eq('mcq_question_id', questionId)
          .order('order_index');

        if (optionsError) throw optionsError;
        setMcqOptions(optionsData);
      } else {
        // Fetch coding languages
        const { data: langData, error: langError } = await supabase
          .from('coding_languages')
          .select('*')
          .eq('coding_question_id', questionId);

        if (langError) throw langError;
        setCodingLanguages(langData);

        // Fetch examples
        const { data: examplesData, error: examplesError } = await supabase
          .from('coding_examples')
          .select('*')
          .eq('coding_question_id', questionId)
          .order('order_index');

        if (examplesError) throw examplesError;
        setCodingExamples(examplesData);

        // Fetch test cases
        const { data: testData, error: testError } = await supabase
          .from('test_cases')
          .select('*')
          .eq('coding_question_id', questionId)
          .order('order_index');

        if (testError) throw testError;
        setTestCases(testData);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching question details",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!question) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Question Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{question.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownRenderer content={question.description} />
              <div className="mt-4">
                <Badge>Marks: {question.marks}</Badge>
              </div>
            </CardContent>
          </Card>

          {questionType === 'mcq' && mcqOptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mcqOptions.map((option, index) => (
                    <div
                      key={option.id}
                      className={`p-3 rounded-md border ${
                        option.is_correct ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                        <span>{option.text}</span>
                        {option.is_correct && (
                          <Badge className="ml-auto" variant="outline">
                            Correct Answer
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {questionType === 'code' && (
            <>
              {codingLanguages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Supported Languages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {codingLanguages.map((lang) => (
                        <Badge key={lang.id} variant="outline">
                          {lang.coding_lang.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {codingExamples.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Examples</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {codingExamples.map((example, index) => (
                        <div key={example.id} className="space-y-2">
                          <p className="font-medium">Example {index + 1}:</p>
                          <div className="space-y-1">
                            <p>
                              <span className="font-semibold">Input:</span>{' '}
                              <code className="bg-gray-100 px-1 rounded">{example.input}</code>
                            </p>
                            <p>
                              <span className="font-semibold">Output:</span>{' '}
                              <code className="bg-gray-100 px-1 rounded">{example.output}</code>
                            </p>
                            {example.explanation && (
                              <p>
                                <span className="font-semibold">Explanation:</span>{' '}
                                {example.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {testCases.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Test Cases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {testCases.map((test, index) => (
                        <div key={test.id} className="p-3 rounded-md border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Test Case {index + 1}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Marks: {test.marks}</Badge>
                              {test.is_hidden && (
                                <Badge variant="secondary">Hidden</Badge>
                              )}
                            </div>
                          </div>
                          {!test.is_hidden && (
                            <div className="space-y-1">
                              <p>
                                <span className="font-semibold">Input:</span>{' '}
                                <code className="bg-gray-100 px-1 rounded">{test.input}</code>
                              </p>
                              <p>
                                <span className="font-semibold">Expected Output:</span>{' '}
                                <code className="bg-gray-100 px-1 rounded">{test.output}</code>
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionViewDialog;
