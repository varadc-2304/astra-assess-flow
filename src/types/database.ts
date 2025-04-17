
export interface TestCase {
  id: string;
  question_id: string;
  input: string;
  output: string;
  order_index: number;
  marks: number; // Existing field, now explicitly typed
  is_hidden: boolean; // New field added
  created_at: string | null;
}

// Make sure required fields match Supabase schema
export interface Submission {
  id?: string;
  user_id: string;
  assessment_id: string; // Required field
  started_at: string;
  completed_at?: string | null;
  is_terminated?: boolean | null;
  fullscreen_violations?: number | null;
  created_at?: string | null;
}

// Make sure required fields match Supabase schema
export interface Answer {
  id?: string;
  submission_id: string; // Required field
  question_id: string; // Required field
  mcq_option_id?: string | null;
  code_solution?: string | null;
  language?: string | null;
  marks_obtained: number;
  is_correct: boolean | null;
  test_results?: any;
  created_at?: string | null;
}

// Make sure required fields match Supabase schema
export interface Result {
  id?: string;
  user_id: string; // Required field
  assessment_id: string; // Required field
  total_score: number;
  total_marks: number;
  percentage: number;
  completed_at: string; // Required field
  created_at?: string | null;
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
  created_at: string | null;
  // Add properties needed by components
  questions?: any[];
  mcqCount?: number;
  codingCount?: number;
  durationMinutes?: number;
  startTime?: string;
}

export interface Question {
  id: string;
  assessment_id: string;
  type: 'mcq' | 'code';
  title: string;
  description: string;
  image_url: string | null;
  marks: number;
  order_index: number;
  created_at: string | null;
}

export interface MCQOption {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  order_index: number;
  created_at: string | null;
}

export interface CodingQuestion {
  id: string;
  question_id: string;
  constraints: string[];
  solution_template: Record<string, string>;
  created_at: string | null;
}
