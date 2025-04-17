
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
