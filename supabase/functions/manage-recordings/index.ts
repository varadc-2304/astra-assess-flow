
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, sessionId, userId } = await req.json()

    switch (action) {
      case 'get_recording_url':
        // Get a signed URL for viewing a recording
        const { data: session } = await supabaseClient
          .from('proctoring_sessions')
          .select('recording_path, user_id')
          .eq('id', sessionId)
          .single()

        if (!session?.recording_path) {
          return new Response(
            JSON.stringify({ error: 'Recording not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if user has access (either owner or admin)
        const { data: authUser } = await supabaseClient.auth.getUser()
        const isOwner = session.user_id === userId
        const isAdmin = authUser.user?.user_metadata?.role === 'admin'

        if (!isOwner && !isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized access' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Generate signed URL for the recording
        const { data: signedUrl, error: urlError } = await supabaseClient.storage
          .from('proctoring-recordings')
          .createSignedUrl(session.recording_path, 3600) // 1 hour expiry

        if (urlError) {
          console.error('Error creating signed URL:', urlError)
          return new Response(
            JSON.stringify({ error: 'Failed to generate recording URL' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ url: signedUrl.signedUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'cleanup_old_recordings':
        // Admin function to cleanup old recordings (older than 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: oldSessions } = await supabaseClient
          .from('proctoring_sessions')
          .select('id, recording_path')
          .lt('created_at', thirtyDaysAgo.toISOString())
          .not('recording_path', 'is', null)

        if (oldSessions && oldSessions.length > 0) {
          // Delete files from storage
          const filesToDelete = oldSessions
            .filter(session => session.recording_path)
            .map(session => session.recording_path)

          if (filesToDelete.length > 0) {
            const { error: deleteError } = await supabaseClient.storage
              .from('proctoring-recordings')
              .remove(filesToDelete)

            if (deleteError) {
              console.error('Error deleting old recordings:', deleteError)
            }

            // Update database records
            await supabaseClient
              .from('proctoring_sessions')
              .update({ 
                recording_path: null,
                recording_status: 'deleted' 
              })
              .in('id', oldSessions.map(s => s.id))
          }
        }

        return new Response(
          JSON.stringify({ 
            message: `Cleaned up ${oldSessions?.length || 0} old recordings` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error in manage-recordings function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
