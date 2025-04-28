
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, FileCode, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuestionViewDialog from './QuestionViewDialog';
import { MCQQuestion, CodingQuestion } from '@/types/database';

interface QuestionListProps {
  assessmentId: string;
}

type QuestionWithType = (MCQQuestion | CodingQuestion) & { type: 'mcq' | 'code' };

const QuestionList: React.FC<QuestionListProps> = ({ assessmentId }) => {
  const [questions, setQuestions] = useState<QuestionWithType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedQuestionType, setSelectedQuestionType] = useState<'mcq' | 'code' | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestions();
  }, [assessmentId]);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      
      // Fetch MCQ questions
      const { data: mcqData, error: mcqError } = await supabase
        .from('mcq_questions')
        .select('*')
        .eq('assessment_id', assessmentId);

      if (mcqError) throw mcqError;
      
      // Fetch coding questions
      const { data: codingData, error: codingError } = await supabase
        .from('coding_questions')
        .select('*')
        .eq('assessment_id', assessmentId);

      if (codingError) throw codingError;
      
      // Combine and format the questions
      const mcqQuestions: QuestionWithType[] = (mcqData || []).map(q => ({ 
        ...q, 
        type: 'mcq' as const 
      }));
      
      const codingQuestions: QuestionWithType[] = (codingData || []).map(q => ({ 
        ...q, 
        type: 'code' as const 
      }));
      
      const allQuestions = [...mcqQuestions, ...codingQuestions].sort((a, b) => a.order_index - b.order_index);
      
      setQuestions(allQuestions);
    } catch (error: any) {
      toast({
        title: "Error fetching questions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewQuestion = (id: string, type: 'mcq' | 'code') => {
    setSelectedQuestionId(id);
    setSelectedQuestionType(type);
    setDialogOpen(true);
  };

  if (isLoading) {
    return <p>Loading questions...</p>;
  }

  if (questions.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-md">
        <p className="text-gray-500">No questions found</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-24 text-center">Marks</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question, index) => (
              <TableRow key={question.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-medium">{question.title}</TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="text-center">{question.marks}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleViewQuestion(question.id, question.type)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <QuestionViewDialog
        questionId={selectedQuestionId}
        questionType={selectedQuestionType}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};

export default QuestionList;
