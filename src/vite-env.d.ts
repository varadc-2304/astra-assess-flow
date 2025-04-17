
/// <reference types="vite/client" />

// Database types for our app
interface AnswerDB {
  id: string;
  submission_id: string;
  question_id: string;
  mcq_option_id?: string | null;
  code_solution?: string | null;
  language?: string | null;
  marks_obtained: number;
  is_correct: boolean | null;
  created_at: string;
  test_results?: any;
}

interface ResultDB {
  id: string;
  user_id: string;
  assessment_id: string;
  total_score: number;
  total_marks: number;
  percentage: number;
  completed_at: string;
  created_at: string;
}

