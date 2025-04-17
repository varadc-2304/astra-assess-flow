
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Assessment as AssessmentType, Question, MCQOption } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface AssessmentContextType {
  assessment: ExtendedAssessment | null;
  assessmentStarted: boolean;
  startAssessment: (assessment?: AssessmentType) => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  answerMCQ: (questionId: string, optionId: string) => Promise<void>;
  updateCodeSolution: (questionId: string, language: string, code: string) => void;
  updateMarksObtained: (questionId: string, marks: number) => void;
  endAssessment: () => Promise<void>;
  assessmentEnded: boolean;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  timeRemaining: number;
  setTimeRemaining: React.Dispatch<React.SetStateAction<number>>;
  fullscreenWarnings: number;
  addFullscreenWarning: () => void;
  assessmentCode: string | null;
  setAssessmentCode: (code: string) => void;
  loadAssessment: (code: string) => Promise<boolean>;
  loading: boolean;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

interface AssessmentProviderProps {
  children: React.ReactNode;
}

interface CodeQuestion extends Question {
  constraints: string[];
  examples: { input: string; output: string; explanation?: string }[];
  solutionTemplate: Record<string, string>;
  userSolution: Record<string, string>;
  assessment_id: string;
  marksObtained?: number;
}

interface MCQQuestion extends Omit<Question, 'image_url'> {
  options: MCQOption[];
  selectedOption?: string;
  image_url?: string | null;
  marksObtained?: number;
}

interface ExtendedAssessment extends Omit<AssessmentType, 'questions'> {
  questions: (CodeQuestion | MCQQuestion)[];
  mcqCount?: number;
  codingCount?: number;
}

export const AssessmentProvider: React.FC<AssessmentProviderProps> = ({ children }) => {
  const [assessment, setAssessment] = useState<ExtendedAssessment | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [assessmentEnded, setAssessmentEnded] = useState(false);
  const [totalMarksObtained, setTotalMarksObtained] = useState(0);
  const [totalPossibleMarks, setTotalPossibleMarks] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [fullscreenWarnings, setFullscreenWarnings] = useState(0);
  const [assessmentCode, setAssessmentCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    if (assessment) {
      const totalPossible = assessment.questions.reduce((sum, question) => sum + question.marks, 0);
      setTotalPossibleMarks(totalPossible);
      // Set time remaining based on duration_minutes
      setTimeRemaining(assessment.duration_minutes * 60);
    }
  }, [assessment]);

  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };

  const loadAssessment = async (code: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Fetch the assessment
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code)
        .single();
      
      if (assessmentError || !assessmentData) {
        console.error('Error fetching assessment:', assessmentError);
        setLoading(false);
        return false;
      }
      
      // Fetch questions for this assessment
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });
      
      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        setLoading(false);
        return false;
      }
      
      // Process and enhance questions with related data
      const enhancedQuestions = await Promise.all(questionsData.map(async (q) => {
        if (q.type === 'mcq') {
          // Fetch options for MCQ questions
          const { data: options } = await supabase
            .from('mcq_options')
            .select('*')
            .eq('question_id', q.id)
            .order('order_index', { ascending: true });
          
          return {
            ...q,
            options: options || []
          } as MCQQuestion;
        } else if (q.type === 'code') {
          // Fetch coding question details
          const { data: codingData } = await supabase
            .from('coding_questions')
            .select('*')
            .eq('question_id', q.id)
            .single();
          
          // Fetch examples for coding questions
          const { data: examples } = await supabase
            .from('coding_examples')
            .select('*')
            .eq('question_id', q.id)
            .order('order_index', { ascending: true });
          
          return {
            ...q,
            constraints: codingData?.constraints || [],
            examples: examples || [],
            solutionTemplate: codingData?.solution_template || {},
            userSolution: {}
          } as CodeQuestion;
        }
        
        return q;
      }));
      
      // Count MCQ and coding questions
      const mcqCount = enhancedQuestions.filter(q => q.type === 'mcq').length;
      const codingCount = enhancedQuestions.filter(q => q.type === 'code').length;
      
      // Create the enhanced assessment object
      const enhancedAssessment: ExtendedAssessment = {
        ...assessmentData,
        questions: enhancedQuestions,
        mcqCount,
        codingCount
      };
      
      setAssessment(enhancedAssessment);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error loading assessment:', error);
      setLoading(false);
      return false;
    }
  };

  const startAssessment = (assessmentData?: AssessmentType) => {
    if (assessmentData) {
      // If an assessment is provided, use it
      setAssessment({
        ...assessmentData,
        questions: assessment?.questions || []
      });
    }
    setAssessmentStarted(true);
    setAssessmentEnded(false);
    setCurrentQuestionIndex(0);
  };
  
  const handleAnswerMCQ = async (questionId: string, optionId: string) => {
    if (!assessment || !user) return;
    
    try {
      const { data: existingSubmission } = await supabase
        .from('submissions')
        .select('id')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .single();
      
      if (!existingSubmission) {
        throw new Error('No active submission found');
      }
      
      // Get the selected option to check if it's correct
      const { data: selectedOption } = await supabase
        .from('mcq_options')
        .select('is_correct' )
        .eq('id', optionId)
        .single();
      
      const marksObtained = selectedOption?.is_correct ? 1 : 0;
      
      // Store answer
      const answerData = {
        submission_id: existingSubmission.id,
        question_id: questionId,
        mcq_option_id: optionId,
        is_correct: selectedOption?.is_correct,
        marks_obtained: marksObtained
      };
      
      const { error: answerError } = await supabase
        .from('answers')
        .upsert(answerData, {
          onConflict: 'submission_id,question_id'
        });
      
      if (answerError) {
        console.error('Error storing MCQ answer:', answerError);
        throw answerError;
      }
      
      // Update context state
      setAssessment(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map(q => 
            q.id === questionId
              ? { ...q, selectedOption: optionId }
              : q
          )
        };
      });
    } catch (error) {
      console.error('Error saving MCQ answer:', error);
    }
  };

  const updateCodeSolution = (questionId: string, language: string, code: string) => {
    setAssessment(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: prev.questions.map(q => {
          if (q.id === questionId && q.type === 'code') {
            return {
              ...q,
              userSolution: {
                ...((q as CodeQuestion).userSolution || {}),
                [language]: code
              }
            };
          }
          return q;
        })
      };
    });
  };
  
  const updateMarksObtained = (questionId: string, marks: number) => {
    setAssessment(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: prev.questions.map(q => {
          if (q.id === questionId) {
            return {
              ...q,
              marksObtained: marks
            };
          }
          return q;
        })
      };
    });
    setTotalMarksObtained(prevTotal => prevTotal + marks);
  };

  const endAssessment = async () => {
    setAssessmentEnded(true);
    setAssessmentStarted(false);
    setCurrentQuestionIndex(0);
    navigate('/summary');
  };

  const value = {
    assessment,
    assessmentStarted,
    startAssessment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answerMCQ: handleAnswerMCQ,
    updateCodeSolution,
    updateMarksObtained,
    endAssessment,
    assessmentEnded,
    totalMarksObtained,
    totalPossibleMarks,
    timeRemaining,
    setTimeRemaining,
    fullscreenWarnings,
    addFullscreenWarning,
    assessmentCode,
    setAssessmentCode,
    loadAssessment,
    loading
  };

  return (
    <AssessmentContext.Provider value={value}>
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

export type { CodeQuestion, MCQQuestion, ExtendedAssessment };
