import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Assessment as AssessmentType, Question, MCQOption } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface AssessmentContextType {
  assessment: AssessmentType | null;
  assessmentStarted: boolean;
  startAssessment: (assessment: AssessmentType) => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  answerMCQ: (questionId: string, optionId: string) => Promise<void>;
  updateCodeSolution: (questionId: string, language: string, code: string) => void;
  updateMarksObtained: (questionId: string, marks: number) => void;
  endAssessment: () => Promise<void>;
  assessmentEnded: boolean;
  totalMarksObtained: number;
  totalPossibleMarks: number;
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
}

interface MCQQuestion extends Question {
  options: MCQOption[];
  selectedOption?: string;
}

interface Assessment extends AssessmentType {
  questions: (CodeQuestion | MCQQuestion)[];
}

export const AssessmentProvider: React.FC<AssessmentProviderProps> = ({ children }) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [assessmentEnded, setAssessmentEnded] = useState(false);
  const [totalMarksObtained, setTotalMarksObtained] = useState(0);
  const [totalPossibleMarks, setTotalPossibleMarks] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    if (assessment) {
      const totalPossible = assessment.questions.reduce((sum, question) => sum + question.marks, 0);
      setTotalPossibleMarks(totalPossible);
    }
  }, [assessment]);

  const startAssessment = (assessment: AssessmentType) => {
    setAssessment({
      ...assessment,
      questions: assessment.questions.sort((a, b) => a.order_index - b.order_index)
    });
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
          if (q.id === questionId) {
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
    totalPossibleMarks
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

export type { CodeQuestion, MCQQuestion };
