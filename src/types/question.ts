
export interface MCQOption {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface MCQQuestion {
  id: string;
  type: 'mcq';
  title: string;
  description: string;
  imageUrl?: string;
  options: MCQOption[];
  selectedOption?: string;
  marks: number;
  assessmentId: string;
}

export interface CodeExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface CodeQuestion {
  id: string;
  type: 'code';
  title: string;
  description: string;
  examples: CodeExample[];
  constraints: string[];
  solutionTemplate: Record<string, string>;
  userSolution: Record<string, string>;
  marks: number;
  assessmentId: string;
}

export type Question = MCQQuestion | CodeQuestion;
