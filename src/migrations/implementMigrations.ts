
import { supabase } from '../integrations/supabase/client';

// Import the SQL as a string
const faceViolationsMigration = `
-- Add face_violations column to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS face_violations JSONB DEFAULT '[]';
`;

export const runMigrations = async () => {
  try {
    // Execute the SQL migration using our new exec_sql function
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: faceViolationsMigration
    });
    
    if (error) {
      console.error('Error running face violations migration:', error);
      return false;
    }
    
    console.log('Face violations migration completed successfully');
    return true;
  } catch (error) {
    console.error('Error running migrations:', error);
    return false;
  }
};
