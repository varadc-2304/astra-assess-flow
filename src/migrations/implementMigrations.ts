
import { supabase } from '../integrations/supabase/client';
import faceViolationsMigration from './add_face_violations_column.sql';

export const runMigrations = async () => {
  try {
    // Run the face violations migration
    await supabase.rpc('exec_sql', { sql: faceViolationsMigration });
    console.log('Face violations column migration completed successfully');
    return true;
  } catch (error) {
    console.error('Error running migrations:', error);
    return false;
  }
};
