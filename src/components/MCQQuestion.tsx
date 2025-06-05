
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
    <Card className={`border shadow-lg transition-all duration-300 ${
      isWarningActive 
        ? 'border-red-500 shadow-red-100 bg-red-50/30' 
        : 'border-gray-200 hover:border-gray-300 bg-white/90 backdrop-blur-sm hover:shadow-xl'
    }`}>
      {isWarningActive && (
        <div className="bg-red-100 border-b border-red-200 p-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <span className="text-sm font-medium text-red-800">
            Anti-cheating warning active - please return to assessment conditions
          </span>
        </div>
      )}
      <CardContent className="p-8 space-y-8">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-2xl font-semibold text-gray-900 leading-relaxed">{question.title}</h3>
            {question.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center text-gray-500 hover:text-gray-700 transition-colors">
                      <HelpCircle className="h-6 w-6" />
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
            <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img 
                src={question.imageUrl} 
                alt="Question image" 
                className="max-w-full rounded-xl object-contain max-h-80 mx-auto"
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
              className={`flex items-center gap-4 p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                question.selectedOption === option.id
                  ? 'border-astra-red bg-red-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
              }`}
            >
              <RadioGroupItem
                value={option.id}
                id={`option-${question.id}-${option.id}`}
                className="border-2 w-5 h-5"
              />
              <Label 
                htmlFor={`option-${question.id}-${option.id}`}
                className={`flex-grow text-lg cursor-pointer leading-relaxed ${
                  question.selectedOption === option.id
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-700'
                }`}
              >
                {option.text}
              </Label>
              {question.selectedOption === option.id && (
                <Check className="h-6 w-6 text-astra-red" />
              )}
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};

export default MCQQuestion;
