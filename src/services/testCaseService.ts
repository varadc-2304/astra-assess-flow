
import { supabase } from '@/integrations/supabase/client';
import { TestCase } from '@/types/database';

export const fetchTestCases = async (questionId: string): Promise<TestCase[]> => {
  try {
    const { data: testCases, error } = await supabase
      .from('test_cases')
      .select('*')
      .eq('question_id', questionId)
      .order('order_index', { ascending: true });
      
    if (error) {
      throw error;
    }
    
    return testCases || [];
  } catch (error) {
    console.error('Error fetching test cases:', error);
    return [];
  }
};
