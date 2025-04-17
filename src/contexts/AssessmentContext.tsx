import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Assessment as AssessmentType, Question, Submission, Answer, TestCase } from '@/types/database';

interface AssessmentContextType {
  assessment: AssessmentType | null;
  questions: Question[] | null;
  currentQuestionIndex: number;
  answers: { [questionId: string]: Answer };
  testCases: { [questionId: string]: TestCase[] };
  submission: Submission | null;
  isLoading: boolean;
  startAssessment: (assessmentId: string) => Promise<void>;
  loadQuestions: (assessmentId: string) => Promise<void>;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;
  submitAnswer: (questionId: string, answer: Answer) => void;
  submitAssessment: () => Promise<void>;
  resetAssessment: () => void;
  loadTestCases: (questionId: string) => Promise<void>;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider = ({ children }: { children: ReactNode }) => {
  const [assessment, setAssessment] = useState<AssessmentType | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: Answer }>({});
  const [testCases, setTestCases] = useState<{ [questionId: string]: TestCase[] }>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Load test cases for a given question
  const loadTestCases = async (questionId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('test_cases')
        .select('*')
        .eq('question_id', questionId)
        .order('order_index');

      if (error) throw error;

      setTestCases(prevTestCases => ({
        ...prevTestCases,
        [questionId]: data || []
      }));
    } catch (error: any) {
      toast({
        title: "Error loading test cases",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Start assessment by fetching assessment details and initializing submission
  const startAssessment = async (assessmentId: string) => {
    setIsLoading(true);
    try {
      // Fetch assessment details
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (assessmentError) throw assessmentError;
      if (!assessmentData) throw new Error('Assessment not found');

      setAssessment(assessmentData);

      // Initialize submission
      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          user_id: user?.id,
          assessment_id: assessmentId,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      setSubmission(submissionData);
      setCurrentQuestionIndex(0);
      setAnswers({});

      navigate('/instructions');
    } catch (error: any) {
      toast({
        title: "Error starting assessment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load questions for the assessment
  const loadQuestions = async (assessmentId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index');

      if (error) throw error;

      setQuestions(data || []);
      setCurrentQuestionIndex(0);
    } catch (error: any) {
      toast({
        title: "Error loading questions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation functions
  const goToNextQuestion = () => {
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Submit answer for the current question
  const submitAnswer = (questionId: string, answer: Answer) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: answer,
    }));
  };

  // Submit the entire assessment
  const submitAssessment = async () => {
    if (!assessment || !answers || !user) return;
    
    try {
      setIsLoading(true);

      let totalScore = 0;
      let totalMarks = 0;

      // Calculate total score and marks
      for (const question of questions || []) {
        totalMarks += question.marks;
        const answer = answers[question.id];

        if (answer) {
          totalScore += answer.marks_obtained || 0;
        }
      }

      const percentage = (totalScore / totalMarks) * 100;

      // Insert result with user details
      await supabase.from('results').insert({
        user_id: user.id,
        user_name: user.name,
        user_prn: user.prn || 'N/A',
        assessment_id: assessment.id,
        total_score: totalScore,
        total_marks: totalMarks,
        percentage: percentage,
        completed_at: new Date().toISOString()
      });

      // Update submission status
      await supabase
        .from('submissions')
        .update({
          completed_at: new Date().toISOString(),
        })
        .eq('id', submission?.id);

      toast({
        title: "Assessment submitted",
        description: `Your score: ${totalScore}/${totalMarks} (${percentage.toFixed(2)}%)`,
      });

      navigate('/summary');
    } catch (error) {
      console.error('Error submitting assessment:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resetAssessment = () => {
    setAssessment(null);
    setQuestions(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSubmission(null);
  };

  return (
    <AssessmentContext.Provider value={{
      assessment,
      questions,
      currentQuestionIndex,
      answers,
      testCases,
      submission,
      isLoading,
      startAssessment,
      loadQuestions,
      goToNextQuestion,
      goToPreviousQuestion,
      submitAnswer,
      submitAssessment,
      resetAssessment,
      loadTestCases
    }}>
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

import { useAuth } from './AuthContext';
