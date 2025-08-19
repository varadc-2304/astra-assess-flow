
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const MAX_WARNINGS = 2;

export const useTabSwitching = () => {
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const { fullscreenWarnings, addFullscreenWarning, endAssessment, assessment } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();
  const lastVisibilityState = useRef<boolean>(true);
  const visibilityViolations = useRef<number>(0);

  const recordTabSwitchViolation = useCallback(async () => {
    if (!assessment) return;

    try {
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (submissionError || !submissions || submissions.length === 0) {
        console.error('Error finding submission to update:', submissionError);
        return;
      }

      const submission = submissions[0];
      const newViolationCount = visibilityViolations.current;
      const isTerminated = newViolationCount >= MAX_WARNINGS;
      
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          fullscreen_violations: (submission.fullscreen_violations || 0) + 1,
          is_terminated: isTerminated
        })
        .eq('id', submission.id);

      if (updateError) {
        console.error('Error updating submission with tab switch violation:', updateError);
      }

      // If this violation leads to termination, update the results table immediately
      if (isTerminated) {
        // Check if result already exists
        const { data: existingResults, error: resultCheckError } = await supabase
          .from('results')
          .select('*')
          .eq('assessment_id', assessment.id)
          .eq('user_id', submission.user_id)
          .eq('submission_id', submission.id)
          .limit(1);

        if (!resultCheckError && existingResults && existingResults.length > 0) {
          // Update existing result
          const { error: resultError } = await supabase
            .from('results')
            .update({ 
              is_cheated: true,
              completed_at: new Date().toISOString()
            })
            .eq('id', existingResults[0].id);

          if (resultError) {
            console.error('Error updating existing result termination status:', resultError);
          }
        } else {
          // Create new result with cheating flag
          const { error: resultError } = await supabase
            .from('results')
            .insert({
              user_id: submission.user_id,
              assessment_id: assessment.id,
              submission_id: submission.id,
              total_score: 0, // Will be updated by endAssessment with actual score
              total_marks: 0, // Will be updated by endAssessment
              percentage: 0,  // Will be updated by endAssessment
              is_cheated: true,
              completed_at: new Date().toISOString()
            });

          if (resultError) {
            console.error('Error creating result with termination status:', resultError);
          }
        }
      }
    } catch (error) {
      console.error('Error recording tab switch violation:', error);
    }
  }, [assessment]);


  // Handle visibility change (tab switching, window switching)
  const handleVisibilityChange = useCallback(() => {
    // Only act if we're in assessment mode
    if (!assessment) return;
    
    const isVisible = !document.hidden;
    
    // Tab/window switched
    if (lastVisibilityState.current && !isVisible) {
      visibilityViolations.current += 1;
      setTabSwitchWarning(true);
      
      recordTabSwitchViolation();
      
      toast({
        title: "Warning",
        description: `You left the assessment tab/window. This is violation ${visibilityViolations.current}/${MAX_WARNINGS}`,
        variant: "destructive",
      });
      
      if (visibilityViolations.current >= MAX_WARNINGS) {
        endAssessment();
        navigate('/summary');
      }
    } 
    // Returned to tab/window
    else if (!lastVisibilityState.current && isVisible) {
      setTabSwitchWarning(false);
      
      toast({
        title: "Assessment Tab",
        description: "You have returned to the assessment tab.",
      });
    }
    
    // Update last state
    lastVisibilityState.current = isVisible;
  }, [assessment, recordTabSwitchViolation, toast, navigate, endAssessment]);


  // Set up visibility change detection
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  const terminateAssessment = useCallback(() => {
    endAssessment();
    navigate('/summary');
  }, [endAssessment, navigate]);

  return {
    tabSwitchWarning,
    visibilityViolations: visibilityViolations.current,
    terminateAssessment,
  };
};
