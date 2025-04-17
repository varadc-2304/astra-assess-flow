
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

export interface Submission {
  id?: string;
  user_id: string;
  assessment_id: string;
  started_at: string;
  completed_at: string | null;
  is_terminated?: boolean | null;
  fullscreen_violations?: number | null;
  created_at?: string | null;
}

export interface Answer {
  id?: string;
  submission_id: string;
  question_id: string;
  mcq_option_id?: string | null;
  code_solution?: string | null;
  language?: string | null;
  marks_obtained: number;
  is_correct: boolean | null;
  test_results?: any;
  created_at?: string | null;
}

