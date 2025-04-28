
export interface Assessment {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
  reattempt: boolean;
  created_by?: string;
  end_time?: string;
  start_time: string;
  duration_minutes: number;
  instructions?: string;
}

export interface MCQQuestion {
  id: string;
  assessment_id: string;
  order_index: number;
  marks: number;
  created_at: string;
  image_url?: string;
  title: string;
  description: string;
}

export interface CodingQuestion {
  id: string;
  assessment_id: string;
  order_index: number;
  created_at: string;
  description: string;
  image_url?: string;
  marks: number;
  title: string;
}

export interface MCQOption {
  id: string;
  text: string;
  mcq_question_id: string;
  is_correct: boolean;
  order_index: number;
  created_at: string;
}

export interface CodingLanguage {
  id: string;
  coding_question_id: string;
  created_at: string;
  coding_lang: string;
  constraints: string[];
  solution_template: string;
}

export interface CodingExample {
  id: string;
  coding_question_id: string;
  order_index: number;
  created_at: string;
  input: string;
  output: string;
  explanation?: string;
}

export interface TestCase {
  id: string;
  input: string;
  output: string;
  marks: number;
  is_hidden: boolean;
  order_index: number;
  created_at: string;
  coding_question_id: string;
}

export interface Auth {
  id: string;
  created_at: string;
  batch?: string;
  division?: string;
  department?: string;
  year?: string;
  prn?: string;
  role: 'admin' | 'student';
  name?: string;
  password: string;
  email: string;
}

export interface Submission {
  id: string;
  assessment_id: string;
  user_id: string;
  is_terminated?: boolean;
  fullscreen_violations?: number;
  created_at: string;
  completed_at?: string;
  started_at: string;
}

export interface QuestionSubmission {
  id: string;
  question_id: string;
  created_at: string;
  test_results?: Json;
  is_correct?: boolean;
  marks_obtained: number;
  mcq_option_id?: string;
  submission_id: string;
  code_solution?: string;
  language?: string;
  question_type: string;
}

export interface TestResult {
  status: string;
  stdout?: string;
  stderr?: string;
  expected_output?: string;
  actual_output?: string;
  is_hidden?: boolean;
  passed: boolean;
  marks?: number;
  message?: string;
}

export interface Result {
  id: string;
  total_marks: number;
  percentage: number;
  completed_at: string;
  is_cheated?: boolean;
  created_at: string;
  submission_id: string;
  assessment_id: string;
  user_id: string;
  total_score: number;
  contest_name?: string;
  assessments?: {
    id: string;
    name: string;
    code: string;
  };
}

// Support for Supabase JSON type
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  assessments: Assessment[];
  auth: Auth[];
  coding_examples: CodingExample[];
  coding_languages: CodingLanguage[];
  coding_questions: CodingQuestion[];
  mcq_options: MCQOption[];
  mcq_questions: MCQQuestion[];
  question_submissions: QuestionSubmission[];
  results: Result[];
  submissions: Submission[];
  test_cases: TestCase[];
};
