
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Edit, Eye, Trash2, MoveUp, MoveDown, FileCode, HelpCircle } from 'lucide-react';

interface Question {
  id: string;
  title: string;
  type: 'mcq' | 'code';
  marks: number;
  order_index: number;
}

interface QuestionListProps {
  assessmentId: string;
}

const QuestionList: React.FC<QuestionListProps> = ({ assessmentId }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      
      // Validate and filter the data to ensure it conforms to our Question type
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

  const deleteQuestion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setQuestions(questions.filter(question => question.id !== id));
      
      toast({
        title: "Question deleted",
        description: "The question has been successfully deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting question",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const moveQuestion = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = questions.findIndex(q => q.id === id);
    if (
      (direction === 'up' && currentIndex === 0) || 
      (direction === 'down' && currentIndex === questions.length - 1)
    ) {
      return;
    }
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    try {
      // Swap order_index values
      const currentQuestion = questions[currentIndex];
      const targetQuestion = questions[newIndex];
      
      const updates = [
        {
          id: currentQuestion.id,
          order_index: targetQuestion.order_index,
        },
        {
          id: targetQuestion.id,
          order_index: currentQuestion.order_index,
        }
      ];
      
      // Update both questions
      for (const update of updates) {
        const { error } = await supabase
          .from('questions')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
          
        if (error) throw error;
      }
      
      // Update local state
      const newQuestions = [...questions];
      [newQuestions[currentIndex], newQuestions[newIndex]] = 
        [newQuestions[newIndex], newQuestions[currentIndex]];
      
      setQuestions(newQuestions);
    } catch (error: any) {
      toast({
        title: "Error reordering questions",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <p>Loading questions...</p>;
  }

  if (questions.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-md">
        <p className="text-gray-500 mb-4">No questions added yet</p>
        <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
          Start adding questions to your assessment. You can create multiple-choice questions or coding challenges.
        </p>
      </div>
    );
  }

  return (
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
                  <Button variant="ghost" size="icon" onClick={() => moveQuestion(question.id, 'up')} disabled={index === 0}>
                    <MoveUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveQuestion(question.id, 'down')} disabled={index === questions.length - 1}>
                    <MoveDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {}}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {}}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteQuestion(question.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default QuestionList;
