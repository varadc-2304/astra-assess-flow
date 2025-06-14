
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MCQQuestion } from '@/contexts/AssessmentContext';
import { useAssessment } from '@/contexts/AssessmentContext';

interface MCQQuestionCardProps {
  question: MCQQuestion;
  submissionId: string | null;
}

export const MCQQuestionCard: React.FC<MCQQuestionCardProps> = ({
  question,
  submissionId
}) => {
  const { answerMCQ } = useAssessment();

  const handleOptionChange = (optionId: string) => {
    if (submissionId) {
      answerMCQ(question.id, optionId);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div>
            <p className="text-gray-700 leading-relaxed">{question.description}</p>
            {question.imageUrl && (
              <img 
                src={question.imageUrl} 
                alt="Question illustration" 
                className="mt-4 max-w-full h-auto rounded-lg"
              />
            )}
          </div>
          
          <RadioGroup
            value={question.selectedOption || ''}
            onValueChange={handleOptionChange}
            className="space-y-3"
          >
            {question.options.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <RadioGroupItem value={option.id} id={option.id} />
                <Label 
                  htmlFor={option.id} 
                  className="text-gray-700 leading-relaxed cursor-pointer flex-1"
                >
                  {option.text}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};
