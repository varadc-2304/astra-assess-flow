
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, FileCode, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Question } from '@/types/database';
import QuestionViewDialog from './QuestionViewDialog';

interface QuestionListProps {
  assessmentId: string;
}

const QuestionList: React.FC<QuestionListProps> = ({ assessmentId }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestions();
  }, [assessmentId]);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      
      const validQuestions = (data || []).filter(
        question => question.type === 'mcq' || question.type === 'code'
      ) as Question[];
      
      setQuestions(validQuestions);
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

  const handleViewQuestion = (question: Question) => {
    setSelectedQuestion(question);
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
                      onClick={() => handleViewQuestion(question)}
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
        question={selectedQuestion}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};

export default QuestionList;
