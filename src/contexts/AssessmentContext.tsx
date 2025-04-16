
import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define types
export type QuestionOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type MCQQuestion = {
  id: string;
  type: 'mcq';
  title: string;
  description: string;
  imageUrl?: string;
  options: QuestionOption[];
  selectedOption?: string;
};

export type CodeQuestion = {
  id: string;
  assessmentId?: string; // Added this property
  type: 'code';
  title: string;
  description: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints: string[];
  solutionTemplate: Record<string, string>; // Language code: template
  userSolution: Record<string, string>; // Language code: user code
  testCases: Array<{
    input: string;
    output: string;
  }>;
};

export type Question = MCQQuestion | CodeQuestion;

export type Assessment = {
  id: string;
  code: string;
  name: string;
  instructions: string;
  mcqCount: number;
  codingCount: number;
  durationMinutes: number;
  startTime: string; // ISO string
  questions: Question[];
};

interface AssessmentContextType {
  assessment: Assessment | null;
  currentQuestionIndex: number;
  assessmentStarted: boolean;
  assessmentEnded: boolean;
  fullscreenWarnings: number;
  assessmentCode: string;
  timeRemaining: number;
  
  setAssessmentCode: (code: string) => void;
  loadAssessment: (code: string) => Promise<void>;
  startAssessment: () => void;
  endAssessment: () => void;
  setCurrentQuestionIndex: (index: number) => void;
  answerMCQ: (questionId: string, optionId: string) => void;
  updateCodeSolution: (questionId: string, language: string, code: string) => void;
  addFullscreenWarning: () => void;
  setTimeRemaining: (seconds: number) => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

const mockAssessment: Assessment = {
  id: "1",
  code: "TEST123",
  name: "Programming Fundamentals Assessment",
  instructions: "This assessment will test your knowledge of basic programming concepts and problem-solving abilities. Please answer all questions to the best of your ability. You may not use external resources.",
  mcqCount: 2,
  codingCount: 1,
  durationMinutes: 60,
  startTime: new Date(Date.now() + 5000).toISOString(), // 5 seconds from now for testing
  questions: [
    {
      id: "q1",
      type: "mcq",
      title: "Variables and Data Types",
      description: "Which of the following is NOT a primitive data type in JavaScript?",
      options: [
        { id: "a", text: "String", isCorrect: false },
        { id: "b", text: "Boolean", isCorrect: false },
        { id: "c", text: "Array", isCorrect: true },
        { id: "d", text: "Number", isCorrect: false }
      ]
    },
    {
      id: "q2",
      type: "mcq",
      title: "Control Flow",
      description: "What will be the output of the following code?\n\n```\nlet x = 5;\nif (x > 3) {\n  console.log('A');\n} else if (x > 10) {\n  console.log('B');\n} else {\n  console.log('C');\n}\n```",
      imageUrl: "https://placehold.co/400x200?text=Code+Example",
      options: [
        { id: "a", text: "A", isCorrect: true },
        { id: "b", text: "B", isCorrect: false },
        { id: "c", text: "C", isCorrect: false },
        { id: "d", text: "No output", isCorrect: false }
      ]
    },
    {
      id: "q3",
      type: "code",
      title: "FizzBuzz",
      description: "Write a function that returns 'Fizz' for numbers divisible by 3, 'Buzz' for numbers divisible by 5, and 'FizzBuzz' for numbers divisible by both 3 and 5. For all other numbers, return the number as a string.",
      examples: [
        {
          input: "3",
          output: "Fizz",
          explanation: "3 is divisible by 3, so we return 'Fizz'"
        },
        {
          input: "5",
          output: "Buzz",
          explanation: "5 is divisible by 5, so we return 'Buzz'"
        },
        {
          input: "15",
          output: "FizzBuzz",
          explanation: "15 is divisible by both 3 and 5, so we return 'FizzBuzz'"
        },
        {
          input: "7",
          output: "7",
          explanation: "7 is not divisible by 3 or 5, so we return the number itself as a string"
        }
      ],
      constraints: [
        "1 <= n <= 100",
        "Input is always an integer"
      ],
      solutionTemplate: {
        "python": "def fizzbuzz(n):\n    # Your code here\n    pass",
        "cpp": "#include <string>\n\nstd::string fizzbuzz(int n) {\n    // Your code here\n    return \"\";\n}",
        "java": "class Solution {\n    public String fizzbuzz(int n) {\n        // Your code here\n        return \"\";\n    }\n}",
        "c": "#include <stdlib.h>\n#include <string.h>\n\nchar* fizzbuzz(int n) {\n    // Your code here\n    return \"\";\n}"
      },
      userSolution: {
        "python": "",
        "cpp": "",
        "java": "",
        "c": ""
      },
      testCases: [
        {
          input: "3",
          output: "Fizz"
        },
        {
          input: "5",
          output: "Buzz"
        },
        {
          input: "15",
          output: "FizzBuzz"
        },
        {
          input: "7",
          output: "7"
        }
      ]
    }
  ]
};

export const AssessmentProvider = ({ children }: { children: ReactNode }) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [assessmentStarted, setAssessmentStarted] = useState<boolean>(false);
  const [assessmentEnded, setAssessmentEnded] = useState<boolean>(false);
  const [fullscreenWarnings, setFullscreenWarnings] = useState<number>(0);
  const [assessmentCode, setAssessmentCode] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Load assessment data based on code
  const loadAssessment = async (code: string) => {
    // In a real app, this would make an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (code === 'TEST123') {
      setAssessment(mockAssessment);
      
      // Set initial time remaining
      setTimeRemaining(mockAssessment.durationMinutes * 60);
      
      return;
    }
    
    throw new Error('Invalid assessment code');
  };

  const startAssessment = () => {
    setAssessmentStarted(true);
  };

  const endAssessment = () => {
    setAssessmentEnded(true);
    setAssessmentStarted(false);
  };

  const answerMCQ = (questionId: string, optionId: string) => {
    if (!assessment) return;
    
    setAssessment({
      ...assessment,
      questions: assessment.questions.map(q => {
        if (q.id === questionId && q.type === 'mcq') {
          return {
            ...q,
            selectedOption: optionId
          };
        }
        return q;
      })
    });
  };

  const updateCodeSolution = (questionId: string, language: string, code: string) => {
    if (!assessment) return;
    
    setAssessment({
      ...assessment,
      questions: assessment.questions.map(q => {
        if (q.id === questionId && q.type === 'code') {
          return {
            ...q,
            userSolution: {
              ...q.userSolution,
              [language]: code
            }
          };
        }
        return q;
      })
    });
  };

  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };

  return (
    <AssessmentContext.Provider
      value={{
        assessment,
        currentQuestionIndex,
        assessmentStarted,
        assessmentEnded,
        fullscreenWarnings,
        assessmentCode,
        timeRemaining,
        
        setAssessmentCode,
        loadAssessment,
        startAssessment,
        endAssessment,
        setCurrentQuestionIndex,
        answerMCQ,
        updateCodeSolution,
        addFullscreenWarning,
        setTimeRemaining
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
};

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};
