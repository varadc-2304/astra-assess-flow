
import React, { createContext, useContext, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

// Define the Question types
export interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface MCQQuestion {
  id: string;
  type: 'mcq';
  text: string;
  options: MCQOption[];
  marks: number;
  title?: string;
  description?: string;
  imageUrl?: string;
  selectedOption?: string;
}

export interface CodeQuestion {
  id: string;
  type: 'code';
  text: string;
  starterCode?: string;
  testCases?: Array<{input: string; expectedOutput: string}>;
  language?: string; // e.g., "javascript", "python"
  marks: number;
  title?: string;
  description?: string;
  assessmentId?: string;
  solutionTemplate?: Record<string, string>;
  userSolution?: Record<string, string>;
  examples?: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints?: string[];
  marksObtained?: number;
}

export type Question = MCQQuestion | CodeQuestion;

// Define the Assessment type to match what's being used in the project
export interface Assessment {
  id: string;
  name: string;
  durationMinutes: number;
  questions?: Question[];
  code?: string;
  mcqCount?: number;
  codingCount?: number;
}

// Define the context type to include all needed states
export interface AssessmentContextType {
  assessment: Assessment | null;
  loading: boolean;
  error: string | null;
  fetchAssessment: (code: string) => Promise<boolean>;
  assessmentStarted: boolean;
  startAssessment: () => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answerMCQ: (questionId: string, optionId: string) => void;
  updateCodeSolution: (questionId: string, solution: string, language: string) => void;
  updateMarksObtained: (questionId: string, marks: number) => void;
  endAssessment: () => void;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  timeRemaining: number;
  setTimeRemaining: (time: number) => void;
  fullscreenWarnings: number;
  addFullscreenWarning: () => void;
  loadAssessment: (code: string) => Promise<boolean>;
}

// Create the context with default values
const AssessmentContext = createContext<AssessmentContextType>({
  assessment: null,
  loading: false,
  error: null,
  fetchAssessment: async () => false,
  assessmentStarted: false,
  startAssessment: () => {},
  currentQuestionIndex: 0,
  setCurrentQuestionIndex: () => {},
  answerMCQ: () => {},
  updateCodeSolution: () => {},
  updateMarksObtained: () => {},
  endAssessment: () => {},
  totalMarksObtained: 0,
  totalPossibleMarks: 0,
  timeRemaining: 0,
  setTimeRemaining: () => {},
  fullscreenWarnings: 0,
  addFullscreenWarning: () => {},
  loadAssessment: async () => false,
});

// Provider component
export const AssessmentProvider = ({ children }: { children: React.ReactNode }) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalMarksObtained, setTotalMarksObtained] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [fullscreenWarnings, setFullscreenWarnings] = useState(0);
  
  // Calculate total possible marks
  const totalPossibleMarks = assessment?.questions?.reduce(
    (total, q) => total + q.marks, 0
  ) || 0;

  // Fetch assessment data from Supabase
  const fetchAssessment = async (code: string): Promise<boolean> => {
    if (!code) {
      setError('Assessment code is required');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Fetching assessment with code:", code);
      
      // Store assessment code in localStorage for later use
      localStorage.setItem('assessmentCode', code);
      
      // Fetch assessment from database
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();
        
      if (assessmentError) {
        console.error("Error fetching assessment:", assessmentError);
        setError('Assessment not found. Please check the code and try again.');
        setLoading(false);
        return false;
      }
      
      if (!assessmentData) {
        console.error("No assessment found with code:", code);
        setError('Assessment not found. Please check the code and try again.');
        setLoading(false);
        return false;
      }
      
      console.log("Found assessment:", assessmentData);
      
      // Create assessment object with proper structure for frontend
      const assessment: Assessment = {
        id: assessmentData.id,
        name: assessmentData.name,
        durationMinutes: assessmentData.duration_minutes,
        code: assessmentData.code,
        questions: [],
        mcqCount: 0,
        codingCount: 0
      };
      
      // Fetch MCQ questions
      const { data: mcqQuestions, error: mcqError } = await supabase
        .from('mcq_questions')
        .select(`
          id, title, description, image_url, marks, order_index,
          mcq_options (id, text, is_correct, order_index)
        `)
        .eq('assessment_id', assessment.id)
        .order('order_index');
        
      if (mcqError) {
        console.error("Error fetching MCQ questions:", mcqError);
      }
      
      // Fetch coding questions
      const { data: codingQuestions, error: codingError } = await supabase
        .from('coding_questions')
        .select(`
          id, title, description, image_url, marks, order_index,
          coding_languages (id, coding_lang, solution_template, constraints),
          coding_examples (id, input, output, explanation, order_index),
          test_cases (id, input, output, marks, is_hidden, order_index)
        `)
        .eq('assessment_id', assessment.id)
        .order('order_index');
        
      if (codingError) {
        console.error("Error fetching coding questions:", codingError);
      }
      
      // Process MCQ questions
      const processedMcqQuestions: MCQQuestion[] = mcqQuestions ? mcqQuestions.map(q => ({
        id: q.id,
        type: 'mcq',
        text: q.description,
        title: q.title,
        description: q.description,
        imageUrl: q.image_url,
        marks: q.marks,
        options: q.mcq_options.map(o => ({
          id: o.id,
          text: o.text,
          isCorrect: o.is_correct
        }))
      })) : [];
      
      // Process coding questions
      const processedCodingQuestions: CodeQuestion[] = codingQuestions ? codingQuestions.map(q => {
        // Process solution templates
        const solutionTemplate: Record<string, string> = {};
        if (q.coding_languages) {
          q.coding_languages.forEach(lang => {
            solutionTemplate[lang.coding_lang] = lang.solution_template;
          });
        }
        
        // Process constraints
        const constraints: string[] = [];
        if (q.coding_languages && q.coding_languages.length > 0 && q.coding_languages[0].constraints) {
          constraints.push(...q.coding_languages[0].constraints);
        }
        
        // Process examples
        const examples = q.coding_examples ? q.coding_examples.map(e => ({
          input: e.input,
          output: e.output,
          explanation: e.explanation || undefined
        })) : [];
        
        // Process test cases
        const testCases = q.test_cases ? q.test_cases.map(tc => ({
          input: tc.input,
          expectedOutput: tc.output,
        })) : [];
        
        return {
          id: q.id,
          type: 'code',
          text: q.description,
          title: q.title,
          description: q.description,
          imageUrl: q.image_url,
          marks: q.marks,
          assessmentId: assessment.id,
          solutionTemplate,
          constraints,
          examples,
          testCases,
          language: q.coding_languages && q.coding_languages.length > 0 ? 
            q.coding_languages[0].coding_lang : 'javascript',
        };
      }) : [];
      
      // Combine all questions and sort by order index
      assessment.questions = [...processedMcqQuestions, ...processedCodingQuestions];
      assessment.mcqCount = processedMcqQuestions.length;
      assessment.codingCount = processedCodingQuestions.length;
      
      console.log("Processed assessment:", assessment);
      
      setAssessment(assessment);
      // Set initial time remaining based on assessment duration
      setTimeRemaining(assessment.durationMinutes * 60);
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Error fetching assessment:', err);
      setError('Failed to load assessment. Please try again.');
      setLoading(false);
      return false;
    }
  };

  // Alias for fetchAssessment with better error handling
  const loadAssessment = async (code: string): Promise<boolean> => {
    if (!code) {
      console.error("No assessment code provided");
      setError("Please provide an assessment code");
      return false;
    }
    
    console.log(`Loading assessment with code: ${code}`);
    return await fetchAssessment(code);
  };

  // Start assessment
  const startAssessment = () => {
    setAssessmentStarted(true);
  };

  // Answer MCQ question
  const answerMCQ = (questionId: string, optionId: string) => {
    if (assessment && assessment.questions) {
      const updatedQuestions = assessment.questions.map(q => {
        if (q.id === questionId && q.type === 'mcq') {
          return { ...q, selectedOption: optionId };
        }
        return q;
      });
      
      setAssessment({ ...assessment, questions: updatedQuestions });
    }
  };

  // Update code solution
  const updateCodeSolution = (questionId: string, solution: string, language: string) => {
    if (assessment && assessment.questions) {
      const updatedQuestions = assessment.questions.map(q => {
        if (q.id === questionId && q.type === 'code') {
          return { 
            ...q, 
            userSolution: { 
              ...q.userSolution,
              [language]: solution 
            } 
          };
        }
        return q;
      });
      
      setAssessment({ ...assessment, questions: updatedQuestions });
    }
  };

  // Update marks obtained for a question
  const updateMarksObtained = (questionId: string, marks: number) => {
    // Implementation would update marks and total
    setTotalMarksObtained(prev => prev + marks);
    console.log(`Updated marks for ${questionId}: ${marks}`);
  };

  // End assessment
  const endAssessment = () => {
    setAssessmentStarted(false);
    // Implementation would submit all answers
    console.log('Assessment ended');
  };

  // Add fullscreen warning
  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };

  const value: AssessmentContextType = {
    assessment,
    loading,
    error,
    fetchAssessment,
    assessmentStarted,
    startAssessment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answerMCQ,
    updateCodeSolution,
    updateMarksObtained,
    endAssessment,
    totalMarksObtained,
    totalPossibleMarks,
    timeRemaining,
    setTimeRemaining,
    fullscreenWarnings,
    addFullscreenWarning,
    loadAssessment
  };

  return (
    <AssessmentContext.Provider value={value}>
      {children}
    </AssessmentContext.Provider>
  );
};

// Custom hook for using the assessment context
export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};
