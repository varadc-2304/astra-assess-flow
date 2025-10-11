import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Assessment as DbAssessment, 
  MCQQuestion as DbMCQQuestion,
  CodingQuestion as DbCodingQuestion,
  MCQOption,
  CodingLanguage,
  CodingExample,
  TestCase,
  QuestionOption
} from '@/types/database';
import { shuffleArray } from '@/lib/utils';

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

export type Assessment = {
  id: string;
  code: string;
  name: string;
  instructions: string;
  mcqCount: number;
  codingCount: number;
  durationMinutes: number;
  startTime: string;
  endTime?: string;
  questions: Question[];
  isAiProctored: boolean;
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
  const [assessment, setAssessment] = useState<Assessment | null>(null);
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
  const [isDynamicAssessment, setIsDynamicAssessment] = useState<boolean>(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const generateDynamicQuestions = async (assessmentData: DbAssessment): Promise<Question[]> => {
    
    try {
      // Fetch assessment constraints
      const { data: constraints, error: constraintsError } = await supabase
        .from('assessment_constraints')
        .select('*')
        .eq('assessment_id', assessmentData.id);
        
      if (constraintsError) {
        throw new Error(`Failed to fetch assessment constraints: ${constraintsError.message}`);
      }
      
      if (!constraints || constraints.length === 0) {
        return [];
      }
      
      const questions: Question[] = [];
      
      // Process MCQ constraints
      const mcqConstraints = constraints.filter(c => c.question_type === 'mcq');
      
      for (const constraint of mcqConstraints) {
        
        // Get all available serial numbers for this topic and difficulty
        const { data: serialData, error: serialError } = await supabase
          .from('mcq_question_bank')
          .select('serial')
          .eq('topic', constraint.topic)
          .eq('difficulty', constraint.difficulty)
          .not('serial', 'is', null);
          
        if (serialError) {
          continue;
        }
        
        if (!serialData || serialData.length === 0) {
          continue;
        }
        
        const availableSerials = serialData.map(item => item.serial).filter(serial => serial !== null);
        
        if (availableSerials.length === 0) {
          continue;
        }
        
        // Generate random serial numbers
        const questionsToFetch = Math.min(constraint.number_of_questions, availableSerials.length);
        const randomSerials: number[] = [];
        
        while (randomSerials.length < questionsToFetch) {
          const randomIndex = Math.floor(Math.random() * availableSerials.length);
          const randomSerial = availableSerials[randomIndex];
          
          if (!randomSerials.includes(randomSerial)) {
            randomSerials.push(randomSerial);
          }
        }
        
        // Fetch questions using the random serial numbers
        const { data: mcqQuestions, error: mcqError } = await supabase
          .from('mcq_question_bank')
          .select('*')
          .eq('topic', constraint.topic)
          .eq('difficulty', constraint.difficulty)
          .in('serial', randomSerials);
          
        if (mcqError) {
          continue;
        }
        
        if (!mcqQuestions || mcqQuestions.length === 0) {
          continue;
        }
        
        for (const mcqQuestion of mcqQuestions) {
        
          // Fetch options for each MCQ question
          const { data: options, error: optionsError } = await supabase
            .from('mcq_options_bank')
            .select('id, text, is_correct, order_index')
            .eq('mcq_question_bank_id', mcqQuestion.id)
            .order('order_index', { ascending: true });
        
          if (optionsError) {
            continue;
          }

          if (!options || options.length === 0) {
            continue;
          }
        
          // Randomize the order of options
          const shuffledOptions = shuffleArray(options.map(option => ({
            id: option.id,
            text: option.text,
            isCorrect: option.is_correct
          })));

          const question: MCQQuestion = {
            id: mcqQuestion.id,
            type: 'mcq',
            title: mcqQuestion.title,
            description: mcqQuestion.description,
            imageUrl: mcqQuestion.image_url,
            options: shuffledOptions,
            marks: mcqQuestion.marks
          };
        
          questions.push(question);
        }
      }
      
      // Process Coding constraints
      const codingConstraints = constraints.filter(c => c.question_type === 'coding');
      
      for (const constraint of codingConstraints) {
        
        // Get all available serial numbers for this topic and difficulty
        const { data: serialData, error: serialError } = await supabase
          .from('coding_question_bank')
          .select('serial')
          .eq('topic', constraint.topic)
          .eq('difficulty', constraint.difficulty)
          .not('serial', 'is', null);
          
        if (serialError) {
          continue;
        }
        
        if (!serialData || serialData.length === 0) {
          continue;
        }
        
        const availableSerials = serialData.map(item => item.serial).filter(serial => serial !== null);
        
        if (availableSerials.length === 0) {
          continue;
        }
        
        // Generate random serial numbers
        const questionsToFetch = Math.min(constraint.number_of_questions, availableSerials.length);
        const randomSerials: number[] = [];
        
        while (randomSerials.length < questionsToFetch) {
          const randomIndex = Math.floor(Math.random() * availableSerials.length);
          const randomSerial = availableSerials[randomIndex];
          
          if (!randomSerials.includes(randomSerial)) {
            randomSerials.push(randomSerial);
          }
        }
        
        // Fetch coding questions using the random serial numbers
        const { data: codingQuestions, error: codingError } = await supabase
          .from('coding_question_bank')
          .select('*')
          .eq('topic', constraint.topic)
          .eq('difficulty', constraint.difficulty)
          .in('serial', randomSerials);
          
        if (codingError) {
          continue;
        }
        
        if (!codingQuestions || codingQuestions.length === 0) {
          continue;
        }
        
        for (const codingQuestion of codingQuestions) {
          
          // Fetch coding languages for this question
          const { data: languagesData, error: languagesError } = await supabase
            .from('coding_languages_bank')
            .select('*')
            .eq('coding_question_bank_id', codingQuestion.id);

          if (languagesError) {
            continue;
          }
          
          // Fetch coding examples for this question
          const { data: examplesData, error: examplesError } = await supabase
            .from('coding_examples_bank')
            .select('*')
            .eq('coding_question_bank_id', codingQuestion.id)
            .order('order_index', { ascending: true });

          if (examplesError) {
            continue;
          }

          // Fetch test cases for this question
          const { data: testCasesData, error: testCasesError } = await supabase
            .from('test_cases_bank')
            .select('*')
            .eq('coding_question_bank_id', codingQuestion.id)
            .order('order_index', { ascending: true });

          if (testCasesError) {
            continue;
          }

          // Create solution template object
          const solutionTemplate: Record<string, string> = {};
          languagesData?.forEach((lang: any) => {
            solutionTemplate[lang.coding_lang] = lang.solution_template;
          });
          
          // Get constraints from the first language
          const questionConstraints = languagesData && languagesData.length > 0 
            ? languagesData[0].constraints ? [languagesData[0].constraints] : []
            : [];

          // Calculate total marks from test cases
          const testCaseMarks = testCasesData?.reduce((sum: number, tc: any) => sum + (tc.marks || 0), 0) || 0;
          
          const question: CodeQuestion = {
            id: codingQuestion.id,
            assessmentId: assessmentData.id,
            type: 'code',
            title: codingQuestion.title,
            description: codingQuestion.description,
            examples: examplesData?.map((example: any) => ({
              input: example.input,
              output: example.output,
              explanation: example.explanation,
            })) || [],
            constraints: questionConstraints,
            solutionTemplate,
            userSolution: {},
            testCases: testCasesData?.map((testCase: any) => ({
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
      }
      
      // Randomize the order of questions
      const shuffledQuestions = shuffleArray(questions);
      return shuffledQuestions;
      
    } catch (error) {
      throw error;
    }
  };

  const loadAssessment = async (code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const normalizedCode = code.trim().toUpperCase();
      
      const { data: assessmentsData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', normalizedCode);
        
      if (assessmentError) {
        throw new Error(`Error fetching assessment data: ${assessmentError.message}`);
      }
      
      if (!assessmentsData || assessmentsData.length === 0) {
        throw new Error(`Invalid assessment code or assessment not found: ${normalizedCode}`);
      }
      
      const assessmentData = assessmentsData[0];
      
      // Set the dynamic assessment flag
      setIsDynamicAssessment(assessmentData.is_dynamic || false);
      
      let questions: Question[] = [];
      let totalPossibleMarks = 0;
      
      // Check if assessment is dynamic
      if (assessmentData.is_dynamic) {
        questions = await generateDynamicQuestions(assessmentData);
        totalPossibleMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
      } else {
        
        // Fetch MCQ Questions with proper selection to include id field
        const { data: mcqQuestionsData, error: mcqQuestionsError } = await supabase
          .from('mcq_questions')
          .select('*')
          .eq('assessment_id', assessmentData.id)
          .order('order_index', { ascending: true });
          
        if (mcqQuestionsError) {
          throw new Error(`Failed to load MCQ questions: ${mcqQuestionsError.message}`);
        }

        // Fetch Coding Questions
        const { data: codingQuestionsData, error: codingQuestionsError } = await supabase
          .from('coding_questions')
          .select('*')
          .eq('assessment_id', assessmentData.id)
          .order('order_index', { ascending: true });
          
        if (codingQuestionsError) {
          throw new Error(`Failed to load coding questions: ${codingQuestionsError.message}`);
        }
        
        // Process MCQ Questions
        for (const mcqQuestion of mcqQuestionsData || []) {
          totalPossibleMarks += mcqQuestion.marks || 0;
          
          const { data: optionsData, error: optionsError } = await supabase
            .from('mcq_options')
            .select('*')
            .eq('mcq_question_id', mcqQuestion.id)
            .order('order_index', { ascending: true });
            
          if (optionsError) {
            continue;
          }
          
          // Randomize the order of options for static assessment too
          const shuffledOptions = shuffleArray(optionsData?.map(option => ({
            id: option.id,
            text: option.text,
            isCorrect: option.is_correct
          })) || []);

          const question: MCQQuestion = {
            id: mcqQuestion.id,
            type: 'mcq',
            title: mcqQuestion.title,
            description: mcqQuestion.description,
            imageUrl: mcqQuestion.image_url,
            options: shuffledOptions,
            marks: mcqQuestion.marks
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
            continue;
          }
          
          // Get coding examples
          const { data: examplesData, error: examplesError } = await supabase
            .from('coding_examples')
            .select('*')
            .eq('coding_question_id', codingQuestion.id)
            .order('order_index', { ascending: true });

          if (examplesError) {
            continue;
          }

          // Get test cases
          const { data: testCasesData, error: testCasesError } = await supabase
            .from('test_cases')
            .select('*')
            .eq('coding_question_id', codingQuestion.id)
            .order('order_index', { ascending: true });

          if (testCasesError) {
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
            assessmentId: assessmentData.id,
            type: 'code',
            title: codingQuestion.title,
            description: codingQuestion.description,
            examples: examplesData?.map(example => ({
              input: example.input,
              output: example.output,
              explanation: example.explanation,
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
      }
      
      if (questions.length === 0) {
        throw new Error('No questions found for this assessment. Please contact your administrator.');
      }
      
      // Randomize the order of questions for static assessments too
      const shuffledQuestions = shuffleArray(questions);
      
      const loadedAssessment: Assessment = {
        id: assessmentData.id,
        code: assessmentData.code,
        name: assessmentData.name,
        instructions: assessmentData.instructions || '',
        mcqCount: shuffledQuestions.filter(q => q.type === 'mcq').length,
        codingCount: shuffledQuestions.filter(q => q.type === 'code').length,
        durationMinutes: assessmentData.duration_minutes,
        startTime: assessmentData.start_time,
        endTime: assessmentData.end_time,
        questions: shuffledQuestions,
        isAiProctored: assessmentData.is_ai_proctored !== undefined ? assessmentData.is_ai_proctored : true
      };
      
      setAssessment(loadedAssessment);
      setTotalPossibleMarks(totalPossibleMarks);
      setTimeRemaining(loadedAssessment.durationMinutes * 60);
      setCurrentQuestionIndex(0);
      setAssessmentEnded(false);
      
      setTotalMarksObtained(0);
      
      toast({
        title: "Success",
        description: `Assessment "${loadedAssessment.name}" loaded successfully${assessmentData.is_dynamic ? ' (Dynamic)' : ''}`,
        duration: 1000,
      });
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load assessment');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to load assessment',
        variant: "destructive",
        duration: 1000,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = () => {
    setAssessmentStarted(true);
    setFullscreenWarnings(0); // Reset fullscreen warnings on start
  };

  const endAssessment = async (): Promise<boolean> => {
    try {
      if (assessment && !assessmentEnded && user) {
        setAssessmentEnded(true);
        setAssessmentStarted(false);
        
        // Always create a new submission for each assessment attempt
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
            
        if (newSubmissionError || !newSubmission) {
          toast({
            title: "Error",
            description: "There was an error creating your submission.",
            variant: "destructive",
            duration: 1000,
          });
          return false;
        }
        
        const percentage = totalPossibleMarks > 0
          ? Math.round((totalMarksObtained / totalPossibleMarks) * 100)
          : 0;
        
        // Create a new result entry for this attempt
        const { error: resultError } = await supabase
          .from('results')
          .insert({
            user_id: user.id,
            assessment_id: assessment.id,
            submission_id: newSubmission.id,
            total_score: totalMarksObtained,
            total_marks: totalPossibleMarks,
            percentage: percentage,
            is_cheated: fullscreenWarnings >= 3, // Mark as cheated if too many fullscreen violations
            completed_at: new Date().toISOString()
          });
          
        if (resultError) {
          toast({
            title: "Warning",
            description: "There was an error saving your results.",
            variant: "destructive",
            duration: 1000,
          });
          return false;
        };
        
        return true;
      }
      return false;
    } catch (error) {
      toast({
        title: "Error",
        description: "There was an error finalizing your assessment. Your answers may not have been saved.",
        variant: "destructive",
        duration: 1000,
      });
      return false;
    }
  };

  const answerMCQ = async (questionId: string, optionId: string) => {
    if (!assessment || !user) return;
    
    try {
      
      // Always create a new submission for the current session if not already created
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (submissionError) {
        throw submissionError;
      }
      
      let submissionId: string;
      
      if (!submissions || submissions.length === 0) {
        // Create a new submission if none exists for this attempt
        const { data: newSubmission, error: newSubmissionError } = await supabase
          .from('submissions')
          .insert({
            assessment_id: assessment.id,
            user_id: user.id,
            started_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (newSubmissionError || !newSubmission) {
          console.error('Error creating submission:', newSubmissionError);
          toast({
            title: "Error",
            description: "There was an error recording your answer.",
            variant: "destructive",
            duration: 1000,
          });
          return;
        }
        
        submissionId = newSubmission.id;
      } else {
        submissionId = submissions[0].id;
      }
      
      // Check if the selected option is correct - handle both static and dynamic assessments
      let option: any = null;
      let question: any = null;
      
      if (isDynamicAssessment) {
        // This is a dynamic assessment, check mcq_options_bank
        console.log('Checking dynamic assessment option in mcq_options_bank');
        const { data: optionData, error: optionError } = await supabase
          .from('mcq_options_bank')
          .select('*')
          .eq('id', optionId)
          .single();
          
        if (optionError) {
          console.error('Error finding option in mcq_options_bank:', optionError);
          toast({
            title: "Error",
            description: "There was an error processing your answer.",
            variant: "destructive",
            duration: 1000,
          });
          return;
        }
        
        option = optionData;
        
        // Get the question marks from mcq_question_bank
        const { data: questionData, error: questionError } = await supabase
          .from('mcq_question_bank')
          .select('marks')
          .eq('id', questionId)
          .single();
          
        if (questionError) {
          console.error('Error finding question marks in mcq_question_bank:', questionError);
          return;
        }
        
        question = questionData;
      } else {
        // This is a static assessment, check mcq_options
        console.log('Checking static assessment option in mcq_options');
        const { data: optionData, error: optionError } = await supabase
          .from('mcq_options')
          .select('*')
          .eq('id', optionId)
          .single();
          
        if (optionError) {
          console.error('Error finding option in mcq_options:', optionError);
          toast({
            title: "Error",
            description: "There was an error processing your answer.",
            variant: "destructive",
            duration: 1000,
          });
          return;
        }
        
        option = optionData;
        
        // Get the question marks from mcq_questions
        const { data: questionData, error: questionError } = await supabase
          .from('mcq_questions')
          .select('marks')
          .eq('id', questionId)
          .single();
          
        if (questionError) {
          console.error('Error finding question marks in mcq_questions:', questionError);
          return;
        }
        
        question = questionData;
      }
      
      const marksObtained = option.is_correct ? (question.marks || 0) : 0;
      console.log(`Option is ${option.is_correct ? 'correct' : 'incorrect'}, marks obtained: ${marksObtained}`);
      
      // Check if there's an existing question submission for this session
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
          duration: 1000,
        });
        return;
      }
      
      if (existingSubmission && existingSubmission.length > 0) {
        // Update existing submission for this attempt
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
            duration: 1000,
          });
          return;
        }
      } else {
        // Create new submission for this attempt
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
            duration: 1000,
          });
          return;
        }
      }
      
      // Update local state
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
      
      // Recalculate total marks obtained
      const updatedAssessment = {
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
      };
      
      // Update the total marks obtained in state
      calculateTotalMarks(updatedAssessment);
      
      toast({
        title: "Answer Recorded",
        description: "Your answer has been saved.",
        duration: 1000,
      });
    } catch (error) {
      console.error('Error answering MCQ:', error);
      toast({
        title: "Error",
        description: "There was an error processing your answer.",
        variant: "destructive",
        duration: 1000,
      });
    }
  };

  const calculateTotalMarks = async (currentAssessment: Assessment) => {
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
      // Get the current non-completed submission for this attempt
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (submissionError) {
        console.error('Error finding submission:', submissionError);
        
        // Create a new submission for this attempt if none exists
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
        
        var submissionId = newSubmission.id;
      } else {
        var submissionId = submissions && submissions.length > 0 ? submissions[0].id : null;
        
        if (!submissionId) {
          // Create a new submission for this attempt
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
          
          submissionId = newSubmission.id;
        }
      }
      
      // Check if there's an existing question submission for this session
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
        // Update existing submission for this attempt
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
        // Create new submission for this attempt
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
      setAssessment({
        ...assessment,
        questions: assessment.questions.map(q => {
          if (q.id === questionId && q.type === 'code') {
            return {
              ...q,
              userSolution: {
                ...(q as CodeQuestion).userSolution,
                [language]: code
              }
            };
          }
          return q;
        })
      });
    } catch (error) {
      console.error('Error saving code solution:', error);
      toast({
        title: "Error",
        description: "There was an error saving your code.",
        variant: "destructive",
        duration: 1000,
      });
    }
  };

  const updateMarksObtained = async (questionId: string, marks: number) => {
    if (!assessment || !user) return;
    
    try {
      // Get the current non-completed submission for this attempt
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (submissionError || !submissions || submissions.length === 0) {
        console.error('Error finding submission for marks update:', submissionError);
        return;
      }
      
      // Update the question submission for this attempt
      const { data: questionSubmission, error: questionError } = await supabase
        .from('question_submissions')
        .select('*')
        .eq('submission_id', submissions[0].id)
        .eq('question_type', 'code')
        .eq('question_id', questionId);
        
      if (questionError || !questionSubmission || questionSubmission.length === 0) {
        console.error('Error finding question submission:', questionError);
        return;
      }
      
      // Update marks for this attempt
      const { error: updateError } = await supabase
        .from('question_submissions')
        .update({
          marks_obtained: marks
        })
        .eq('id', questionSubmission[0].id);
        
      if (updateError) {
        console.error('Error updating marks:', updateError);
        return;
      }
      
      // Update local state
      setAssessment({
        ...assessment,
        questions: assessment.questions.map(q => {
          if (q.id === questionId && q.type === 'code') {
            return {
              ...q,
              marksObtained: marks
            };
          }
          return q;
        })
      });
      
      // Recalculate total marks for this attempt
      calculateTotalMarks(assessment);
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
      
      // Check if the assessment allows reattempts regardless of previous attempts
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('reattempt, is_practice')
        .eq('id', assessmentId)
        .single();

      if (assessmentError || !assessmentData) {
        console.error('Error fetching assessment data:', assessmentError);
        return false;
      }
      
      // If it's a practice assessment or reattempt is enabled, always allow
      if (assessmentData.is_practice || assessmentData.reattempt) {
        return true;
      }
      
      // If not a practice assessment and reattempt not allowed, check if user has already attempted
      const { data: existingResults, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('user_id', user.id);

      if (resultsError) {
        console.error('Error checking previous attempts:', resultsError);
        return false;
      }

      if (!assessmentData.reattempt && existingResults && existingResults.length > 0) {
        toast({
          title: "Reattempt Not Allowed",
          description: "You are not allowed to reattempt this assessment.",
          variant: "destructive",
          duration: 1000,
        });
        navigate('/student');
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
