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
  loadAssessment: (code: string) => Promise<boolean>;
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

  const loadAssessment = async (code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const normalizedCode = code.trim().toUpperCase();
      console.log('Fetching assessment with normalized code:', normalizedCode);
      
      const { data: assessmentsData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', normalizedCode);
        
      if (assessmentError) {
        console.error('Error fetching assessment:', assessmentError);
        throw new Error(`Error fetching assessment data: ${assessmentError.message}`);
      }
      
      console.log('Assessment query response:', assessmentsData);
      
      if (!assessmentsData || assessmentsData.length === 0) {
        console.error(`No assessment found with code: ${normalizedCode}`);
        throw new Error(`Invalid assessment code or assessment not found: ${normalizedCode}`);
      }
      
      const assessmentData = assessmentsData[0];
      console.log('Selected assessment data:', assessmentData);
      
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });
        
      if (questionsError) {
        console.error('Failed to load questions:', questionsError);
        throw new Error(`Failed to load questions: ${questionsError.message}`);
      }
      
      console.log(`Found ${questionsData?.length || 0} questions for assessment ID:`, assessmentData.id);
      
      if (!questionsData || questionsData.length === 0) {
        console.warn('No questions found for this assessment');
      }
      
      const questions: Question[] = [];
      
      for (const questionData of questionsData || []) {
        if (questionData.type === 'mcq') {
          const { data: optionsData, error: optionsError } = await supabase
            .from('mcq_options')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (optionsError) {
            console.error('Failed to load options for question', questionData.id, optionsError);
            continue;
          }
          
          console.log(`Found ${optionsData?.length || 0} options for MCQ question ID:`, questionData.id);
          
          const mcqQuestion: MCQQuestion = {
            id: questionData.id,
            type: 'mcq',
            title: questionData.title,
            description: questionData.description,
            imageUrl: questionData.image_url,
            options: optionsData?.map(option => ({
              id: option.id,
              text: option.text,
              isCorrect: option.is_correct
            })) || [],
            marks: questionData.marks
          };
          
          questions.push(mcqQuestion);
        } else if (questionData.type === 'code') {
          const { data: codeData, error: codeError } = await supabase
            .from('coding_questions')
            .select('*')
            .eq('question_id', questionData.id)
            .single();
            
          if (codeError) {
            console.error('Failed to load coding details for question', questionData.id, codeError);
            continue;
          }
          
          const { data: examplesData, error: examplesError } = await supabase
            .from('coding_examples')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (examplesError) {
            console.error('Failed to load examples for question', questionData.id, examplesError);
            continue;
          }
          
          console.log(`Found ${examplesData?.length || 0} examples for coding question ID:`, questionData.id);
          
          const { data: testCasesData, error: testCasesError } = await supabase
            .from('test_cases')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (testCasesError) {
            console.error('Failed to load test cases for question', questionData.id, testCasesError);
            continue;
          }
          
          const solutionTemplate = codeData?.solution_template ? 
            Object.fromEntries(
              Object.entries(codeData.solution_template as Record<string, any>)
                .map(([key, value]) => [key, String(value)])
            ) : 
            {};
            
          const codeQuestion: CodeQuestion = {
            id: questionData.id,
            assessmentId: assessmentData.id,
            type: 'code',
            title: questionData.title,
            description: questionData.description,
            examples: examplesData?.map(example => ({
              input: example.input,
              output: example.output,
              explanation: example.explanation
            })) || [],
            constraints: codeData?.constraints || [],
            solutionTemplate: solutionTemplate,
            userSolution: {},
            testCases: testCasesData?.map(testCase => ({
              input: testCase.input,
              output: testCase.output
            })) || [],
            marks: questionData.marks
          };
          
          questions.push(codeQuestion);
        }
      }
      
      console.log(`Total questions processed: ${questions.length}`);
      
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
      
      console.log('Setting assessment:', loadedAssessment);
      setAssessment(loadedAssessment);
      setTimeRemaining(loadedAssessment.durationMinutes * 60);
      
      toast({
        title: "Success",
        description: `Assessment "${loadedAssessment.name}" loaded successfully`,
      });
      
      return true;
    } catch (error) {
      console.error('Error loading assessment:', error);
      setError(error instanceof Error ? error.message : 'Failed to load assessment');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to load assessment',
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = () => {
    setAssessmentStarted(true);
  };

  const endAssessment = async (): Promise<void> => {
    try {
      if (assessment && !assessmentEnded) {
        setAssessmentEnded(true);
        setAssessmentStarted(false);
        
        console.log('Assessment ended successfully');
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
  
  useEffect(() => {
    return () => {
      if (assessment && assessmentStarted && !assessmentEnded) {
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
