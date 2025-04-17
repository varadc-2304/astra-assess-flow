
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  marks?: number;
};

export type CodeQuestion = {
  id: string;
  assessmentId?: string;
  type: 'code';
  title: string;
  description: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints: string[];
  solutionTemplate: Record<string, string>;
  userSolution: Record<string, string>;
  testCases: Array<{
    input: string;
    output: string;
  }>;
  marks?: number;
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
  endTime?: string; // ISO string
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
  loading: boolean;
  error: string | null;
  
  setAssessmentCode: (code: string) => void;
  loadAssessment: (code: string) => Promise<void>;
  startAssessment: () => void;
  endAssessment: () => Promise<void>;
  setCurrentQuestionIndex: (index: number) => void;
  answerMCQ: (questionId: string, optionId: string) => void;
  updateCodeSolution: (questionId: string, language: string, code: string) => void;
  addFullscreenWarning: () => void;
  setTimeRemaining: (seconds: number) => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider = ({ children }: { children: ReactNode }) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [assessmentStarted, setAssessmentStarted] = useState<boolean>(false);
  const [assessmentEnded, setAssessmentEnded] = useState<boolean>(false);
  const [fullscreenWarnings, setFullscreenWarnings] = useState<number>(0);
  const [assessmentCode, setAssessmentCode] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load assessment data based on code
  const loadAssessment = async (code: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch assessment data from Supabase
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code)
        .single();
        
      if (assessmentError) {
        throw new Error('Invalid assessment code or assessment not found');
      }
      
      // Fetch questions for this assessment
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });
        
      if (questionsError) {
        throw new Error('Failed to load questions');
      }
      
      const questions: Question[] = [];
      
      // Process each question based on type
      for (const questionData of questionsData) {
        if (questionData.type === 'mcq') {
          // Fetch options for MCQ
          const { data: optionsData, error: optionsError } = await supabase
            .from('mcq_options')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (optionsError) {
            console.error('Failed to load options for question', questionData.id);
            continue;
          }
          
          const mcqQuestion: MCQQuestion = {
            id: questionData.id,
            type: 'mcq',
            title: questionData.title,
            description: questionData.description,
            imageUrl: questionData.image_url,
            options: optionsData.map(option => ({
              id: option.id,
              text: option.text,
              isCorrect: option.is_correct
            })),
            marks: questionData.marks
          };
          
          questions.push(mcqQuestion);
        } else if (questionData.type === 'code') {
          // Fetch coding question details
          const { data: codeData, error: codeError } = await supabase
            .from('coding_questions')
            .select('*')
            .eq('question_id', questionData.id)
            .single();
            
          if (codeError) {
            console.error('Failed to load coding details for question', questionData.id);
            continue;
          }
          
          // Fetch examples
          const { data: examplesData, error: examplesError } = await supabase
            .from('coding_examples')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (examplesError) {
            console.error('Failed to load examples for question', questionData.id);
            continue;
          }
          
          // Fetch test cases
          const { data: testCasesData, error: testCasesError } = await supabase
            .from('test_cases')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (testCasesError) {
            console.error('Failed to load test cases for question', questionData.id);
            continue;
          }
          
          const codeQuestion: CodeQuestion = {
            id: questionData.id,
            assessmentId: assessmentData.id,
            type: 'code',
            title: questionData.title,
            description: questionData.description,
            examples: examplesData.map(example => ({
              input: example.input,
              output: example.output,
              explanation: example.explanation
            })),
            constraints: codeData.constraints || [],
            solutionTemplate: codeData.solution_template || {},
            userSolution: {},
            testCases: testCasesData.map(testCase => ({
              input: testCase.input,
              output: testCase.output
            })),
            marks: questionData.marks
          };
          
          questions.push(codeQuestion);
        }
      }
      
      // Create assessment object
      const loadedAssessment: Assessment = {
        id: assessmentData.id,
        code: assessmentData.code,
        name: assessmentData.name,
        instructions: assessmentData.instructions || '',
        mcqCount: questions.filter(q => q.type === 'mcq').length,
        codingCount: questions.filter(q => q.type === 'code').length,
        durationMinutes: assessmentData.duration_minutes,
        startTime: assessmentData.start_time,
        endTime: assessmentData.end_time,
        questions: questions
      };
      
      setAssessment(loadedAssessment);
      
      // Set initial time remaining
      setTimeRemaining(loadedAssessment.durationMinutes * 60);
      
    } catch (error) {
      console.error('Error loading assessment:', error);
      setError(error instanceof Error ? error.message : 'Failed to load assessment');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to load assessment',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = () => {
    setAssessmentStarted(true);
  };

  const endAssessment = async () => {
    try {
      if (assessment && !assessmentEnded) {
        // Save any final state to the database here
        // For example, recording that the assessment was completed
        // and storing the final answers
        
        setAssessmentEnded(true);
        setAssessmentStarted(false);
      }
    } catch (error) {
      console.error('Error ending assessment:', error);
      toast({
        title: "Error",
        description: "There was an error finalizing your assessment. Your answers may not have been saved.",
        variant: "destructive",
      });
    }
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
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      // If assessment is still ongoing, save progress
      if (assessment && assessmentStarted && !assessmentEnded) {
        // Implement saving progress to database here
        console.log('Saving assessment progress on unmount');
      }
    };
  }, [assessment, assessmentStarted, assessmentEnded]);

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
        loading,
        error,
        
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
