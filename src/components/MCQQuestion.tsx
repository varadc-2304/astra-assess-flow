
import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Check, HelpCircle, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MCQQuestion as MCQQuestionType } from '@/contexts/AssessmentContext';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

interface MCQQuestionProps {
  question: MCQQuestionType;
  onAnswerSelect: (questionId: string, optionId: string) => void;
  isWarningActive?: boolean;
}

const MCQQuestion: React.FC<MCQQuestionProps> = ({ 
  question, 
  onAnswerSelect,
  isWarningActive = false 
}) => {
  const handleOptionChange = (value: string) => {
    onAnswerSelect(question.id, value);
  };

  return (
    <Card className={`border ${isWarningActive ? 'border-red-500 shadow-red-100' : 'border-gray-200'} shadow-sm hover:shadow-md transition-shadow duration-200`}>
      {isWarningActive && (
        <div className="bg-red-50 p-2 flex items-center gap-2 border-b border-red-200">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-sm font-medium text-red-700">
            Anti-cheating warning active - please return to assessment conditions
          </span>
        </div>
      )}
      <CardContent className="p-6 space-y-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-semibold text-gray-800">{question.title}</h3>
            {question.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center text-gray-500 hover:text-gray-700 transition-colors">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-lg p-4">
                    <MarkdownRenderer content={question.description} />
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {question.imageUrl && (
            <div className="relative rounded-lg overflow-hidden border border-gray-200">
              <img 
                src={question.imageUrl} 
                alt="Question image" 
                className="max-w-full rounded-md object-contain max-h-64"
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
