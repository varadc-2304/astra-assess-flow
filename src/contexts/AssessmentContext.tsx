
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Assessment as DBAssessment, 
  MCQQuestion as DBMCQQuestion,
  CodingQuestion as DBCodingQuestion,
  MCQOption,
  CodingLanguage,
  CodingExample,
  TestCase,
  Json
} from '@/types/database';

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
  assessmentId?: string;
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
    id: string;
    input: string;
    output: string;
    marks?: number;
    is_hidden?: boolean;
  }>;
  marks?: number;
  marksObtained?: number;
};

export type Question = MCQQuestion | CodeQuestion;

// Update interface to match Assessment properties correctly
export interface AssessmentWithQuestions {
  id: string;
  name: string;
  code: string;
  status: string;
  reattempt: boolean;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  created_at: string;
  created_by?: string;
  instructions?: string;
  questions: Question[];
  mcqCount: number;
  codingCount: number;
}

interface AssessmentContextType {
  assessment: AssessmentWithQuestions | null;
  currentQuestionIndex: number;
  assessmentStarted: boolean;
  assessmentEnded: boolean;
  fullscreenWarnings: number;
  assessmentCode: string;
  timeRemaining: number;
  loading: boolean;
  error: string | null;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  
  setAssessmentCode: (code: string) => void;
  loadAssessment: (code: string) => Promise<boolean>;
  startAssessment: () => void;
  endAssessment: () => Promise<boolean>;
  setCurrentQuestionIndex: (index: number) => void;
  answerMCQ: (questionId: string, optionId: string) => void;
  updateCodeSolution: (questionId: string, language: string, code: string) => void;
  updateMarksObtained: (questionId: string, marks: number) => void;
  addFullscreenWarning: () => void;
  setTimeRemaining: (seconds: number) => void;
  checkReattemptAvailability: (assessmentId: string) => Promise<boolean>;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider = ({ children }: { children: ReactNode }) => {
  const [assessment, setAssessment] = useState<AssessmentWithQuestions | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [assessmentStarted, setAssessmentStarted] = useState<boolean>(false);
  const [assessmentEnded, setAssessmentEnded] = useState<boolean>(false);
  const [fullscreenWarnings, setFullscreenWarnings] = useState<number>(0);
  const [assessmentCode, setAssessmentCode] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalMarksObtained, setTotalMarksObtained] = useState<number>(0);
  const [totalPossibleMarks, setTotalPossibleMarks] = useState<number>(0);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Create a safe version of navigate that works even outside of router context
  const navigate = typeof window !== "undefined" 
    ? useNavigate() 
    : ((_: string) => {});

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
      
      // Fetch MCQ Questions
      const { data: mcqQuestionsData, error: mcqQuestionsError } = await supabase
        .from('mcq_questions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });
        
      if (mcqQuestionsError) {
        console.error('Failed to load MCQ questions:', mcqQuestionsError);
        throw new Error(`Failed to load MCQ questions: ${mcqQuestionsError.message}`);
      }
      
      // Fetch Coding Questions
      const { data: codingQuestionsData, error: codingQuestionsError } = await supabase
        .from('coding_questions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });
        
      if (codingQuestionsError) {
        console.error('Failed to load coding questions:', codingQuestionsError);
        throw new Error(`Failed to load coding questions: ${codingQuestionsError.message}`);
      }
      
      console.log(`Found ${mcqQuestionsData?.length || 0} MCQ questions and ${codingQuestionsData?.length || 0} coding questions`);
      
      const questions: Question[] = [];
      let totalPossibleMarks = 0;
      
      // Process MCQ Questions
      for (const mcqQuestion of mcqQuestionsData || []) {
        totalPossibleMarks += mcqQuestion.marks || 0;
        
        const { data: optionsData, error: optionsError } = await supabase
          .from('mcq_options')
          .select('*')
          .eq('mcq_question_id', mcqQuestion.id)
          .order('order_index', { ascending: true });
          
        if (optionsError) {
          console.error('Failed to load options for question', mcqQuestion.id, optionsError);
          continue;
        }
        
        console.log(`Found ${optionsData?.length || 0} options for MCQ question ID:`, mcqQuestion.id);
        
        const question: MCQQuestion = {
          id: mcqQuestion.id,
          type: 'mcq',
          title: mcqQuestion.title,
          description: mcqQuestion.description,
          imageUrl: mcqQuestion.image_url || undefined,
          options: optionsData?.map(option => ({
            id: option.id,
            text: option.text,
            isCorrect: option.is_correct
          })) || [],
          marks: mcqQuestion.marks,
          assessmentId: mcqQuestion.assessment_id
        };
        
        questions.push(question);
      }
      
      // Process Coding Questions
      for (const codingQuestion of codingQuestionsData || []) {
        // Get coding languages
        const { data: languagesData, error: languagesError } = await supabase
          .from('coding_languages')
          .select('*')
          .eq('coding_question_id', codingQuestion.id);

        if (languagesError) {
          console.error('Failed to load languages for coding question', codingQuestion.id, languagesError);
          continue;
        }
        
        // Get coding examples
        const { data: examplesData, error: examplesError } = await supabase
          .from('coding_examples')
          .select('*')
          .eq('coding_question_id', codingQuestion.id)
          .order('order_index', { ascending: true });

        if (examplesError) {
          console.error('Failed to load examples for coding question', codingQuestion.id, examplesError);
          continue;
        }

        // Get test cases
        const { data: testCasesData, error: testCasesError } = await supabase
          .from('test_cases')
          .select('*')
          .eq('coding_question_id', codingQuestion.id)
          .order('order_index', { ascending: true });

        if (testCasesError) {
          console.error('Failed to load test cases for coding question', codingQuestion.id, testCasesError);
          continue;
        }

        // Calculate total marks from test cases
        const testCaseMarks = testCasesData?.reduce((sum, tc) => sum + (tc.marks || 0), 0) || 0;
        totalPossibleMarks += testCaseMarks;
        
        // Create solution template object
        const solutionTemplate: Record<string, string> = {};
        languagesData?.forEach((lang) => {
          solutionTemplate[lang.coding_lang] = lang.solution_template;
        });
        
        // Get constraints from the first language (they should be the same for all languages)
        const constraints = languagesData && languagesData.length > 0 
          ? languagesData[0].constraints || [] 
          : [];

        // Create the coding question
        const question: CodeQuestion = {
          id: codingQuestion.id,
          assessmentId: codingQuestion.assessment_id,
          type: 'code',
          title: codingQuestion.title,
          description: codingQuestion.description,
          examples: examplesData?.map(example => ({
            input: example.input,
            output: example.output,
            explanation: example.explanation || undefined,
          })) || [],
          constraints: constraints,
          solutionTemplate,
          userSolution: {},
          testCases: testCasesData?.map(testCase => ({
            id: testCase.id,
            input: testCase.input,
            output: testCase.output,
            marks: testCase.marks,
            is_hidden: testCase.is_hidden,
          })) || [],
          marks: testCaseMarks,
        };

        questions.push(question);
      }
      
      console.log(`Total questions processed: ${questions.length}`);
      console.log(`Total possible marks: ${totalPossibleMarks}`);
      
      // Sort all questions by their order index
      const allQuestions = questions.sort((a, b) => {
        const orderA = a.type === 'mcq' 
          ? mcqQuestionsData?.find(q => q.id === a.id)?.order_index || 0
          : codingQuestionsData?.find(q => q.id === a.id)?.order_index || 0;
        
        const orderB = b.type === 'mcq'
          ? mcqQuestionsData?.find(q => q.id === b.id)?.order_index || 0
          : codingQuestionsData?.find(q => q.id === b.id)?.order_index || 0;
          
        return orderA - orderB;
      });
      
      const loadedAssessment: AssessmentWithQuestions = {
        ...assessmentData,
        questions: allQuestions,
        mcqCount: mcqQuestionsData?.length || 0,
        codingCount: codingQuestionsData?.length || 0
      };
      
      console.log('Setting assessment:', loadedAssessment);
      setAssessment(loadedAssessment);
      setTotalPossibleMarks(totalPossibleMarks);
      setTimeRemaining(loadedAssessment.duration_minutes * 60);
      
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

  const endAssessment = async (): Promise<boolean> => {
    try {
      if (assessment && !assessmentEnded && user) {
        setAssessmentEnded(true);
        setAssessmentStarted(false);
        
        console.log('Assessment ended successfully');
        console.log(`Total marks obtained: ${totalMarksObtained}/${totalPossibleMarks}`);
        
        const { data: submissions, error: submissionError } = await supabase
          .from('submissions')
          .select('*')
          .eq('assessment_id', assessment.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (submissionError || !submissions || submissions.length === 0) {
          console.error('Error finding submission to update:', submissionError);
          
          // Create a new submission if none exists
          const { data: newSubmission, error: newSubmissionError } = await supabase
            .from('submissions')
            .insert({
              assessment_id: assessment.id,
              user_id: user.id,
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              fullscreen_violations: fullscreenWarnings
            })
            .select()
            .single();
            
          if (newSubmissionError) {
            console.error('Error creating submission:', newSubmissionError);
            toast({
              title: "Error",
              description: "There was an error creating your submission.",
              variant: "destructive",
            });
            return false;
          }
        } else {
          const { error: updateError } = await supabase
            .from('submissions')
            .update({ 
              completed_at: new Date().toISOString(),
              fullscreen_violations: fullscreenWarnings
            })
            .eq('id', submissions[0].id);
            
          if (updateError) {
            console.error('Error updating submission:', updateError);
            toast({
              title: "Error",
              description: "There was an error updating your submission.",
              variant: "destructive",
            });
            return false;
          }
        }
        
        const percentage = totalPossibleMarks > 0
          ? Math.round((totalMarksObtained / totalPossibleMarks) * 100)
          : 0;
        
        // Get the latest submission for this assessment
        const { data: latestSubmission, error: latestSubmissionError } = await supabase
          .from('submissions')
          .select('*')
          .eq('assessment_id', assessment.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (latestSubmissionError) {
          console.error('Error finding latest submission:', latestSubmissionError);
          return false;
        }
        
        const { error: resultError } = await supabase
          .from('results')
          .insert({
            user_id: user.id,
            assessment_id: assessment.id,
            submission_id: latestSubmission.id,
            total_score: totalMarksObtained,
            total_marks: totalPossibleMarks,
            percentage: percentage,
            is_cheated: fullscreenWarnings >= 3, // Mark as cheated if too many fullscreen violations
            completed_at: new Date().toISOString(),
            contest_name: assessment.name
          });
          
        if (resultError) {
          console.error('Error storing results:', resultError);
          toast({
            title: "Warning",
            description: "There was an error saving your results.",
            variant: "destructive",
          });
          return false;
        }
        
        toast({
          title: "Assessment Completed",
          description: `Your results have been saved. You scored ${totalMarksObtained}/${totalPossibleMarks} (${percentage}%).`,
        });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error ending assessment:', error);
      toast({
        title: "Error",
        description: "There was an error finalizing your assessment. Your answers may not have been saved.",
        variant: "destructive",
      });
      return false;
    }
  };

  const answerMCQ = async (questionId: string, optionId: string) => {
    if (!assessment || !user) return;
    
    try {
      // First, get the current submission
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (submissionError || !submissions || submissions.length === 0) {
        console.error('Error finding submission:', submissionError);
        
        // Create a new submission if none exists
        const { data: newSubmission, error: newSubmissionError } = await supabase
          .from('submissions')
          .insert({
            assessment_id: assessment.id,
            user_id: user.id,
            started_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (newSubmissionError) {
          console.error('Error creating submission:', newSubmissionError);
          toast({
            title: "Error",
            description: "There was an error recording your answer.",
            variant: "destructive",
          });
          return;
        }
        
        // Use the new submission
        var submissionId = newSubmission.id;
      } else {
        var submissionId = submissions[0].id;
      }
      
      // Check if the selected option is correct
      const { data: option, error: optionError } = await supabase
        .from('mcq_options')
        .select('*')
        .eq('id', optionId)
        .single();
        
      if (optionError) {
        console.error('Error finding option:', optionError);
        toast({
          title: "Error",
          description: "There was an error processing your answer.",
          variant: "destructive",
        });
        return;
      }
      
      // Check if there's an existing question submission
      const { data: existingSubmission, error: existingSubmissionError } = await supabase
        .from('question_submissions')
        .select('*')
        .eq('submission_id', submissionId)
        .eq('question_type', 'mcq')
        .eq('question_id', questionId);
        
      if (existingSubmissionError) {
        console.error('Error checking existing submission:', existingSubmissionError);
        toast({
          title: "Error",
          description: "There was an error processing your answer.",
          variant: "destructive",
        });
        return;
      }
      
      // Get the question marks
      const { data: question, error: questionError } = await supabase
        .from('mcq_questions')
        .select('marks')
        .eq('id', questionId)
        .single();
        
      if (questionError) {
        console.error('Error finding question marks:', questionError);
        return;
      }
      
      const marksObtained = option.is_correct ? (question.marks || 0) : 0;
      
      if (existingSubmission && existingSubmission.length > 0) {
        // Update existing submission
        const { error: updateError } = await supabase
          .from('question_submissions')
          .update({
            mcq_option_id: optionId,
            marks_obtained: marksObtained,
            is_correct: option.is_correct
          })
          .eq('id', existingSubmission[0].id);
          
        if (updateError) {
          console.error('Error updating question submission:', updateError);
          toast({
            title: "Error",
            description: "There was an error updating your answer.",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Create new submission
        const { error: insertError } = await supabase
          .from('question_submissions')
          .insert({
            submission_id: submissionId,
            question_type: 'mcq',
            question_id: questionId,
            mcq_option_id: optionId,
            marks_obtained: marksObtained,
            is_correct: option.is_correct
          });
          
        if (insertError) {
          console.error('Error inserting question submission:', insertError);
          toast({
            title: "Error",
            description: "There was an error recording your answer.",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Update local state
      setAssessment((prevAssessment) => {
        if (!prevAssessment) return null;
        
        return {
          ...prevAssessment,
          questions: prevAssessment.questions.map(q => {
            if (q.id === questionId && q.type === 'mcq') {
              return {
                ...q,
                selectedOption: optionId
              };
            }
            return q;
          })
        };
      });
      
      // Recalculate total marks obtained
      const updatedAssessment = assessment ? {
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
      } : null;
      
      // Update the total marks obtained in state
      if (updatedAssessment) {
        calculateTotalMarks(updatedAssessment);
      }
      
      toast({
        title: "Answer Recorded",
        description: "Your answer has been saved.",
      });
    } catch (error) {
      console.error('Error answering MCQ:', error);
      toast({
        title: "Error",
        description: "There was an error processing your answer.",
        variant: "destructive",
      });
    }
  };

  const calculateTotalMarks = async (currentAssessment: AssessmentWithQuestions) => {
    if (!user || !currentAssessment) return;
    
    try {
      // Get the current submission
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', currentAssessment.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (submissionError || !submissions || submissions.length === 0) {
        console.error('Error finding submission for marks calculation:', submissionError);
        return;
      }
      
      // Get all question submissions
      const { data: questionSubmissions, error: questionsError } = await supabase
        .from('question_submissions')
        .select('*')
        .eq('submission_id', submissions[0].id);
        
      if (questionsError) {
        console.error('Error fetching question submissions:', questionsError);
        return;
      }
      
      // Calculate total marks obtained
      const total = questionSubmissions?.reduce((sum, qs) => sum + (qs.marks_obtained || 0), 0) || 0;
      console.log(`Total marks calculated from submissions: ${total}`);
      
      setTotalMarksObtained(total);
    } catch (error) {
      console.error('Error calculating marks:', error);
    }
  };

  const updateCodeSolution = async (questionId: string, language: string, code: string) => {
    if (!assessment || !user) return;
    
    try {
      // First, get the current submission
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (submissionError || !submissions || submissions.length === 0) {
        console.error('Error finding submission:', submissionError);
        
        // Create a new submission if none exists
        const { data: newSubmission, error: newSubmissionError } = await supabase
          .from('submissions')
          .insert({
            assessment_id: assessment.id,
            user_id: user.id,
            started_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (newSubmissionError) {
          console.error('Error creating submission:', newSubmissionError);
          return;
        }
        
        // Use the new submission
        var submissionId = newSubmission.id;
      } else {
        var submissionId = submissions[0].id;
      }
      
      // Check if there's an existing question submission
      const { data: existingSubmission, error: existingSubmissionError } = await supabase
        .from('question_submissions')
        .select('*')
        .eq('submission_id', submissionId)
        .eq('question_type', 'code')
        .eq('question_id', questionId);
        
      if (existingSubmissionError) {
        console.error('Error checking existing code submission:', existingSubmissionError);
        return;
      }
      
      if (existingSubmission && existingSubmission.length > 0) {
        // Update existing submission
        const { error: updateError } = await supabase
          .from('question_submissions')
          .update({
            code_solution: code,
            language: language
          })
          .eq('id', existingSubmission[0].id);
          
        if (updateError) {
          console.error('Error updating code submission:', updateError);
          return;
        }
      } else {
        // Create new submission
        const { error: insertError } = await supabase
          .from('question_submissions')
          .insert({
            submission_id: submissionId,
            question_type: 'code',
            question_id: questionId,
            code_solution: code,
            language: language,
            marks_obtained: 0
          });
          
        if (insertError) {
          console.error('Error inserting code submission:', insertError);
          return;
        }
      }
      
      // Update local state
      setAssessment((prevAssessment) => {
        if (!prevAssessment) return null;
        
        return {
          ...prevAssessment,
          questions: prevAssessment.questions.map(q => {
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
        };
      });
    } catch (error) {
      console.error('Error saving code solution:', error);
      toast({
        title: "Error",
        description: "There was an error saving your code.",
        variant: "destructive",
      });
    }
  };

  const updateMarksObtained = async (questionId: string, marks: number) => {
    if (!assessment || !user) return;
    
    try {
      // Get the current submission
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (submissionError || !submissions || submissions.length === 0) {
        console.error('Error finding submission for marks update:', submissionError);
        return;
      }
      
      // Update the question submission
      const { data: questionSubmission, error: questionError } = await supabase
        .from('question_submissions')
        .select('*')
        .eq('submission_id', submissions[0].id)
        .eq('question_type', 'code')
        .eq('question_id', questionId)
        .single();
        
      if (questionError) {
        console.error('Error finding question submission:', questionError);
        return;
      }
      
      // Update marks
      const { error: updateError } = await supabase
        .from('question_submissions')
        .update({
          marks_obtained: marks
        })
        .eq('id', questionSubmission.id);
        
      if (updateError) {
        console.error('Error updating marks:', updateError);
        return;
      }
      
      // Update local state
      setAssessment((prevAssessment) => {
        if (!prevAssessment) return null;
        
        return {
          ...prevAssessment,
          questions: prevAssessment.questions.map(q => {
            if (q.id === questionId && q.type === 'code') {
              return {
                ...q,
                marksObtained: marks
              };
            }
            return q;
          })
        };
      });
      
      // Recalculate total marks
      if (assessment) {
        calculateTotalMarks(assessment);
      }
    } catch (error) {
      console.error('Error updating marks:', error);
    }
  };

  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };
  
  const checkReattemptAvailability = async (assessmentId: string) => {
    try {
      if (!user) return false;
      
      const { data: existingResults, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('user_id', user.id);

      if (resultsError) {
        console.error('Error checking previous attempts:', resultsError);
        return false;
      }

      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('reattempt')
        .eq('id', assessmentId)
        .single();

      if (assessmentError || !assessmentData) {
        console.error('Error fetching assessment data:', assessmentError);
        return false;
      }

      if (!assessmentData.reattempt && existingResults && existingResults.length > 0) {
        toast({
          title: "Reattempt Not Allowed",
          description: "You are not allowed to reattempt this assessment.",
          variant: "destructive"
        });
        
        if (typeof navigate === 'function') {
          navigate('/student');
        }
        
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in checkReattemptAvailability:', error);
      return false;
    }
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
        totalMarksObtained,
        totalPossibleMarks,
        
        setAssessmentCode,
        loadAssessment,
        startAssessment,
        endAssessment,
        setCurrentQuestionIndex,
        answerMCQ,
        updateCodeSolution,
        updateMarksObtained,
        addFullscreenWarning,
        setTimeRemaining,
        checkReattemptAvailability
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
