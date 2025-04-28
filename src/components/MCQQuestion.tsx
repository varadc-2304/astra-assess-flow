
import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Check, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MCQQuestion as MCQQuestionType } from '@/contexts/AssessmentContext';

interface MCQQuestionProps {
  question: MCQQuestionType;
  onAnswerSelect: (optionId: string) => void;
}

const MCQQuestion: React.FC<MCQQuestionProps> = ({ question, onAnswerSelect }) => {
  const handleOptionChange = (value: string) => {
    onAnswerSelect(value);
  };

  return (
    <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6 space-y-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-semibold text-gray-800">{question.title}</h3>
            {question.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center text-gray-500 hover:text-gray-700">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">{question.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {question.imageUrl && (
            <div className="relative rounded-lg overflow-hidden border border-gray-200">
              <img 
                src={question.imageUrl} 
                alt={question.title} 
                className="w-full h-auto object-cover"
              />
            </div>
          )}
        </div>

        <RadioGroup 
          value={question.selectedOption} 
          onValueChange={handleOptionChange}
          className="space-y-4"
        >
          {question.options.map((option) => (
            <div
              key={option.id}
              className={`flex items-center gap-3 p-4 rounded-lg border ${
                question.selectedOption === option.id
                  ? 'border-astra-red bg-red-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } transition-all duration-200`}
            >
              <RadioGroupItem
                value={option.id}
                id={`option-${question.id}-${option.id}`}
                className="border-2"
              />
              <Label 
                htmlFor={`option-${question.id}-${option.id}`}
                className={`flex-grow text-base ${
                  question.selectedOption === option.id
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-700'
                }`}
              >
                {option.text}
              </Label>
              {question.selectedOption === option.id && (
                <Check className="h-5 w-5 text-astra-red" />
              )}
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};

export default MCQQuestion;
