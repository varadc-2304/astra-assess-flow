
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QuestionFormProps {
  assessmentId: string;
  questionId?: string;
}

const QuestionForm: React.FC<QuestionFormProps> = ({ assessmentId, questionId }) => {
  // This is a placeholder for now - will be implemented in a future iteration
  return (
    <Card>
      <CardHeader>
        <CardTitle>{questionId ? 'Edit Question' : 'Add New Question'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-8 text-center text-gray-500">
          <p>Question form will be implemented in the next iteration.</p>
          <p className="text-sm mt-2">This will support both MCQ and coding questions.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuestionForm;
