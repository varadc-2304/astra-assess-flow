
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { user_id } = body;

    console.log('Auto-login request received for user_id:', user_id);

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate user exists in auth table
    const { data: userData, error: userError } = await supabase
      .from('auth')
      .select('id, email, name, role')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      console.error('User validation error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid user_id' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('User validated:', userData.email);

    // Generate a secure random token
    const token = crypto.randomUUID();

    // Store the auto-login token in database
    const { error: tokenError } = await supabase
      .from('auto_login_tokens')
      .insert({
        user_id: user_id,
        token: token,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
        used: false
      });

    if (tokenError) {
      console.error('Token creation error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create auto-login token' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Auto-login token created successfully');

    // Return the auto-login URL
    const autoLoginUrl = `${req.headers.get('origin') || 'https://tafvjwurzgpugcfidbfv.supabase.co'}/auto-login?token=${token}`;

    return new Response(
      JSON.stringify({ 
        success: true,
        auto_login_url: autoLoginUrl,
        token: token,
        expires_in: 300 // 5 minutes in seconds
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Auto-login error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
