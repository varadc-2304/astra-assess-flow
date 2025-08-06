import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query the auth table to validate credentials
    const { data: authData, error: authError } = await supabase
      .from('auth')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (authError || !authData) {
      console.log('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return user data
    const userData = {
      id: authData.id,
      name: authData.name || authData.username || authData.email?.split('@')[0] || '',
      email: authData.email,
      role: 'student',
      prn: authData.prn || undefined,
      year: authData.year || undefined,
      department: authData.department || undefined,
      division: authData.division || undefined,
      batch: authData.batch || undefined,
    };

    console.log('Authentication successful for:', email);

    return new Response(
      JSON.stringify({ success: true, user: userData }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Authentication error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred during authentication' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});