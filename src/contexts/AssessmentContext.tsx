import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Assessment, MCQQuestion, CodingQuestion, QuestionOption } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface MCQQuestion {
  id: string;
  assessment_id: string;
  title: string;
  description: string;
  image_url: string | null;
  marks: number;
  order_index: number;
  created_at: string;
  type?: 'mcq';
  options?: Array<QuestionOption>;
  selectedOption?: string;
}

interface CodeQuestion {
  id: string;
  assessment_id: string;
  title: string;
  description: string;
  image_url: string | null;
  marks: number;
  order_index: number;
  created_at: string;
  type?: 'code';
  examples?: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints?: string[];
  solutionTemplate?: Record<string, string>;
  userSolution?: Record<string, string>;
  testCases?: Array<{
    id: string;
    input: string;
    output: string;
    marks?: number;
    is_hidden?: boolean;
  }>;
  marksObtained?: number;
}

interface AssessmentContextType {
  assessment: Assessment | null;
  assessmentCode: string;
  loading: boolean;
  error: string | null;
  fetchAssessment: (code: string) => Promise<void>;
  assessmentStarted: boolean;
  startAssessment: () => Promise<void>;
  startTime: number | null;
  endTime: number | null;
  setStartTime: (time: number) => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answerMCQ: (questionId: string, optionId: string) => Promise<void>;
  updateCodeSolution: (questionId: string, language: string, code: string) => Promise<void>;
  updateMarksObtained: (questionId: string, marks: number, testResults?: any) => Promise<void>;
  endAssessment: () => Promise<void>;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  submissionId: string | null;
  updateSubmissionViolations: (violationType: string, violationData: any) => Promise<void>;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessmentCode, setAssessmentCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (assessment) {
      let totalObtained = 0;
      let totalPossible = 0;

      assessment.questions.forEach(question => {
        totalPossible += question.marks;

        if (question.type === 'code' && question.marksObtained !== undefined) {
          totalObtained += question.marksObtained;
        } else if (question.type === 'mcq' && question.selectedOption) {
          const selectedOption = question.options?.find(option => option.id === question.selectedOption);
          if (selectedOption && selectedOption.isCorrect) {
            totalObtained += question.marks;
          }
        }
      });

      setTotalMarksObtained(totalObtained);
      setTotalPossibleMarks(totalPossible);
    }
  }, [assessment]);

  const [totalMarksObtained, setTotalMarksObtained] = useState<number>(0);
  const [totalPossibleMarks, setTotalPossibleMarks] = useState<number>(0);

  const fetchAssessment = async (code: string) => {
    setLoading(true);
    setError(null);
    setAssessmentCode(code);

    try {
      const { data: assessments, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code)
        .single();

      if (error) {
        console.error('Error fetching assessment:', error);
        setError(error.message);
        toast({
          title: "Error",
          description: "Failed to fetch assessment details. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (!assessments) {
        setError('Assessment not found');
        toast({
          title: "Error",
          description: "Assessment not found. Please check the code and try again.",
          variant: "destructive",
        });
        return;
      }

      const assessmentId = assessments.id;

      // Fetch MCQ questions
      const { data: mcqQuestions, error: mcqError } = await supabase
        .from('mcq_questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index');

      if (mcqError) {
        console.error('Error fetching MCQ questions:', mcqError);
        setError(mcqError.message);
        toast({
          title: "Error",
          description: "Failed to fetch MCQ questions. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Fetch options for each MCQ question
      const mcqQuestionsWithOptions = await Promise.all(
        mcqQuestions.map(async (question) => {
          const { data: options, error: optionsError } = await supabase
            .from('mcq_options')
            .select('*')
            .eq('mcq_question_id', question.id)
            .order('order_index');

          if (optionsError) {
            console.error('Error fetching options for MCQ question:', optionsError);
            return { ...question, options: [] };
          }

          return { ...question, type: 'mcq', options: options };
        })
      );

      // Fetch coding questions
      const { data: codingQuestions, error: codingError } = await supabase
        .from('coding_questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index');

      if (codingError) {
        console.error('Error fetching coding questions:', codingError);
        setError(codingError.message);
        toast({
          title: "Error",
          description: "Failed to fetch coding questions. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Fetch examples for each coding question
      const codingQuestionsWithExamples = await Promise.all(
        codingQuestions.map(async (question) => {
          const { data: examples, error: examplesError } = await supabase
            .from('coding_examples')
            .select('*')
            .eq('coding_question_id', question.id)
            .order('order_index');

          if (examplesError) {
            console.error('Error fetching examples for coding question:', examplesError);
            return { ...question, examples: [] };
          }

          // Fetch test cases for each coding question
          const { data: testCases, error: testCasesError } = await supabase
            .from('test_cases')
            .select('*')
            .eq('coding_question_id', question.id)
            .order('order_index');

          if (testCasesError) {
            console.error('Error fetching test cases for coding question:', testCasesError);
            return { ...question, testCases: [] };
          }

          try {
            const solutionTemplate = JSON.parse(question.solution_template || '{}');
            return {
              ...question,
              type: 'code',
              examples: examples,
              solutionTemplate: solutionTemplate,
              userSolution: Object.keys(solutionTemplate).reduce((acc: any, key: string) => {
                acc[key] = '';
                return acc;
              }, {}),
              constraints: question.constraints ? JSON.parse(question.constraints) : [],
              testCases: testCases
            };
          } catch (parseError) {
            console.error('Error parsing solution template or constraints:', parseError);
            return {
              ...question,
              type: 'code',
              examples: examples,
              solutionTemplate: {},
              userSolution: {},
              constraints: [],
              testCases: testCases
            };
          }
        })
      );

      const questions = [...mcqQuestionsWithOptions, ...codingQuestionsWithExamples].sort((a, b) => a.order_index - b.order_index);

      setAssessment({
        ...assessments,
        questions: questions,
        mcqCount: mcqQuestions.length,
        codingCount: codingQuestions.length,
        durationMinutes: assessments.duration_minutes,
        startTime: assessments.start_time,
        isAiProctored: assessments.is_ai_proctored
      });
    } catch (err: any) {
      console.error('Error during assessment fetch:', err);
      setError(err.message || 'An unexpected error occurred');
      toast({
        title: "Error",
        description: "Failed to process assessment data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = async () => {
    if (!assessment || !user) {
      console.error('Cannot start assessment: missing assessment or user data');
      return;
    }

    try {
      // Check if there's already an active submission for this assessment
      const { data: existingSubmissions, error: fetchError } = await supabase
        .from('submissions')
        .select('id')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Error checking existing submissions:', fetchError);
        throw fetchError;
      }

      let currentSubmissionId: string;

      // If there's an active submission, use that
      if (existingSubmissions && existingSubmissions.length > 0) {
        currentSubmissionId = existingSubmissions[0].id;
        console.log('Using existing submission:', currentSubmissionId);
      } else {
        // Create a new submission record
        const { data: newSubmission, error: createError } = await supabase
          .from('submissions')
          .insert({
            assessment_id: assessment.id,
            user_id: user.id,
            started_at: new Date().toISOString(),
            fullscreen_violations: 0,
            face_violations: [],
            object_violations: []
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating submission:', createError);
          throw createError;
        }

        currentSubmissionId = newSubmission.id;
        console.log('Created new submission:', currentSubmissionId);
      }

      setSubmissionId(currentSubmissionId);
      setAssessmentStarted(true);
      setStartTime(Date.now());

    } catch (error) {
      console.error('Error starting assessment:', error);
      toast({
        title: "Error",
        description: "Failed to start assessment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateSubmissionViolations = async (violationType: string, violationData: any) => {
    if (!submissionId) {
      console.error('No submission ID available for violation update');
      return;
    }

    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          [`${violationType}_violations`]: violationData
        })
        .eq('id', submissionId);

      if (error) {
        console.error('Error updating submission violations:', error);
      }
    } catch (error) {
      console.error('Error updating submission violations:', error);
    }
  };

  const submitAnswer = async (questionId: string, answer: any, questionType: 'mcq' | 'code') => {
    if (!submissionId) {
      console.error('No submission ID available');
      return;
    }

    try {
      // Check if an answer already exists for this question
      const { data: existingSubmission, error: fetchError } = await supabase
        .from('question_submissions')
        .select('id')
        .eq('submission_id', submissionId)
        .eq('question_id', questionId)
        .single();

      const submissionData = {
        submission_id: submissionId,
        question_id: questionId,
        question_type: questionType,
        marks_obtained: answer.marks || 0,
        is_correct: answer.isCorrect || null,
        ...(questionType === 'mcq' ? { mcq_option_id: answer.optionId } : {}),
        ...(questionType === 'code' ? { 
          code_solution: answer.solution,
          language: answer.language,
          test_results: answer.testResults 
        } : {})
      };

      if (existingSubmission && !fetchError) {
        // Update existing submission
        const { error: updateError } = await supabase
          .from('question_submissions')
          .update(submissionData)
          .eq('id', existingSubmission.id);

        if (updateError) {
          console.error('Error updating question submission:', updateError);
        }
      } else {
        // Create new submission
        const { error: insertError } = await supabase
          .from('question_submissions')
          .insert(submissionData);

        if (insertError) {
          console.error('Error creating question submission:', insertError);
        }
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  };

  const answerMCQ = async (questionId: string, optionId: string) => {
    setAssessment(prevAssessment => {
      if (!prevAssessment) return prevAssessment;

      const updatedQuestions = prevAssessment.questions.map(question => {
        if (question.id === questionId && question.type === 'mcq') {
          return { ...question, selectedOption: optionId };
        }
        return question;
      });

      return { ...prevAssessment, questions: updatedQuestions };
    });
    
    // Submit the answer to database
    await submitAnswer(questionId, { optionId, isCorrect: false, marks: 0 }, 'mcq');
  };

  const updateCodeSolution = async (questionId: string, language: string, code: string) => {
    setAssessment(prevAssessment => {
      if (!prevAssessment) return prevAssessment;

      const updatedQuestions = prevAssessment.questions.map(question => {
        if (question.id === questionId && question.type === 'code') {
          return {
            ...question,
            userSolution: {
              ...question.userSolution,
              [language]: code
            }
          };
        }
        return question;
      });

      return { ...prevAssessment, questions: updatedQuestions };
    });
    
    // Auto-save the code solution
    await submitAnswer(questionId, { 
      solution: code, 
      language, 
      marks: 0,
      testResults: null 
    }, 'code');
  };

  const updateMarksObtained = async (questionId: string, marks: number, testResults?: any) => {
    setAssessment(prevAssessment => {
      if (!prevAssessment) return prevAssessment;

      const updatedQuestions = prevAssessment.questions.map(question => {
        if (question.id === questionId && question.type === 'code') {
          return { ...question, marksObtained: marks };
        }
        return question;
      });

      return { ...prevAssessment, questions: updatedQuestions };
    });
    
    const question = assessment?.questions.find(q => q.id === questionId);
    if (question && isCodeQuestion(question)) {
      await submitAnswer(questionId, {
        solution: question.userSolution[Object.keys(question.userSolution)[0]] || '',
        language: Object.keys(question.userSolution)[0] || 'python',
        marks,
        testResults
      }, 'code');
    }
  };

  const endAssessment = async () => {
    if (!assessment || !user || !submissionId) {
      console.error('Cannot end assessment: missing required data');
      return;
    }

    try {
      // Mark submission as completed
      const { error: submissionError } = await supabase
        .from('submissions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', submissionId);

      if (submissionError) {
        console.error('Error updating submission completion:', submissionError);
      }

      // Calculate total score and create result record
      const totalScore = totalMarksObtained;
      const totalMarks = totalPossibleMarks;
      const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;

      const { error: resultError } = await supabase
        .from('results')
        .insert({
          user_id: user.id,
          assessment_id: assessment.id,
          submission_id: submissionId,
          total_score: totalScore,
          total_marks: totalMarks,
          percentage: percentage,
          is_cheated: false,
          completed_at: new Date().toISOString()
        });

      if (resultError) {
        console.error('Error creating result record:', resultError);
      }

      // Reset assessment state
      setAssessmentStarted(false);
      setSubmissionId(null);
      setCurrentQuestionIndex(0);
      setStartTime(null);

    } catch (error) {
      console.error('Error ending assessment:', error);
      throw error;
    }
  };

  const value: AssessmentContextType = {
    assessment,
    assessmentCode,
    loading,
    error,
    fetchAssessment,
    assessmentStarted,
    startAssessment,
    startTime,
    endTime,
    setStartTime,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answerMCQ,
    updateCodeSolution,
    updateMarksObtained,
    endAssessment,
    totalMarksObtained,
    totalPossibleMarks,
    submissionId,
    updateSubmissionViolations,
  };

  return (
    <AssessmentContext.Provider value={value}>
      {children}
    </AssessmentContext.Provider>
  );
};

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};
