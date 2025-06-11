
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { user_id } = await req.json();

    if (!user_id) {
      console.log('Missing user_id in request');
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Validating user_id:', user_id);

    // First try to validate user exists in auth table
    let user = null;
    let userError = null;

    const { data: authUser, error: authError } = await supabase
      .from('auth')
      .select('id, email, name')
      .eq('id', user_id)
      .single();

    if (authError || !authUser) {
      console.log('User not found in auth table, trying users table:', authError?.message);
      
      // Try users table as fallback
      const { data: usersUser, error: usersError } = await supabase
        .from('users')
        .select('id, email, username')
        .eq('id', user_id)
        .single();

      if (usersError || !usersUser) {
        console.log('User not found in users table either:', usersError?.message);
        return new Response(
          JSON.stringify({ error: 'Invalid user_id - user not found in any table' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      user = usersUser;
      console.log('User found in users table:', usersUser.email || usersUser.username);
    } else {
      user = authUser;
      console.log('User found in auth table:', authUser.email);
    }

    // Generate a secure token
    const token = crypto.randomUUID();
    
    // Store token in auto_login_tokens table (expires in 5 minutes)
    const { error: tokenError } = await supabase
      .from('auto_login_tokens')
      .insert({
        user_id: user_id,
        token: token,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
        used: false
      });

    if (tokenError) {
      console.error('Error storing token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate login token' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Auto-login token generated successfully for user:', user.email || user.username);

    // Return the auto-login URL
    const baseUrl = req.headers.get('origin') || Deno.env.get('SUPABASE_URL')?.replace('//', '//').replace('supabase.co', 'lovable.app') || 'http://localhost:3000';
    const autoLoginUrl = `${baseUrl}/auto-login?token=${token}`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        auto_login_url: autoLoginUrl,
        expires_in: 300 // 5 minutes in seconds
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
