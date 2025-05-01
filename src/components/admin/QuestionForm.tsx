
import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QuestionFormProps {
  assessmentId?: string;
  questionId?: string;
}

const QuestionForm: React.FC<QuestionFormProps> = (props) => {
  // Get the assessment ID and question ID from URL parameters
  const { assessmentId: urlAssessmentId, questionId: urlQuestionId } = useParams();
  
  // Use props if provided, otherwise use URL params
  const assessmentId = props.assessmentId || urlAssessmentId;
  const questionId = props.questionId || urlQuestionId;
  
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
          <p className="text-xs mt-2 text-gray-400">Assessment ID: {assessmentId}</p>
          {questionId && <p className="text-xs mt-1 text-gray-400">Question ID: {questionId}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuestionForm;
