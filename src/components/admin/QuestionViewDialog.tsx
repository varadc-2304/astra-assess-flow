
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileCode, HelpCircle } from 'lucide-react';
import { Question, MCQOption, CodingQuestion, TestCase } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuestionViewDialogProps {
  question: Question | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuestionViewDialog: React.FC<QuestionViewDialogProps> = ({
  question,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const [mcqOptions, setMcqOptions] = useState<MCQOption[]>([]);
  const [codingDetails, setCodingDetails] = useState<CodingQuestion | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  useEffect(() => {
    if (question) {
      fetchQuestionDetails();
    }
  }, [question]);

  const fetchQuestionDetails = async () => {
    if (!question) return;

    try {
      if (question.type === 'mcq') {
        const { data: options, error: mcqError } = await supabase
          .from('mcq_options')
          .select('*')
          .eq('question_id', question.id)
          .order('order_index');

        if (mcqError) throw mcqError;
        setMcqOptions(options || []);
      } else if (question.type === 'code') {
        // Fetch coding question details
        const { data: codingData, error: codingError } = await supabase
          .from('coding_questions')
          .select('*')
          .eq('question_id', question.id)
          .single();

        if (codingError) throw codingError;
        
        // Convert solution_template from Json to Record<string, string>
        // This fixes the type error by explicitly casting the solution_template
        if (codingData) {
          const typedCodingData: CodingQuestion = {
            ...codingData,
            solution_template: codingData.solution_template as unknown as Record<string, string>
          };
          setCodingDetails(typedCodingData);
        }

        // Fetch test cases
        const { data: testCasesData, error: testCasesError } = await supabase
          .from('test_cases')
          .select('*')
          .eq('question_id', question.id)
          .order('order_index');

        if (testCasesError) throw testCasesError;
        setTestCases(testCasesData || []);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching question details",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                question.type === 'mcq'
                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200'
              }
            >
              {question.type === 'mcq' ? (
                <HelpCircle className="h-3 w-3 mr-1" />
              ) : (
                <FileCode className="h-3 w-3 mr-1" />
              )}
              {question.type.toUpperCase()}
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
          {question.type === 'mcq' && mcqOptions.length > 0 && (
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
          {question.type === 'code' && codingDetails && (
            <>
              {/* Programming Languages */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Available Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(codingDetails.solution_template).map((lang) => (
                    <Badge key={lang} variant="outline" className="capitalize">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Constraints */}
              {codingDetails.constraints && codingDetails.constraints.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Constraints</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {codingDetails.constraints.map((constraint, index) => (
                      <li key={index}>{constraint}</li>
                    ))}
                  </ul>
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
