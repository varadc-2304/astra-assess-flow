
import { supabase } from '@/integrations/supabase/client';

export const createQuestionsBucket = async () => {
  try {
    const { data, error } = await supabase
      .storage
      .createBucket('questions', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });
    
    if (error) {
      console.error('Error creating questions bucket:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error creating questions bucket:', error);
    return false;
  }
};

export const checkAndCreateQuestionsBucket = async () => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }
    
    const questionsBucketExists = data.some(bucket => bucket.name === 'questions');
    
    if (!questionsBucketExists) {
      await createQuestionsBucket();
    }
  } catch (error) {
    console.error('Error checking buckets:', error);
  }
};
