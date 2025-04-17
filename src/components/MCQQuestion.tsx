
import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MCQQuestion as MCQQuestionType } from '@/contexts/AssessmentContext';

interface MCQQuestionProps {
  question: MCQQuestionType;
  onAnswerSelect: (questionId: string, optionId: string) => void;
}

const MCQQuestion: React.FC<MCQQuestionProps> = ({ question, onAnswerSelect }) => {
  const handleOptionChange = (value: string) => {
    onAnswerSelect(question.id, value);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">{question.title}</h3>
        <p className="text-gray-700 whitespace-pre-line">{question.description}</p>
        
        {question.image_url && (
          <div className="my-4">
            <img 
              src={question.image_url} 
              alt={question.title} 
              className="max-w-full h-auto rounded-md border border-gray-200"
            />
          </div>
        )}
      </div>

      <RadioGroup 
        value={question.selectedOption} 
        onValueChange={handleOptionChange}
        className="space-y-3"
      >
        {question.options.map((option) => (
          <div key={option.id} className="flex items-start space-x-2">
            <RadioGroupItem value={option.id} id={`option-${question.id}-${option.id}`} />
            <Label 
              htmlFor={`option-${question.id}-${option.id}`} 
              className="text-gray-700"
            >
              {option.text}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default MCQQuestion;
