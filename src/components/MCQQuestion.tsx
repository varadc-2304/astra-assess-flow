
import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Check, HelpCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
    <Card className={`card-modern ${isWarningActive ? 'ring-2 ring-red-400 ring-opacity-50' : ''} overflow-hidden`}>
      {isWarningActive && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 border-b border-red-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800">Anti-cheating warning active</p>
              <p className="text-xs text-red-600">Please return to assessment conditions</p>
            </div>
          </div>
        </div>
      )}
      
      <CardContent className="p-8 space-y-8">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-2xl font-bold text-gray-900 leading-tight">{question.title}</h3>
            {question.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                      <HelpCircle className="h-5 w-5 text-gray-600" />
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
            <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-lg">
              <img 
                src={question.imageUrl} 
                alt="Question image" 
                className="max-w-full rounded-2xl object-contain max-h-80 w-full"
              />
            </div>
          )}
        </div>

        <RadioGroup 
          value={question.selectedOption} 
          onValueChange={handleOptionChange}
          className="space-y-4"
        >
          {question.options.map((option, index) => (
            <div
              key={option.id}
              className={`group relative flex items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                question.selectedOption === option.id
                  ? 'border-astra-red bg-gradient-to-r from-red-50 to-orange-50 shadow-lg shadow-red-100'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 bg-white'
              }`}
            >
              <div className={`relative flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all ${
                question.selectedOption === option.id
                  ? 'border-astra-red bg-astra-red'
                  : 'border-gray-300 group-hover:border-gray-400'
              }`}>
                <RadioGroupItem
                  value={option.id}
                  id={`option-${question.id}-${option.id}`}
                  className="opacity-0 absolute"
                />
                {question.selectedOption === option.id && (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                )}
              </div>
              
              <Label 
                htmlFor={`option-${question.id}-${option.id}`}
                className={`flex-grow text-lg cursor-pointer transition-colors ${
                  question.selectedOption === option.id
                    ? 'text-gray-900 font-semibold'
                    : 'text-gray-700 group-hover:text-gray-900'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    question.selectedOption === option.id
                      ? 'bg-astra-red text-white'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option.text}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};

export default MCQQuestion;
