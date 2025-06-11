
import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Check, HelpCircle, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
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
    <div className="space-y-8">
      {/* Anti-cheating warning banner */}
      {isWarningActive && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-2xl p-6 shadow-lg animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-red-800 text-lg">Anti-cheating Warning Active</h3>
              <p className="text-red-700">Please return to assessment conditions immediately</p>
            </div>
          </div>
        </div>
      )}

      <Card className={`border-0 shadow-xl bg-white rounded-3xl overflow-hidden transition-all duration-300 ${
        isWarningActive ? 'ring-2 ring-red-300 shadow-red-100' : 'shadow-gray-100 hover:shadow-2xl'
      }`}>
        <CardContent className="p-10 space-y-8">
          {/* Question Header */}
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{question.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Multiple Choice Question</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {question.description && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors">
                        <HelpCircle className="h-5 w-5 text-gray-600" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-gray-900 text-white p-4 rounded-xl">
                      <p className="text-sm leading-relaxed">{question.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            {/* Question Image */}
            {question.imageUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                <img 
                  src={question.imageUrl} 
                  alt="Question image" 
                  className="w-full max-h-80 object-contain bg-white"
                />
              </div>
            )}
          </div>

          {/* Answer Options */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-6">Select your answer:</h4>
            <RadioGroup 
              value={question.selectedOption} 
              onValueChange={handleOptionChange}
              className="space-y-4"
            >
              {question.options.map((option, index) => (
                <div
                  key={option.id}
                  className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
                    question.selectedOption === option.id
                      ? 'border-primary bg-gradient-to-r from-primary/5 to-primary/10 shadow-lg scale-[1.02]'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4 p-6">
                    {/* Option Letter */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      question.selectedOption === option.id
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    
                    {/* Radio Button */}
                    <RadioGroupItem
                      value={option.id}
                      id={`option-${question.id}-${option.id}`}
                      className={`border-2 w-5 h-5 ${
                        question.selectedOption === option.id ? 'border-primary' : 'border-gray-300'
                      }`}
                    />
                    
                    {/* Option Text */}
                    <Label 
                      htmlFor={`option-${question.id}-${option.id}`}
                      className={`flex-grow text-lg cursor-pointer transition-all ${
                        question.selectedOption === option.id
                          ? 'text-gray-900 font-semibold'
                          : 'text-gray-700 group-hover:text-gray-900'
                      }`}
                    >
                      {option.text}
                    </Label>
                    
                    {/* Selection Indicator */}
                    {question.selectedOption === option.id && (
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg animate-scale">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Selected Option Gradient Overlay */}
                  {question.selectedOption === option.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-20 pointer-events-none"></div>
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>
          
          {/* Selection Status */}
          {question.selectedOption && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">Answer selected</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MCQQuestion;
