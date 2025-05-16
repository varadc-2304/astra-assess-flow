
export interface Auth {
  id: string;
  email: string;
  password: string;
  name: string | null;
  role: 'admin' | 'student';
  prn: string | null;
  year: string | null;
  department: string | null;
  division: string | null;
  batch: string | null;
  created_at: string;
}

export interface Assessment {
  id: string;
  code: string;
  name: string;
  instructions: string | null;
  duration_minutes: number;
  start_time: string;
  end_time: string | null;
  created_by: string | null;
  reattempt: boolean;
  status: string | null;
  created_at: string | null;
  mcqCount?: number;   // Add frontend properties
  codingCount?: number;
  durationMinutes?: number;
  startTime?: string;
  isAiProctored?: boolean; // Add missing property
  questions?: Array<MCQQuestion | CodingQuestion>; 
  contest_name?: string; // Add this to support the contest_name field in results
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
  type?: 'mcq';  // Add frontend property
  options?: Array<QuestionOption>; // Add frontend property
  selectedOption?: string; // Add frontend property
}

export interface MCQOption {
  id: string;
  mcq_question_id: string;
  text: string;
  is_correct: boolean;
  order_index: number;
  created_at: string;
}

export interface CodingQuestion {
  id: string;
  assessment_id: string;
  title: string;
  description: string;
  image_url: string | null;
  marks: number;
  order_index: number;
  created_at: string;
  type?: 'code';  // Add frontend property
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

export interface CodingLanguage {
  id: string;
  coding_question_id: string;
  coding_lang: string;
  solution_template: string;
  constraints: string[];
  created_at: string;
}

export interface CodingExample {
  id: string;
  coding_question_id: string;
  input: string;
  output: string;
  explanation: string | null;
  order_index: number;
  created_at: string;
}

export interface TestCase {
  id: string;
  coding_question_id: string;
  input: string;
  output: string;
  marks: number;
  is_hidden: boolean;
  order_index: number;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  assessment_id: string;
  started_at: string;
  completed_at: string | null;
  is_terminated: boolean | null;
  fullscreen_violations: number | null;
  created_at: string;
}

export interface QuestionSubmission {
  id?: string;
  submission_id: string;
  question_type: 'mcq' | 'code';
  question_id: string;
  mcq_option_id?: string | null;
  code_solution?: string | null;
  language?: string | null;
  marks_obtained: number;
  is_correct: boolean | null;
  test_results?: Json | null; // This should be Json type, not TestResult[]
  created_at?: string;
}

export interface Result {
  id: string;
  user_id: string;
  assessment_id: string;
  submission_id: string;
  total_score: number;
  total_marks: number;
  percentage: number;
  is_cheated: boolean | null;
  completed_at: string;
  created_at: string;
  contest_name?: string; // Add this field to match the AssessmentPage.tsx usage
}

// Define Json type for consistency with Supabase
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Define TestResult type to be compatible with Json
export interface TestResult {
  passed: boolean;
  actualOutput?: string;
  marks?: number;
  isHidden?: boolean;
  [key: string]: Json | undefined; // Add this to make TestResult compatible with Json
}

// Define QuestionOption type for frontend
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}
