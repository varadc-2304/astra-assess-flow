
import { TestCase } from '@/types/database';
import { createSubmission, waitForSubmissionResult } from '@/services/judge0Service';

export interface TestResult {
  passed: boolean;
  actualOutput?: string;
  marks?: number;
  isHidden?: boolean;
}

export const processTestCase = async (
  code: string,
  language: string,
  testCase: TestCase,
  index: number,
  totalTestCases: number,
  updateOutput: (output: string) => void
): Promise<TestResult> => {
  try {
    const isHidden = testCase.is_hidden;
    const testMarks = testCase.marks || 0;
    
    updateOutput(prev => `${prev}\n\nProcessing test case ${index + 1}/${totalTestCases}...\n`);
    
    const token = await createSubmission(code, language, testCase.input);
    const result = await waitForSubmissionResult(token);
    
    if (result.status.id >= 6) {
      const errorOutput = result.compile_output || result.stderr || 'An error occurred while running your code';
      updateOutput(prev => `${prev}\nError in test case ${index + 1}: ${errorOutput}`);
      
      return { 
        passed: false, 
        actualOutput: `Error: ${errorOutput}`,
        marks: 0,
        isHidden
      };
    }
    
    const actualOutput = result.stdout?.trim() || '';
    const expectedOutput = testCase.output.trim().replace(/\r\n/g, '\n');
    const passed = actualOutput === expectedOutput;
    
    if (!isHidden) {
      const testResultOutput = `Test case ${index + 1}/${totalTestCases} (${testMarks} marks): ${passed ? 'Passed' : 'Failed'}\n` + 
        (!passed ? `Expected Output: "${expectedOutput}"\nYour Output: "${actualOutput}"\n` : '');
      updateOutput(prev => `${prev}\n${testResultOutput}`);
    } else {
      updateOutput(prev => `${prev}\nHidden test case ${index + 1}/${totalTestCases} (${testMarks} marks): ${passed ? 'Passed' : 'Failed'}\n`);
    }
    
    return { 
      passed, 
      actualOutput,
      marks: passed ? testMarks : 0,
      isHidden
    };
  } catch (error) {
    console.error(`Error processing test case ${index + 1}:`, error);
    updateOutput(prev => `${prev}\nError processing test case ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    
    return { 
      passed: false, 
      actualOutput: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      marks: 0,
      isHidden: testCase.is_hidden
    };
  }
};
