
import { Json } from "@/integrations/supabase/types";

export interface ProctoringSessions {
  id: string;
  user_id: string;
  assessment_id: string;
  submission_id: string | null;
  recording_path: string;
  started_at: string;
  ended_at: string | null;
  flagged_actions: Json;
  created_at: string;
}
