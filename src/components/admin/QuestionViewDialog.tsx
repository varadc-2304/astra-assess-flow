
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileCode, HelpCircle } from 'lucide-react';
import { 
  MCQQuestion, 
  CodingQuestion,
  MCQOption, 
  TestCase, 
  CodingLanguage, 
  CodingExample 
} from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [mcqQuestion, setMcqQuestion] = useState<MCQQuestion | null>(null);
  const [codingQuestion, setCodingQuestion] = useState<CodingQuestion | null>(null);
  const [mcqOptions, setMcqOptions] = useState<MCQOption[]>([]);
  const [codingLanguages, setCodingLanguages] = useState<CodingLanguage[]>([]);
  const [codingExamples, setCodingExamples] = useState<CodingExample[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  useEffect(() => {
    if (questionId && questionType && open) {
      fetchQuestionDetails();
    }
  }, [questionId, questionType, open]);

  const fetchQuestionDetails = async () => {
    if (!questionId || !questionType) return;

    try {
      if (questionType === 'mcq') {
        // Fetch MCQ question
        const { data: mcqData, error: mcqError } = await supabase
          .from('mcq_questions')
          .select('*')
          .eq('id', questionId)
          .single();

        if (mcqError) throw mcqError;
        setMcqQuestion(mcqData as MCQQuestion);
        
        // Fetch MCQ options
        const { data: options, error: optionsError } = await supabase
          .from('mcq_options')
          .select('*')
          .eq('mcq_question_id', questionId)
          .order('order_index');

        if (optionsError) throw optionsError;
        setMcqOptions(options as MCQOption[] || []);
        
      } else if (questionType === 'code') {
        // Fetch coding question
        const { data: codingData, error: codingError } = await supabase
          .from('coding_questions')
          .select('*')
          .eq('id', questionId)
          .single();

        if (codingError) throw codingError;
        setCodingQuestion(codingData as CodingQuestion);
        
        // Fetch coding languages
        const { data: languagesData, error: languagesError } = await supabase
          .from('coding_languages')
          .select('*')
          .eq('coding_question_id', questionId);

        if (languagesError) throw languagesError;
        setCodingLanguages(languagesData as CodingLanguage[] || []);
        
        // Fetch coding examples
        const { data: examplesData, error: examplesError } = await supabase
          .from('coding_examples')
          .select('*')
          .eq('coding_question_id', questionId)
          .order('order_index');

        if (examplesError) throw examplesError;
        setCodingExamples(examplesData as CodingExample[] || []);
        
        // Fetch test cases
        const { data: testCasesData, error: testCasesError } = await supabase
          .from('test_cases')
          .select('*')
          .eq('coding_question_id', questionId)
          .order('order_index');

        if (testCasesError) throw testCasesError;
        setTestCases(testCasesData as TestCase[] || []);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching question details",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!questionId || !questionType) return null;
  
  const question = questionType === 'mcq' ? mcqQuestion : codingQuestion;
  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                questionType === 'mcq'
                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200'
              }
            >
              {questionType === 'mcq' ? (
                <HelpCircle className="h-3 w-3 mr-1" />
              ) : (
                <FileCode className="h-3 w-3 mr-1" />
              )}
              {questionType.toUpperCase()}
            </Badge>
            <span>{question.title}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
            <p className="text-gray-900 whitespace-pre-line">{question.description}</p>
          </div>
          
          {/* Marks */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Marks</h3>
            <p className="text-gray-900">{question.marks} points</p>
          </div>
          
          {/* Image if present */}
          {question.image_url && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Image</h3>
              <img 
                src={question.image_url} 
                alt="Question illustration"
                className="rounded-md border border-gray-200 max-h-[200px] object-contain"
              />
            </div>
          )}

          {/* MCQ Options */}
          {questionType === 'mcq' && mcqOptions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Options</h3>
              <div className="space-y-2">
                {mcqOptions.map((option, index) => (
                  <div 
                    key={option.id}
                    className={`p-3 rounded-md border ${
                      option.is_correct 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{index + 1}.</span>
                      <span>{option.text}</span>
                      {option.is_correct && (
                        <Badge className="ml-auto bg-green-100 text-green-800">
                          Correct Answer
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coding Question Details */}
          {questionType === 'code' && (
            <>
              {/* Programming Languages */}
              {codingLanguages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Available Languages</h3>
                  <div className="flex flex-wrap gap-2">
                    {codingLanguages.map((lang) => (
                      <Badge key={lang.id} variant="outline" className="capitalize">
                        {lang.coding_lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {codingLanguages.length > 0 && codingLanguages[0].constraints && codingLanguages[0].constraints.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Constraints</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {codingLanguages[0].constraints.map((constraint, index) => (
                      <li key={index}>{constraint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Examples */}
              {codingExamples.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Examples</h3>
                  <div className="space-y-4">
                    {codingExamples.map((example, index) => (
                      <div 
                        key={example.id} 
                        className="border rounded-md p-3 space-y-2"
                      >
                        <div>
                          <p className="text-sm text-gray-500">Input:</p>
                          <pre className="mt-1 p-2 bg-gray-50 rounded-md text-sm font-mono">
                            {example.input}
                          </pre>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Output:</p>
                          <pre className="mt-1 p-2 bg-gray-50 rounded-md text-sm font-mono">
                            {example.output}
                          </pre>
                        </div>
                        {example.explanation && (
                          <div>
                            <p className="text-sm text-gray-500">Explanation:</p>
                            <p className="mt-1 text-sm">{example.explanation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Cases */}
              {testCases.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Test Cases</h3>
                  <div className="space-y-4">
                    {testCases.map((testCase, index) => (
                      <div 
                        key={testCase.id} 
                        className="border rounded-md p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Test Case {index + 1}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {testCase.is_hidden ? 'Hidden' : 'Visible'}
                            </Badge>
                            <Badge variant="outline">
                              {testCase.marks} {testCase.marks === 1 ? 'point' : 'points'}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Input:</p>
                          <pre className="mt-1 p-2 bg-gray-50 rounded-md text-sm font-mono">
                            {testCase.input}
                          </pre>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Expected Output:</p>
                          <pre className="mt-1 p-2 bg-gray-50 rounded-md text-sm font-mono">
                            {testCase.output}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionViewDialog;
