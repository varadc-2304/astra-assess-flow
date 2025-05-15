
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, MCQQuestion as MCQQuestionType, CodingQuestion as CodingQuestionType } from '@/types/database';

interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface MCQQuestion {
  id: string;
  assessment_id: string;
  title: string;
  description: string;
  image_url: string | null;
  marks: number;
  order_index: number;
  created_at: string;
  type: 'mcq';
  options: MCQOption[];
  selectedOption?: string;
}

export interface CodeQuestion {
  id: string;
  assessment_id: string;
  title: string;
  description: string;
  image_url: string | null;
  marks: number;
  order_index: number;
  created_at: string;
  type: 'code';
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints: string[];
  solutionTemplate: Record<string, string>;
  userSolution: Record<string, string>;
  testCases: Array<{
    id: string;
    input: string;
    output: string;
    marks?: number;
    is_hidden?: boolean;
  }>;
  marksObtained?: number;
}

interface TestResult {
  passed: boolean;
  actualOutput?: string;
  marks?: number;
  isHidden?: boolean;
}

export interface AssessmentContextType {
  assessment: Assessment & { questions: (MCQQuestion | CodeQuestion)[] } | null;
  assessmentStarted: boolean;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  startAssessment: (code: string) => Promise<boolean>;
  endAssessment: () => Promise<void>;
  answerMCQ: (questionId: string, optionId: string) => void;
  updateCodeSolution: (questionId: string, language: string, solution: string) => void;
  updateMarksObtained: (questionId: string, marks: number) => void;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  saveSubmission: (questionId: string, type: 'mcq' | 'code', data: any) => Promise<void>;
}

export const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assessment, setAssessment] = useState<Assessment & { questions: (MCQQuestion | CodeQuestion)[] } | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Recalculate total marks whenever the assessment changes
  const totalPossibleMarks = assessment?.questions?.reduce((total, q) => {
    if (q.type === 'mcq') {
      return total + q.marks;
    } else {
      return total + (q.testCases?.reduce((testTotal, testCase) => testTotal + (testCase.marks || 0), 0) || 0);
    }
  }, 0) || 0;

  const totalMarksObtained = assessment?.questions?.reduce((total, q) => {
    if (q.type === 'mcq' && q.selectedOption) {
      const option = (q as MCQQuestion).options.find(o => o.id === q.selectedOption);
      return total + (option?.isCorrect ? q.marks : 0);
    } else if (q.type === 'code') {
      return total + ((q as CodeQuestion).marksObtained || 0);
    }
    return total;
  }, 0) || 0;

  const fetchQuestionSubmissions = async (assessmentId: string, submissionId: string) => {
    try {
      // Get all question submissions for this attempt
      const { data: questionSubmissions, error } = await supabase
        .from('question_submissions')
        .select('*')
        .eq('submission_id', submissionId);
        
      if (error) {
        console.error('Error fetching question submissions:', error);
        return;
      }
      
      if (!assessment?.questions) return;
      
      // Map submissions to questions
      const updatedQuestions = [...assessment.questions].map(question => {
        const submission = questionSubmissions?.find(sub => sub.question_id === question.id);
        
        if (submission) {
          if (question.type === 'mcq' && submission.mcq_option_id) {
            return {
              ...question,
              selectedOption: submission.mcq_option_id 
            };
          } else if (question.type === 'code' && submission.code_solution) {
            return {
              ...question,
              userSolution: { 
                [submission.language || 'python']: submission.code_solution 
              },
              marksObtained: submission.marks_obtained
            };
          }
        }
        return question;
      });
      
      setAssessment(prev => prev ? { ...prev, questions: updatedQuestions } : null);
    } catch (err) {
      console.error('Error fetching question submissions:', err);
    }
  };

  const startAssessment = async (code: string): Promise<boolean> => {
    try {
      // Get assessment details
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code)
        .single();

      if (assessmentError) {
        toast({
          title: "Error",
          description: "Invalid assessment code.",
          variant: "destructive",
        });
        return false;
      }
      
      // Check if assessment is active
      const currentTime = new Date();
      const startTime = new Date(assessmentData.start_time);
      const endTime = assessmentData.end_time ? new Date(assessmentData.end_time) : null;
      const isActive = currentTime >= startTime && (!endTime || currentTime <= endTime);
      if (!isActive) {
        toast({
          title: "Error",
          description: "Assessment is not active.",
          variant: "destructive",
        });
        return false;
      }

      // Get MCQ questions
      const { data: mcqQuestions, error: mcqError } = await supabase
        .from('mcq_questions')
        .select('*, mcq_options(*)')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });
        
      if (mcqError) {
        console.error('Error fetching MCQ questions:', mcqError);
      }

      // Get coding questions
      const { data: codingQuestions, error: codingError } = await supabase
        .from('coding_questions')
        .select(`
          *,
          coding_examples(*),
          coding_languages(*),
          test_cases(*)
        `)
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });
        
      if (codingError) {
        console.error('Error fetching coding questions:', codingError);
      }

      // Format MCQ questions
      const formattedMcqQuestions: MCQQuestion[] = mcqQuestions?.map(q => ({
        id: q.id,
        assessment_id: q.assessment_id,
        title: q.title,
        description: q.description,
        image_url: q.image_url,
        marks: q.marks,
        order_index: q.order_index,
        created_at: q.created_at,
        type: 'mcq',
        options: q.mcq_options.map((opt: any) => ({
          id: opt.id,
          text: opt.text,
          isCorrect: opt.is_correct
        }))
      })) || [];

      // Format coding questions
      const formattedCodingQuestions: CodeQuestion[] = codingQuestions?.map(q => {
        const solutionTemplate: Record<string, string> = {};
        const userSolution: Record<string, string> = {};
        
        q.coding_languages.forEach((lang: any) => {
          solutionTemplate[lang.coding_lang] = lang.solution_template;
          userSolution[lang.coding_lang] = lang.solution_template;
        });
        
        return {
          id: q.id,
          assessment_id: q.assessment_id,
          title: q.title,
          description: q.description,
          image_url: q.image_url,
          marks: q.marks,
          order_index: q.order_index,
          created_at: q.created_at,
          type: 'code',
          examples: q.coding_examples.map((ex: any) => ({
            input: ex.input,
            output: ex.output,
            explanation: ex.explanation
          })),
          constraints: q.coding_languages[0]?.constraints || [],
          solutionTemplate,
          userSolution,
          testCases: q.test_cases.map((test: any) => ({
            id: test.id,
            input: test.input,
            output: test.output,
            marks: test.marks,
            is_hidden: test.is_hidden
          }))
        };
      }) || [];

      // Combine and sort all questions by order_index
      const allQuestions = [...formattedMcqQuestions, ...formattedCodingQuestions]
        .sort((a, b) => a.order_index - b.order_index);

      setAssessment({
        ...assessmentData,
        questions: allQuestions
      });

      // Check for existing submission if assessment is reattemptable
      const { data: existingSubmission, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .eq('user_id', user?.id || '')
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
        
      let currentSubmissionId;
      
      if (submissionError) {
        console.error('Error checking for existing submission:', submissionError);
      }

      // If there's an existing incomplete submission, use it
      if (existingSubmission && existingSubmission.length > 0) {
        currentSubmissionId = existingSubmission[0].id;
        setSubmissionId(currentSubmissionId);
        
        // Fetch and apply existing question submissions to restore previous answers
        await fetchQuestionSubmissions(assessmentData.id, currentSubmissionId);
      } else {
        // Create new submission record
        const { data: newSubmission, error: createError } = await supabase
          .from('submissions')
          .insert({
            assessment_id: assessmentData.id,
            user_id: user?.id,
            started_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (createError) {
          console.error('Error creating submission record:', createError);
          return false;
        }
        
        currentSubmissionId = newSubmission.id;
        setSubmissionId(currentSubmissionId);
      }

      setAssessmentStarted(true);
      setCurrentQuestionIndex(0);
      return true;
    } catch (error) {
      console.error('Error starting assessment:', error);
      toast({
        title: "Error",
        description: "Failed to start assessment.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Save question submission to database
  const saveSubmission = async (questionId: string, type: 'mcq' | 'code', data: any) => {
    if (!submissionId || !user) return;

    try {
      // Check for existing submission for this question
      const { data: existingSubmissions, error: checkError } = await supabase
        .from('question_submissions')
        .select('id')
        .eq('submission_id', submissionId)
        .eq('question_id', questionId);

      if (checkError) {
        console.error('Error checking for existing question submission:', checkError);
        return;
      }

      if (type === 'mcq') {
        const { optionId } = data;
        const question = assessment?.questions.find(q => q.id === questionId) as MCQQuestion;
        
        if (!question) return;
        
        const option = question.options.find(opt => opt.id === optionId);
        const isCorrect = option?.isCorrect || false;
        const marksObtained = isCorrect ? question.marks : 0;
        
        // Create or update submission
        if (existingSubmissions && existingSubmissions.length > 0) {
          await supabase
            .from('question_submissions')
            .update({
              mcq_option_id: optionId,
              is_correct: isCorrect,
              marks_obtained: marksObtained
            })
            .eq('id', existingSubmissions[0].id);
        } else {
          await supabase
            .from('question_submissions')
            .insert({
              submission_id: submissionId,
              question_id: questionId,
              question_type: 'mcq',
              mcq_option_id: optionId,
              is_correct: isCorrect,
              marks_obtained: marksObtained
            });
        }
      } else if (type === 'code') {
        const { language, solution, results, marks } = data;
        
        // Create or update submission
        if (existingSubmissions && existingSubmissions.length > 0) {
          await supabase
            .from('question_submissions')
            .update({
              code_solution: solution,
              language: language,
              test_results: results,
              marks_obtained: marks
            })
            .eq('id', existingSubmissions[0].id);
        } else {
          await supabase
            .from('question_submissions')
            .insert({
              submission_id: submissionId,
              question_id: questionId,
              question_type: 'code',
              code_solution: solution,
              language: language,
              test_results: results,
              marks_obtained: marks
            });
        }
      }
    } catch (error) {
      console.error('Error saving question submission:', error);
    }
  };

  const answerMCQ = (questionId: string, optionId: string) => {
    if (!assessment) return;
    
    const updatedQuestions = assessment.questions.map(q => {
      if (q.id === questionId && q.type === 'mcq') {
        saveSubmission(questionId, 'mcq', { optionId });
        return { ...q, selectedOption: optionId };
      }
      return q;
    });
    
    setAssessment({ ...assessment, questions: updatedQuestions });
  };
  
  const updateCodeSolution = (questionId: string, language: string, solution: string) => {
    if (!assessment) return;
    
    const updatedQuestions = assessment.questions.map(q => {
      if (q.id === questionId && q.type === 'code') {
        const updated = { 
          ...q, 
          userSolution: { 
            ...q.userSolution, 
            [language]: solution 
          } 
        };
        return updated;
      }
      return q;
    });
    
    setAssessment({ ...assessment, questions: updatedQuestions });
  };
  
  const updateMarksObtained = (questionId: string, marks: number) => {
    if (!assessment) return;
    
    const updatedQuestions = assessment.questions.map(q => {
      if (q.id === questionId && q.type === 'code') {
        const question = assessment.questions.find(ques => ques.id === questionId) as CodeQuestion;
        const solution = question.userSolution[Object.keys(question.userSolution)[0]];
        
        // Save code submission to database
        saveSubmission(questionId, 'code', { 
          language: Object.keys(question.userSolution)[0], 
          solution, 
          results: null,
          marks 
        });
        
        return { ...q, marksObtained: marks };
      }
      return q;
    });
    
    setAssessment({ ...assessment, questions: updatedQuestions });
  };
  
  const endAssessment = async () => {
    if (!assessment || !user || !submissionId) return;
    
    try {
      // Mark submission as completed
      await supabase
        .from('submissions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', submissionId);
      
      // Create result record
      const { data, error } = await supabase
        .from('results')
        .insert({
          user_id: user.id,
          assessment_id: assessment.id,
          submission_id: submissionId,
          total_score: totalMarksObtained,
          total_marks: totalPossibleMarks,
          percentage: totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0,
          completed_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error creating result record:', error);
      }
      
      setAssessmentStarted(false);
    } catch (error) {
      console.error('Error ending assessment:', error);
      throw error;
    }
  };
  
  return (
    <AssessmentContext.Provider value={{
      assessment,
      assessmentStarted,
      currentQuestionIndex,
      setCurrentQuestionIndex,
      startAssessment,
      endAssessment,
      answerMCQ,
      updateCodeSolution,
      updateMarksObtained,
      totalMarksObtained,
      totalPossibleMarks,
      saveSubmission
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
