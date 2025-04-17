
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, Question, Submission, Answer, TestCase } from '@/types/database';
import { MCQQuestion, CodeQuestion } from '@/types/question';
import { useAuth } from './AuthContext';

interface AssessmentContextType {
  assessment: Assessment | null;
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
  // Add missing properties used in components
  timeRemaining: number;
  setTimeRemaining: React.Dispatch<React.SetStateAction<number>>;
  endAssessment: () => Promise<void>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  answerMCQ: (questionId: string, optionId: string) => void;
  updateCodeSolution: (questionId: string, language: string, code: string) => void;
  updateMarksObtained: (questionId: string, marks: number) => void;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  assessmentCode: string;
  setAssessmentCode: React.Dispatch<React.SetStateAction<string>>;
  loadAssessment: (code: string) => Promise<boolean>;
  assessmentStarted: boolean;
  loading: boolean;
  fullscreenWarnings: number;
  addFullscreenWarning: () => void;
  mcqCount: number;
  codingCount: number;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider = ({ children }: { children: ReactNode }) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: Answer }>({});
  const [testCases, setTestCases] = useState<{ [questionId: string]: TestCase[] }>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(3600); // 1 hour default
  const [assessmentCode, setAssessmentCode] = useState('');
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullscreenWarnings, setFullscreenWarnings] = useState(0);
  const [totalMarksObtained, setTotalMarksObtained] = useState(0);
  const [totalPossibleMarks, setTotalPossibleMarks] = useState(0);
  const [mcqCount, setMcqCount] = useState(0);
  const [codingCount, setCodingCount] = useState(0);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };

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

  // Load assessment by code
  const loadAssessment = async (code: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();
        
      if (error) {
        toast({
          title: "Assessment not found",
          description: "The assessment code you entered is invalid.",
          variant: "destructive",
        });
        return false;
      }
      
      setAssessment({
        ...data,
        // Add computed properties needed by components
        mcqCount: 0, 
        codingCount: 0,
        questions: [],
        startTime: data.start_time,
        durationMinutes: data.duration_minutes
      });
      
      await loadQuestions(data.id);
      return true;
    } catch (error: any) {
      toast({
        title: "Error loading assessment",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Start assessment by fetching assessment details and initializing submission
  const startAssessment = async (assessmentId: string) => {
    setIsLoading(true);
    try {
      // Update assessment time remaining based on duration
      if (assessment) {
        setTimeRemaining(assessment.duration_minutes * 60);
      }
      
      // Initialize submission
      if (user) {
        const { data: submissionData, error: submissionError } = await supabase
          .from('submissions')
          .insert({
            user_id: user.id,
            assessment_id: assessmentId,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (submissionError) throw submissionError;
        setSubmission(submissionData);
      }
      
      setAssessmentStarted(true);
      setCurrentQuestionIndex(0);
      setAnswers({});
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

      // Force the type to be either 'mcq' or 'code' to match our Question union type
      const typedQuestions = data.map(q => ({
        ...q,
        type: q.type === 'mcq' ? 'mcq' as const : 'code' as const
      }));
      
      // Count MCQ and coding questions
      const mcq = typedQuestions.filter(q => q.type === 'mcq').length;
      const coding = typedQuestions.filter(q => q.type === 'code').length;
      
      setMcqCount(mcq);
      setCodingCount(coding);
      setQuestions(typedQuestions);
      
      // Update assessment with computed values
      if (assessment) {
        setAssessment({
          ...assessment,
          questions: typedQuestions,
          mcqCount: mcq,
          codingCount: coding
        });
      }
      
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

  // Submit answer for MCQ questions
  const answerMCQ = (questionId: string, optionId: string) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: {
        ...prevAnswers[questionId],
        mcq_option_id: optionId,
        question_id: questionId,
        submission_id: submission?.id || '',
        marks_obtained: 0,
        is_correct: false
      }
    }));
  };

  // Submit answer for code questions
  const updateCodeSolution = (questionId: string, language: string, code: string) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: {
        ...prevAnswers[questionId],
        question_id: questionId,
        submission_id: submission?.id || '',
        code_solution: code,
        language,
        marks_obtained: prevAnswers[questionId]?.marks_obtained || 0,
        is_correct: prevAnswers[questionId]?.is_correct || false
      }
    }));
  };

  // Update marks for a question
  const updateMarksObtained = (questionId: string, marks: number) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: {
        ...prevAnswers[questionId],
        marks_obtained: marks,
        is_correct: marks > 0
      }
    }));
    
    // Update total marks obtained
    calculateTotalMarks();
  };

  // Calculate total marks
  const calculateTotalMarks = () => {
    let obtained = 0;
    let possible = 0;
    
    questions?.forEach(q => {
      possible += q.marks;
      if (answers[q.id]) {
        obtained += answers[q.id].marks_obtained || 0;
      }
    });
    
    setTotalMarksObtained(obtained);
    setTotalPossibleMarks(possible);
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

      // Calculate total score and marks
      calculateTotalMarks();

      const percentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;

      // Insert result with user details
      await supabase.from('results').insert({
        user_id: user.id,
        user_name: user.name,
        user_prn: user.prn || 'N/A',
        assessment_id: assessment.id,
        total_score: totalMarksObtained,
        total_marks: totalPossibleMarks,
        percentage: percentage,
        completed_at: new Date().toISOString()
      });

      // Update submission status
      if (submission) {
        await supabase
          .from('submissions')
          .update({
            completed_at: new Date().toISOString(),
          })
          .eq('id', submission.id);
      }

      toast({
        title: "Assessment submitted",
        description: `Your score: ${totalMarksObtained}/${totalPossibleMarks} (${percentage.toFixed(2)}%)`,
      });

      navigate('/summary');
    } catch (error) {
      console.error('Error submitting assessment:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // End the assessment (e.g. when time runs out or user exits fullscreen too many times)
  const endAssessment = async () => {
    try {
      await submitAssessment();
      setAssessmentStarted(false);
    } catch (error) {
      console.error('Error ending assessment:', error);
      navigate('/student');
    }
  };

  const resetAssessment = () => {
    setAssessment(null);
    setQuestions(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSubmission(null);
    setAssessmentStarted(false);
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
      loadTestCases,
      timeRemaining,
      setTimeRemaining,
      endAssessment,
      setCurrentQuestionIndex,
      answerMCQ,
      updateCodeSolution,
      updateMarksObtained,
      totalMarksObtained,
      totalPossibleMarks,
      assessmentCode,
      setAssessmentCode,
      loadAssessment,
      assessmentStarted,
      loading,
      fullscreenWarnings,
      addFullscreenWarning,
      mcqCount,
      codingCount
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

// Export question types
export type { MCQQuestion, CodeQuestion };
