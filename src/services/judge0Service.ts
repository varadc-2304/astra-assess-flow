
import axios from 'axios';

// Judge0 API configuration
const JUDGE0_API_URL = 'https://judge0.arenahq-mitwpu.in';

// Language IDs in Judge0
export const LANGUAGE_IDS = {
  c: 50,
  cpp: 54,
  java: 62,
  python: 71
};

// Submission status
export enum SubmissionStatus {
  IN_QUEUE = 1,
  PROCESSING = 2,
  ACCEPTED = 3,
  WRONG_ANSWER = 4,
  TIME_LIMIT_EXCEEDED = 5,
  COMPILATION_ERROR = 6,
  RUNTIME_ERROR = 7,
  INTERNAL_ERROR = 8,
  EXEC_FORMAT_ERROR = 9
}

// Interface for submission request
interface SubmissionRequest {
  language_id: number;
  source_code: string;
  stdin: string;
}

// Interface for submission response
export interface SubmissionResponse {
  token: string;
}

// Interface for submission result
export interface SubmissionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string;
  memory: number;
  status: {
    id: number;
    description: string;
  };
}

// Create a new submission
export const createSubmission = async (code: string, language: string, input: string): Promise<string> => {
  try {
    const languageId = LANGUAGE_IDS[language as keyof typeof LANGUAGE_IDS];
    if (!languageId) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const encodedCode = btoa(code);
    const encodedInput = btoa(input);

    const response = await axios.post(
      `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=false`,
      {
        language_id: languageId,
        source_code: encodedCode,
        stdin: encodedInput
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.token;
  } catch (error) {
    console.error('Error creating submission:', error);
    throw new Error('Failed to create submission');
  }
};

// Get submission result
export const getSubmissionResult = async (token: string): Promise<SubmissionResult> => {
  try {
    const response = await axios.get(
      `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=true`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const result = response.data;
    
    // Decode base64 outputs
    if (result.stdout) {
      result.stdout = atob(result.stdout);
    }
    if (result.stderr) {
      result.stderr = atob(result.stderr);
    }
    if (result.compile_output) {
      result.compile_output = atob(result.compile_output);
    }
    
    // Clean and normalize outputs by removing whitespace and normalizing line endings
    result.stdout = result.stdout?.trim().replace(/\r\n/g, '\n') || '';
    result.stderr = result.stderr?.trim().replace(/\r\n/g, '\n') || '';
    result.compile_output = result.compile_output?.trim().replace(/\r\n/g, '\n') || '';

    return result;
  } catch (error) {
    console.error('Error getting submission result:', error);
    throw new Error('Failed to get submission result');
  }
};
