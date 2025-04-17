
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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
  startTime: string; // ISO string
  endTime?: string; // ISO string
  questions: Question[];
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
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

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
      
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });
        
      if (questionsError) {
        console.error('Failed to load questions:', questionsError);
        throw new Error(`Failed to load questions: ${questionsError.message}`);
      }
      
      console.log(`Found ${questionsData?.length || 0} questions for assessment ID:`, assessmentData.id);
      
      if (!questionsData || questionsData.length === 0) {
        console.warn('No questions found for this assessment');
      }
      
      const questions: Question[] = [];
      let totalPossibleMarks = 0;
      
      for (const questionData of questionsData || []) {
        if (questionData.type === 'mcq') {
          totalPossibleMarks += questionData.marks || 0;
          
          const { data: optionsData, error: optionsError } = await supabase
            .from('mcq_options')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (optionsError) {
            console.error('Failed to load options for question', questionData.id, optionsError);
            continue;
          }
          
          console.log(`Found ${optionsData?.length || 0} options for MCQ question ID:`, questionData.id);
          
          const mcqQuestion: MCQQuestion = {
            id: questionData.id,
            type: 'mcq',
            title: questionData.title,
            description: questionData.description,
            imageUrl: questionData.image_url,
            options: optionsData?.map(option => ({
              id: option.id,
              text: option.text,
              isCorrect: option.is_correct
            })) || [],
            marks: questionData.marks
          };
          
          questions.push(mcqQuestion);
        } else if (questionData.type === 'code') {
          const { data: codeData, error: codeError } = await supabase
            .from('coding_questions')
            .select('*')
            .eq('question_id', questionData.id)
            .single();
            
          if (codeError) {
            console.error('Failed to load coding details for question', questionData.id, codeError);
            continue;
          }
          
          const { data: examplesData, error: examplesError } = await supabase
            .from('coding_examples')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (examplesError) {
            console.error('Failed to load examples for question', questionData.id, examplesError);
            continue;
          }
          
          console.log(`Found ${examplesData?.length || 0} examples for coding question ID:`, questionData.id);
          
          const { data: testCasesData, error: testCasesError } = await supabase
            .from('test_cases')
            .select('*')
            .eq('question_id', questionData.id)
            .order('order_index', { ascending: true });
            
          if (testCasesError) {
            console.error('Failed to load test cases for question', questionData.id, testCasesError);
            continue;
          }
          
          const testCaseMarks = testCasesData?.reduce((sum, tc) => sum + (tc.marks || 0), 0) || 0;
          totalPossibleMarks += testCaseMarks;
          
          const solutionTemplate = codeData?.solution_template ? 
            Object.fromEntries(
              Object.entries(codeData.solution_template as Record<string, any>)
                .map(([key, value]) => [key, String(value)])
            ) : 
            {};
            
          const codeQuestion: CodeQuestion = {
            id: questionData.id,
            assessmentId: assessmentData.id,
            type: 'code',
            title: questionData.title,
            description: questionData.description,
            examples: examplesData?.map(example => ({
              input: example.input,
              output: example.output,
              explanation: example.explanation
            })) || [],
            constraints: codeData?.constraints || [],
            solutionTemplate: solutionTemplate,
            userSolution: {},
            testCases: testCasesData?.map(testCase => ({
              input: testCase.input,
              output: testCase.output,
              marks: testCase.marks,
              is_hidden: testCase.is_hidden
            })) || [],
            marks: testCaseMarks
          };
          
          questions.push(codeQuestion);
        }
      }
      
      console.log(`Total questions processed: ${questions.length}`);
      console.log(`Total possible marks: ${totalPossibleMarks}`);
      
      const loadedAssessment: Assessment = {
        id: assessmentData.id,
        code: assessmentData.code,
        name: assessmentData.name,
        instructions: assessmentData.instructions || '',
        mcqCount: questions.filter(q => q.type === 'mcq').length,
        codingCount: questions.filter(q => q.type === 'code').length,
        durationMinutes: assessmentData.duration_minutes,
        startTime: assessmentData.start_time,
        endTime: assessmentData.end_time,
        questions: questions
      };
      
      console.log('Setting assessment:', loadedAssessment);
      setAssessment(loadedAssessment);
      setTotalPossibleMarks(totalPossibleMarks);
      setTimeRemaining(loadedAssessment.durationMinutes * 60);
      
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
          
        if (submissionError) {
          console.error('Error finding submission:', submissionError);
          toast({
            title: "Error",
            description: "There was an error finding your submission.",
            variant: "destructive",
          });
          return false;
        }
        
        if (!submissions || submissions.length === 0) {
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
        
        const { error: resultError } = await supabase
          .from('results')
          .insert({
            user_id: user.id,
            assessment_id: assessment.id,
            total_score: totalMarksObtained,
            total_marks: totalPossibleMarks,
            percentage: percentage,
            completed_at: new Date().toISOString(),
            user_name: user.name || '',
            user_prn: user.prn || ''
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

  const answerMCQ = (questionId: string, optionId: string) => {
    if (!assessment) return;
    
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
    
    let newTotalMarksObtained = 0;
    
    updatedAssessment.questions.forEach(q => {
      if (q.type === 'mcq' && q.selectedOption) {
        const option = q.options.find(opt => opt.id === q.selectedOption);
        if (option?.isCorrect) {
          newTotalMarksObtained += q.marks || 1;
        }
      } else if (q.type === 'code' && q.marksObtained) {
        newTotalMarksObtained += q.marksObtained;
      }
    });
    
    setTotalMarksObtained(newTotalMarksObtained);
  };

  const updateCodeSolution = (questionId: string, language: string, code: string) => {
    if (!assessment) return;
    
    setAssessment({
      ...assessment,
      questions: assessment.questions.map(q => {
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
    });
  };

  const updateMarksObtained = (questionId: string, marks: number) => {
    if (!assessment) return;
    
    setAssessment({
      ...assessment,
      questions: assessment.questions.map(q => {
        if (q.id === questionId) {
          if (q.type === 'code') {
            return {
              ...q,
              marksObtained: marks
            };
          }
        }
        return q;
      })
    });
    
    let newTotalMarksObtained = 0;
    
    assessment.questions.forEach(q => {
      if (q.type === 'mcq' && q.selectedOption) {
        const option = q.options.find(opt => opt.id === q.selectedOption);
        if (option?.isCorrect) {
          newTotalMarksObtained += q.marks || 1;
        }
      } else if (q.type === 'code') {
        if (q.id === questionId) {
          newTotalMarksObtained += marks;
        } else if (q.marksObtained) {
          newTotalMarksObtained += q.marksObtained;
        }
      }
    });
    
    setTotalMarksObtained(newTotalMarksObtained);
  };

  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };
  
  const checkReattemptAvailability = async (assessmentId: string) => {
    try {
      const { data: existingResults, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('user_id', user?.id);

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

      if (!assessmentData.reattempt && existingResults.length > 0) {
        toast({
          title: "Reattempt Not Allowed",
          description: "You are not allowed to reattempt this assessment.",
          variant: "destructive"
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
