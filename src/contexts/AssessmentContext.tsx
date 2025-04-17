import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, Question as DBQuestion, Submission, Answer, TestCase } from '@/types/database';
import { MCQQuestion, CodeQuestion, Question } from '@/types/question';
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
  const [timeRemaining, setTimeRemaining] = useState(3600);
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

  const loadAssessment = async (code: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();
        
      if (assessmentError) {
        toast({
          title: "Assessment not found",
          description: "The assessment code you entered is invalid.",
          variant: "destructive",
        });
        return false;
      }
      
      setAssessment({
        ...assessmentData,
        mcqCount: 0, 
        codingCount: 0,
        questions: [],
        startTime: assessmentData.start_time,
        durationMinutes: assessmentData.duration_minutes
      });
      
      const success = await loadQuestions(assessmentData.id);
      return success;
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

  const loadQuestions = async (assessmentId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index');

      if (questionError) {
        toast({
          title: "Error loading questions",
          description: questionError.message,
          variant: "destructive",
        });
        return false;
      }

      const formattedQuestions: Question[] = [];

      for (const question of questionData) {
        if (question.type === 'mcq') {
          const { data: optionsData, error: optionsError } = await supabase
            .from('mcq_options')
            .select('*')
            .eq('question_id', question.id)
            .order('order_index');

          if (optionsError) {
            console.error("Error fetching MCQ options:", optionsError);
            continue;
          }

          const mcqQuestion: MCQQuestion = {
            id: question.id,
            type: 'mcq',
            title: question.title,
            description: question.description,
            imageUrl: question.image_url || undefined,
            options: optionsData.map(opt => ({
              id: opt.id,
              text: opt.text,
              is_correct: opt.is_correct
            })),
            marks: question.marks,
            assessmentId: question.assessment_id
          };

          formattedQuestions.push(mcqQuestion);
        } else if (question.type === 'code') {
          const { data: codingData, error: codingError } = await supabase
            .from('coding_questions')
            .select('*')
            .eq('question_id', question.id)
            .single();

          if (codingError) {
            console.error("Error fetching coding question details:", codingError);
            continue;
          }

          const { data: examplesData, error: examplesError } = await supabase
            .from('coding_examples')
            .select('*')
            .eq('question_id', question.id)
            .order('order_index');

          if (examplesError) {
            console.error("Error fetching coding examples:", examplesError);
            continue;
          }

          const codeQuestion: CodeQuestion = {
            id: question.id,
            type: 'code',
            title: question.title,
            description: question.description,
            examples: examplesData.map(ex => ({
              input: ex.input,
              output: ex.output,
              explanation: ex.explanation
            })),
            constraints: codingData.constraints || [],
            solutionTemplate: codingData.solution_template || {},
            userSolution: {},
            marks: question.marks,
            assessmentId: question.assessment_id
          };

          formattedQuestions.push(codeQuestion);
        }
      }

      setQuestions(formattedQuestions);
      
      const mcq = formattedQuestions.filter(q => q.type === 'mcq').length;
      const coding = formattedQuestions.filter(q => q.type === 'code').length;
      
      setMcqCount(mcq);
      setCodingCount(coding);
      
      if (assessment) {
        setAssessment({
          ...assessment,
          mcqCount: mcq,
          codingCount: coding
        });
      }
      
      setCurrentQuestionIndex(0);
      return true;
    } catch (error: any) {
      console.error("Error in loadQuestions:", error);
      toast({
        title: "Error loading questions",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

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

  const updateMarksObtained = (questionId: string, marks: number) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: {
        ...prevAnswers[questionId],
        marks_obtained: marks,
        is_correct: marks > 0
      }
    }));
    
    calculateTotalMarks();
  };

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

  const submitAnswer = (questionId: string, answer: Answer) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: answer,
    }));
  };

  const submitAssessment = async () => {
    if (!assessment || !answers || !user) return;
    
    try {
      setIsLoading(true);

      calculateTotalMarks();

      const percentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;

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

export type { MCQQuestion, CodeQuestion, Question };
