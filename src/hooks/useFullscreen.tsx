
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const MAX_WARNINGS = 2;
export const MAX_SECONDS_OUT_OF_VIEW = 30;

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const { fullscreenWarnings, addFullscreenWarning, endAssessment, assessment } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fullscreenExitHandledRef = useRef<boolean>(false);
  const lastVisibilityState = useRef<boolean>(true);
  const visibilityViolations = useRef<number>(0);
  const outOfViewTimerRef = useRef<number | null>(null);
  const outOfViewStartTimeRef = useRef<number | null>(null);

  const checkFullscreen = useCallback(() => {
    const isDocumentFullscreen =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement;
    return !!isDocumentFullscreen;
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      const docElm = document.documentElement;
      await docElm.requestFullscreen();
      setIsFullscreen(true);
      setShowExitWarning(false);
      fullscreenExitHandledRef.current = false;
      
      // Clear any out-of-view timers when returning to fullscreen
      if (outOfViewTimerRef.current) {
        clearTimeout(outOfViewTimerRef.current);
        outOfViewTimerRef.current = null;
      }
      outOfViewStartTimeRef.current = null;
    } catch (error) {
      console.error('Failed to enter fullscreen mode:', error);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch (error) {
      console.error('Failed to exit fullscreen mode:', error);
    }
  }, []);

  const recordFullscreenViolation = useCallback(async (violationType: 'fullscreen' | 'visibility') => {
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
      
      // Calculate total violations for termination decision
      const totalViolations = violationType === 'fullscreen' 
        ? (fullscreenWarnings + 1) 
        : (visibilityViolations.current);
        
      const isTerminated = totalViolations >= MAX_WARNINGS;
      
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          fullscreen_violations: violationType === 'fullscreen' 
            ? (submission.fullscreen_violations || 0) + 1 
            : submission.fullscreen_violations,
          is_terminated: isTerminated
        })
        .eq('id', submission.id);

      if (updateError) {
        console.error('Error updating submission with violation:', updateError);
      }

      // Update the results table if this violation leads to termination
      if (isTerminated) {
        const { error: resultError } = await supabase
          .from('results')
          .update({ 
            isTerminated: true,
            completed_at: new Date().toISOString()
          })
          .eq('assessment_id', assessment.id)
          .eq('user_id', submission.user_id);

        if (resultError) {
          console.error('Error updating result termination status:', resultError);
        }
      }
    } catch (error) {
      console.error('Error recording violation:', error);
    }
  }, [assessment, fullscreenWarnings]);

  const handleFullscreenChange = useCallback(() => {
    const fullscreenStatus = checkFullscreen();
    
    if (!fullscreenStatus) {
      if (!fullscreenExitHandledRef.current) {
        fullscreenExitHandledRef.current = true;
        setShowExitWarning(true);
        addFullscreenWarning();
        recordFullscreenViolation('fullscreen');
        
        toast({
          title: "Warning",
          description: "Please return to fullscreen mode immediately. This is violation " + (fullscreenWarnings + 1) + "/" + MAX_WARNINGS,
          variant: "destructive",
        });
        
        // Start timing when out of fullscreen
        outOfViewStartTimeRef.current = Date.now();
        
        // Set timeout to terminate assessment after MAX_SECONDS_OUT_OF_VIEW seconds
        outOfViewTimerRef.current = window.setTimeout(() => {
          toast({
            title: "Assessment Terminated",
            description: `You've been out of fullscreen mode for more than ${MAX_SECONDS_OUT_OF_VIEW} seconds. Your assessment is now terminated.`,
            variant: "destructive",
          });
          endAssessment();
          navigate('/summary');
        }, MAX_SECONDS_OUT_OF_VIEW * 1000);
        
        if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
          endAssessment();
          navigate('/summary');
        }
      }
    } else {
      fullscreenExitHandledRef.current = false;
      setShowExitWarning(false);
      
      // Clear timeout when returning to fullscreen
      if (outOfViewTimerRef.current) {
        clearTimeout(outOfViewTimerRef.current);
        outOfViewTimerRef.current = null;
      }
      
      // Calculate elapsed time out of fullscreen
      let elapsedTimeMessage = "";
      if (outOfViewStartTimeRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - outOfViewStartTimeRef.current) / 1000);
        elapsedTimeMessage = `You were out of fullscreen for ${elapsedSeconds} seconds.`;
        outOfViewStartTimeRef.current = null;
      }
      
      toast({
        title: "Fullscreen Mode",
        description: `You have returned to fullscreen mode. ${elapsedTimeMessage}`,
      });
    }
  }, [
    checkFullscreen,
    fullscreenWarnings,
    recordFullscreenViolation,
    endAssessment,
    navigate,
    addFullscreenWarning,
    toast
  ]);

  // Handle visibility change (tab switching, window switching)
  const handleVisibilityChange = useCallback(() => {
    // Only act if we're in assessment mode
    if (!assessment) return;
    
    const isVisible = !document.hidden;
    
    // Tab/window switched
    if (lastVisibilityState.current && !isVisible) {
      visibilityViolations.current += 1;
      setTabSwitchWarning(true);
      
      recordFullscreenViolation('visibility');
      
      toast({
        title: "Warning",
        description: `You left the assessment tab/window. This is violation ${visibilityViolations.current}/${MAX_WARNINGS}`,
        variant: "destructive",
      });
      
      // Start timing when out of view
      outOfViewStartTimeRef.current = Date.now();
      
      // Set timeout to terminate assessment after MAX_SECONDS_OUT_OF_VIEW seconds
      outOfViewTimerRef.current = window.setTimeout(() => {
        toast({
          title: "Assessment Terminated",
          description: `You've been away from the assessment tab for more than ${MAX_SECONDS_OUT_OF_VIEW} seconds. Your assessment is now terminated.`,
          variant: "destructive",
        });
        endAssessment();
        navigate('/summary');
      }, MAX_SECONDS_OUT_OF_VIEW * 1000);
      
      if (visibilityViolations.current >= MAX_WARNINGS) {
        endAssessment();
        navigate('/summary');
      }
    } 
    // Returned to tab/window
    else if (!lastVisibilityState.current && isVisible) {
      setTabSwitchWarning(false);
      
      // Clear timeout when returning to tab
      if (outOfViewTimerRef.current) {
        clearTimeout(outOfViewTimerRef.current);
        outOfViewTimerRef.current = null;
      }
      
      // Calculate elapsed time out of tab
      let elapsedTimeMessage = "";
      if (outOfViewStartTimeRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - outOfViewStartTimeRef.current) / 1000);
        elapsedTimeMessage = `You were away for ${elapsedSeconds} seconds.`;
        outOfViewStartTimeRef.current = null;
      }
      
      toast({
        title: "Assessment Tab",
        description: `You have returned to the assessment tab. ${elapsedTimeMessage}`,
      });
    }
    
    // Update last state
    lastVisibilityState.current = isVisible;
  }, [assessment, recordFullscreenViolation, toast, navigate, endAssessment]);

  useEffect(() => {
    const handler = () => handleFullscreenChange();

    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('mozfullscreenchange', handler);
    document.addEventListener('MSFullscreenChange', handler);

    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
      document.removeEventListener('mozfullscreenchange', handler);
      document.removeEventListener('MSFullscreenChange', handler);
    };
  }, [handleFullscreenChange]);

  // Set up visibility change detection
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      if (outOfViewTimerRef.current) {
        clearTimeout(outOfViewTimerRef.current);
        outOfViewTimerRef.current = null;
      }
    };
  }, []);

  const terminateAssessment = useCallback(() => {
    endAssessment();
    navigate('/summary');
  }, [endAssessment, navigate]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    fullscreenWarnings,
    visibilityViolations: visibilityViolations.current,
    showExitWarning,
    tabSwitchWarning,
    terminateAssessment,
  };
};
