import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Assessment as AssessmentType } from '@/types/database';
import { MCQQuestion as MCQQuestionType, CodingQuestion as CodingQuestionType } from '@/types/database';

export interface CodeQuestion extends CodingQuestionType {
  type: 'code';
  userSolution: Record<string, string>;
}

export interface MCQQuestion extends MCQQuestionType {
  type: 'mcq';
  selectedOption?: string;
}

interface AssessmentContextType {
  assessment: AssessmentType | null;
  assessments: AssessmentType[] | null;
  assessmentStarted: boolean;
  startAssessment: (assessment?: AssessmentType) => void;
  endAssessment: () => Promise<void>;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answerMCQ: (questionId: string, optionId: string) => void;
  updateCodeSolution: (questionId: string, language: string, code: string) => void;
  updateMarksObtained: (questionId: string, marks: number) => void;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  fullscreenWarnings: number;
  addFullscreenWarning: () => void;
  loadAssessment: (code: string) => Promise<boolean>;
  assessmentCode: string | null;
  loading: boolean;
  timeRemaining: number;
  setTimeRemaining: (time: number) => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [assessment, setAssessment] = useState<AssessmentType | null>(null);
  const [assessments, setAssessments] = useState<AssessmentType[] | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [fullscreenWarnings, setFullscreenWarnings] = useState(0);
  const [totalMarksObtained, setTotalMarksObtained] = useState(0);
  const [totalPossibleMarks, setTotalPossibleMarks] = useState(0);
  const [assessmentCode, setAssessmentCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('*');

        if (error) {
          console.error('Error fetching assessments:', error);
        } else {
          setAssessments(data);
        }
      } catch (error) {
        console.error('Error fetching assessments:', error);
      }
    };

    fetchAssessments();
  }, []);

  const loadAssessment = async (code: string): Promise<boolean> => {
    setLoading(true);
    setAssessmentCode(code);
    
    try {
      const { data: assessmentData, error } = await supabase
        .from('assessments')
        .select(`
          *,
          mcq_questions(*,
            mcq_options(*)
          ),
          coding_questions(*,
            coding_languages(*),
            coding_examples(*),
            test_cases(*)
          )
        `)
        .eq('code', code.trim().toUpperCase())
        .single();

      if (error || !assessmentData) {
        setLoading(false);
        return false;
      }

      // Transform the data to match the expected format
      const transformedAssessment: AssessmentType = {
        ...assessmentData,
        questions: [
          ...(assessmentData.mcq_questions?.map((q: any) => ({
            ...q,
            type: 'mcq' as const,
            options: q.mcq_options,
          })) || []),
          ...(assessmentData.coding_questions?.map((q: any) => ({
            ...q,
            type: 'code' as const,
            solutionTemplate: q.coding_languages?.reduce((acc: any, lang: any) => {
              acc[lang.coding_lang] = lang.solution_template;
              return acc;
            }, {}) || {},
            examples: q.coding_examples || [],
            testCases: q.test_cases || [],
          })) || []),
        ].sort((a, b) => a.order_index - b.order_index),
      };

      setAssessment(transformedAssessment);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error loading assessment:', error);
      setLoading(false);
      return false;
    }
  };

  const startAssessment = (assessmentParam?: AssessmentType) => {
    const currentAssessment = assessmentParam || assessment;
    if (!currentAssessment) return;
    
    const mcqCount = currentAssessment.questions?.filter(q => q.type === 'mcq').length || 0;
    const codingCount = currentAssessment.questions?.filter(q => q.type === 'code').length || 0;
    const durationMinutes = currentAssessment.duration_minutes;
    const startTime = currentAssessment.start_time;
    
    // Set initial time remaining
    setTimeRemaining(durationMinutes * 60);

    const questions = currentAssessment.questions?.map(question => {
      if (question.type === 'mcq') {
        return {
          ...question,
          type: 'mcq',
          selectedOption: undefined,
        } as MCQQuestion;
      } else if (question.type === 'code') {
        const codeQuestion = question as CodingQuestionType;
        const solutionTemplate = codeQuestion.solutionTemplate || {};
        const userSolution: Record<string, string> = {};

        Object.keys(solutionTemplate).forEach(language => {
          userSolution[language] = solutionTemplate[language] || '';
        });

        return {
          ...question,
          type: 'code',
          userSolution: userSolution,
        } as CodeQuestion;
      }
      return question;
    }) || [];

    setAssessment({
      ...currentAssessment,
      mcqCount,
      codingCount,
      durationMinutes,
      startTime,
      questions,
    });
    setAssessmentStarted(true);
    setCurrentQuestionIndex(0);
    setTotalMarksObtained(0);
    setTotalPossibleMarks(questions.reduce((sum, question) => sum + question.marks, 0));
  };

  const answerMCQ = (questionId: string, optionId: string) => {
    if (!assessment) return;

    const updatedQuestions = assessment.questions?.map(question => {
      if (question.id === questionId && question.type === 'mcq') {
        return {
          ...question,
          selectedOption: optionId,
        };
      }
      return question;
    }) || [];

    setAssessment({
      ...assessment,
      questions: updatedQuestions,
    });
  };

  const updateCodeSolution = (questionId: string, language: string, code: string) => {
    if (!assessment) return;

    const updatedQuestions = assessment.questions?.map(question => {
      if (question.id === questionId && question.type === 'code') {
        return {
          ...question,
          userSolution: {
            ...(question as CodeQuestion).userSolution,
            [language]: code,
          },
        };
      }
      return question;
    }) || [];

    setAssessment({
      ...assessment,
      questions: updatedQuestions,
    });
  };

  const updateMarksObtained = (questionId: string, marks: number) => {
    setTotalMarksObtained(prevTotal => {
      let currentMarks = 0;
      if (assessment && assessment.questions) {
        const question = assessment.questions.find(q => q.id === questionId);
        if (question) {
          currentMarks = marks;
        }
      }
      const existingQuestion = assessment?.questions.find(q => q.id === questionId);
      const existingMarks = existingQuestion && 'marksObtained' in existingQuestion ? existingQuestion.marksObtained || 0 : 0;
      const diff = currentMarks - existingMarks;
      return prevTotal + diff;
    });

    if (!assessment) return;

    const updatedQuestions = assessment.questions?.map(question => {
      if (question.id === questionId) {
        return {
          ...question,
          marksObtained: marks,
        };
      }
      return question;
    }) || [];

    setAssessment({
      ...assessment,
      questions: updatedQuestions,
    });
  };

  const endAssessment = async () => {
    if (!assessment || !user) return;

    try {
      // First, get the existing submission to find if there's already a result
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (submissionError) {
        console.error('Error fetching submission:', submissionError);
        return;
      }

      if (!submissions || submissions.length === 0) {
        console.error('No submission found');
        return;
      }

      const currentSubmission = submissions[0];

      // Get all question submissions for this submission
      const { data: questionSubmissions, error: qsError } = await supabase
        .from('question_submissions')
        .select('*')
        .eq('submission_id', currentSubmission.id);

      if (qsError) {
        console.error('Error fetching question submissions:', qsError);
        return;
      }

      // Calculate total score from question submissions
      const calculatedTotalScore = questionSubmissions?.reduce((sum, qs) => sum + qs.marks_obtained, 0) || 0;
      const calculatedTotalMarks = totalPossibleMarks;
      const calculatedPercentage = calculatedTotalMarks > 0 
        ? Math.round((calculatedTotalScore / calculatedTotalMarks) * 100) 
        : 0;

      // Check if assessment was terminated due to violations
      const wasTerminated = currentSubmission.is_terminated || 
                           (currentSubmission.fullscreen_violations && currentSubmission.fullscreen_violations >= 2);

      // Update the submission completion time
      const { error: updateSubmissionError } = await supabase
        .from('submissions')
        .update({ 
          completed_at: new Date().toISOString() 
        })
        .eq('id', currentSubmission.id);

      if (updateSubmissionError) {
        console.error('Error updating submission:', updateSubmissionError);
      }

      // Check if result already exists for this submission
      const { data: existingResults, error: resultCheckError } = await supabase
        .from('results')
        .select('*')
        .eq('submission_id', currentSubmission.id)
        .limit(1);

      if (resultCheckError) {
        console.error('Error checking existing results:', resultCheckError);
        return;
      }

      if (existingResults && existingResults.length > 0) {
        // Update existing result
        const { error: updateResultError } = await supabase
          .from('results')
          .update({
            total_score: calculatedTotalScore,
            total_marks: calculatedTotalMarks,
            percentage: calculatedPercentage,
            completed_at: new Date().toISOString(),
            is_cheated: wasTerminated
          })
          .eq('id', existingResults[0].id);

        if (updateResultError) {
          console.error('Error updating result:', updateResultError);
        } else {
          console.log('Result updated successfully:', {
            total_score: calculatedTotalScore,
            total_marks: calculatedTotalMarks,
            percentage: calculatedPercentage,
            is_cheated: wasTerminated
          });
        }
      } else {
        // Create new result
        const { error: insertResultError } = await supabase
          .from('results')
          .insert({
            user_id: user.id,
            assessment_id: assessment.id,
            submission_id: currentSubmission.id,
            total_score: calculatedTotalScore,
            total_marks: calculatedTotalMarks,
            percentage: calculatedPercentage,
            completed_at: new Date().toISOString(),
            is_cheated: wasTerminated
          });

        if (insertResultError) {
          console.error('Error creating result:', insertResultError);
        } else {
          console.log('Result created successfully:', {
            total_score: calculatedTotalScore,
            total_marks: calculatedTotalMarks,
            percentage: calculatedPercentage,
            is_cheated: wasTerminated
          });
        }
      }

    } catch (error) {
      console.error('Error in endAssessment:', error);
    }
  };

  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };

  const value: AssessmentContextType = {
    assessment,
    assessments,
    assessmentStarted,
    startAssessment,
    endAssessment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answerMCQ,
    updateCodeSolution,
    updateMarksObtained,
    totalMarksObtained,
    totalPossibleMarks,
    fullscreenWarnings,
    addFullscreenWarning,
    loadAssessment,
    assessmentCode,
    loading,
    timeRemaining,
    setTimeRemaining,
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
