
import { supabase } from '../integrations/supabase/client';

// Import the SQL as a string
const faceViolationsMigration = `
-- Add face_violations column to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS face_violations JSONB DEFAULT '[]';
`;

export const runMigrations = async () => {
  try {
    // Execute the SQL directly using query method instead of RPC
    const { error } = await supabase.query(faceViolationsMigration);
    
    if (error) {
      console.error('Error running face violations migration:', error);
      return false;
    }
    
    console.log('Face violations column migration completed successfully');
    return true;
  } catch (error) {
    console.error('Error running migrations:', error);
    return false;
  }
};
