
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://kojjahbqqhjiexlwkwhr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvamphaGJxcWhqaWV4bHdrd2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MjQ3NzYsImV4cCI6MjA2MDIwMDc3Nn0.RU-eVCwLTBI4qSFmq6h8wp5XEaqwZUnDc79_Zp6MI2I";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
