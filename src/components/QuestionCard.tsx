
import React from 'react';
import { MCQQuestion, CodingQuestion } from '@/types/database';

interface QuestionCardProps {
  question: MCQQuestion | CodingQuestion;
  questionNumber: number;
  totalQuestions: number;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, questionNumber, totalQuestions }) => {
  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          Question {questionNumber} of {totalQuestions}
        </h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {question.marks} marks
        </span>
      </div>
      
      <h3 className="text-lg font-medium mb-3">{question.title}</h3>
      
      <div className="prose max-w-none mb-4">
        <p className="text-gray-700">{question.description}</p>
      </div>
      
      {question.image_url && (
        <div className="mb-4">
          <img 
            src={question.image_url} 
            alt="Question illustration" 
            className="max-w-full h-auto rounded-md border"
          />
        </div>
      )}
      
      {question.type === 'code' && (
        <div className="mt-4 space-y-4">
          {(question as CodingQuestion).examples && (question as CodingQuestion).examples!.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Examples:</h4>
              {(question as CodingQuestion).examples!.map((example, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-md mb-2">
                  <div className="mb-1">
                    <strong>Input:</strong> <code className="bg-gray-200 px-1 rounded">{example.input}</code>
                  </div>
                  <div className="mb-1">
                    <strong>Output:</strong> <code className="bg-gray-200 px-1 rounded">{example.output}</code>
                  </div>
                  {example.explanation && (
                    <div>
                      <strong>Explanation:</strong> {example.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {(question as CodingQuestion).constraints && (question as CodingQuestion).constraints!.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Constraints:</h4>
              <ul className="list-disc list-inside space-y-1">
                {(question as CodingQuestion).constraints!.map((constraint, index) => (
                  <li key={index} className="text-sm text-gray-600">{constraint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
