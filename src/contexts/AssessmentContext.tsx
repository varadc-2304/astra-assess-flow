import React, { createContext, useContext, useState } from 'react';

// Define the Question types
export interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface MCQQuestion {
  id: string;
  type: 'mcq';
  text: string;
  options: MCQOption[];
  marks: number;
  title?: string;
  description?: string;
  imageUrl?: string;
  selectedOption?: string;
}

export interface CodeQuestion {
  id: string;
  type: 'code';
  text: string;
  starterCode?: string;
  testCases?: Array<{input: string; expectedOutput: string}>;
  language?: string; // e.g., "javascript", "python"
  marks: number;
  title?: string;
  description?: string;
  assessmentId?: string;
  solutionTemplate?: Record<string, string>;
  userSolution?: Record<string, string>;
  examples?: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints?: string[];
  marksObtained?: number;
}

export type Question = MCQQuestion | CodeQuestion;

// Define the Assessment type to match what's being used in the project
export interface Assessment {
  id: string;
  name: string;
  durationMinutes: number;
  questions?: Question[];
  code?: string;
  mcqCount?: number;
  codingCount?: number;
}

// Define the context type to include all needed states
export interface AssessmentContextType {
  assessment: Assessment | null;
  loading: boolean;
  error: string | null;
  fetchAssessment: (code: string) => Promise<boolean>; // Changed to match implementation
  assessmentStarted: boolean;
  startAssessment: () => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answerMCQ: (questionId: string, optionId: string) => void;
  updateCodeSolution: (questionId: string, solution: string, language: string) => void;
  updateMarksObtained: (questionId: string, marks: number) => void;
  endAssessment: () => void;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  timeRemaining: number;
  setTimeRemaining: (time: number) => void;
  fullscreenWarnings: number;
  addFullscreenWarning: () => void;
  loadAssessment: (code: string) => Promise<boolean>;
}

// Create the context with default values
const AssessmentContext = createContext<AssessmentContextType>({
  assessment: null,
  loading: false,
  error: null,
  fetchAssessment: async () => false, // Updated to match return type
  assessmentStarted: false,
  startAssessment: () => {},
  currentQuestionIndex: 0,
  setCurrentQuestionIndex: () => {},
  answerMCQ: () => {},
  updateCodeSolution: () => {},
  updateMarksObtained: () => {},
  endAssessment: () => {},
  totalMarksObtained: 0,
  totalPossibleMarks: 0,
  timeRemaining: 0,
  setTimeRemaining: () => {},
  fullscreenWarnings: 0,
  addFullscreenWarning: () => {},
  loadAssessment: async () => false,
});

// Provider component
export const AssessmentProvider = ({ children }: { children: React.ReactNode }) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalMarksObtained, setTotalMarksObtained] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [fullscreenWarnings, setFullscreenWarnings] = useState(0);
  
  // Calculate total possible marks
  const totalPossibleMarks = assessment?.questions?.reduce(
    (total, q) => total + q.marks, 0
  ) || 0;

  // Fetch assessment data
  const fetchAssessment = async (code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      // Mock API call - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock assessment data with proper question types
      const mockAssessment: Assessment = {
        id: '1',
        name: 'JavaScript Fundamentals',
        durationMinutes: 60,
        questions: [
          {
            id: '1',
            type: 'mcq',
            text: 'What is JavaScript?',
            title: 'JavaScript Basics',
            description: 'Choose the correct definition for JavaScript',
            options: [
              { id: '1a', text: 'A programming language', isCorrect: true },
              { id: '1b', text: 'A markup language', isCorrect: false },
              { id: '1c', text: 'A database', isCorrect: false },
              { id: '1d', text: 'An operating system', isCorrect: false }
            ],
            marks: 5
          },
          {
            id: '2',
            type: 'code',
            title: 'Addition Function',
            description: 'Write a function that adds two numbers and returns the result',
            text: 'Write a function that returns the sum of two numbers',
            starterCode: 'function add(a, b) {\n  // Your code here\n}',
            testCases: [
              { input: 'add(2, 3)', expectedOutput: '5' },
              { input: 'add(-1, 1)', expectedOutput: '0' }
            ],
            language: 'javascript',
            marks: 10,
            assessmentId: '1',
            solutionTemplate: {
              javascript: 'function add(a, b) {\n  // Your code here\n}',
              python: 'def add(a, b):\n    # Your code here\n    pass'
            },
            userSolution: {},
            examples: [
              { input: 'add(2, 3)', output: '5', explanation: 'Basic addition' },
              { input: 'add(-1, 1)', output: '0', explanation: 'Adding a negative number' }
            ],
            constraints: ['Function must be named "add"', 'Return value must be the sum of a and b']
          }
        ],
        code: code,
        mcqCount: 1,
        codingCount: 1
      };
      
      setAssessment(mockAssessment);
      // Set initial time remaining based on assessment duration
      setTimeRemaining(mockAssessment.durationMinutes * 60);
      return true;
    } catch (err) {
      console.error('Error fetching assessment:', err);
      setError('Failed to load assessment. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Alias for fetchAssessment with boolean return
  const loadAssessment = async (code: string): Promise<boolean> => {
    try {
      await fetchAssessment(code);
      return true;
    } catch (error) {
      console.error("Load assessment error:", error);
      return false;
    }
  };

  // Start assessment
  const startAssessment = () => {
    setAssessmentStarted(true);
  };

  // Answer MCQ question
  const answerMCQ = (questionId: string, optionId: string) => {
    if (assessment && assessment.questions) {
      const updatedQuestions = assessment.questions.map(q => {
        if (q.id === questionId && q.type === 'mcq') {
          return { ...q, selectedOption: optionId };
        }
        return q;
      });
      
      setAssessment({ ...assessment, questions: updatedQuestions });
    }
  };

  // Update code solution
  const updateCodeSolution = (questionId: string, solution: string, language: string) => {
    if (assessment && assessment.questions) {
      const updatedQuestions = assessment.questions.map(q => {
        if (q.id === questionId && q.type === 'code') {
          return { 
            ...q, 
            userSolution: { 
              ...q.userSolution,
              [language]: solution 
            } 
          };
        }
        return q;
      });
      
      setAssessment({ ...assessment, questions: updatedQuestions });
    }
  };

  // Update marks obtained for a question
  const updateMarksObtained = (questionId: string, marks: number) => {
    // Implementation would update marks and total
    setTotalMarksObtained(prev => prev + marks);
    console.log(`Updated marks for ${questionId}: ${marks}`);
  };

  // End assessment
  const endAssessment = () => {
    setAssessmentStarted(false);
    // Implementation would submit all answers
    console.log('Assessment ended');
  };

  // Add fullscreen warning
  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };

  const value: AssessmentContextType = {
    assessment,
    loading,
    error,
    fetchAssessment,
    assessmentStarted,
    startAssessment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answerMCQ,
    updateCodeSolution,
    updateMarksObtained,
    endAssessment,
    totalMarksObtained,
    totalPossibleMarks,
    timeRemaining,
    setTimeRemaining,
    fullscreenWarnings,
    addFullscreenWarning,
    loadAssessment
  };

  return (
    <AssessmentContext.Provider value={value}>
      {children}
    </AssessmentContext.Provider>
  );
};

// Custom hook for using the assessment context
export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};
