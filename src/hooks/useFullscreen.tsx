
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
  const [timeOutOfFocus, setTimeOutOfFocus] = useState(0);
  const { fullscreenWarnings, addFullscreenWarning, endAssessment, assessment } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fullscreenExitHandledRef = useRef<boolean>(false);
  const lastVisibilityState = useRef<boolean>(true);
  const visibilityViolations = useRef<number>(0);
  const outOfFocusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const outOfFocusStartTimeRef = useRef<number | null>(null);

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
      
      // Clear any timers when returning to fullscreen
      if (outOfFocusTimerRef.current) {
        clearInterval(outOfFocusTimerRef.current);
        outOfFocusTimerRef.current = null;
      }
      outOfFocusStartTimeRef.current = null;
      setTimeOutOfFocus(0);
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

  // Handle out-of-focus timer logic
  const startOutOfFocusTimer = useCallback(() => {
    if (outOfFocusTimerRef.current) return; // Timer already running
    
    outOfFocusStartTimeRef.current = Date.now();
    
    outOfFocusTimerRef.current = setInterval(() => {
      if (outOfFocusStartTimeRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - outOfFocusStartTimeRef.current) / 1000);
        setTimeOutOfFocus(elapsedSeconds);
        
        // If user has been out of focus for too long, terminate assessment
        if (elapsedSeconds >= MAX_SECONDS_OUT_OF_VIEW) {
          clearInterval(outOfFocusTimerRef.current!);
          outOfFocusTimerRef.current = null;
          
          toast({
            title: "Assessment Terminated",
            description: `You were out of focus for more than ${MAX_SECONDS_OUT_OF_VIEW} seconds. Your assessment has been terminated.`,
            variant: "destructive",
          });
          
          // Mark assessment as terminated due to time violation
          recordTimeViolationTermination();
          
          // End assessment and redirect
          endAssessment();
          navigate('/summary');
        }
      }
    }, 1000);
    
  }, [endAssessment, navigate, toast]);
  
  const stopOutOfFocusTimer = useCallback(() => {
    if (outOfFocusTimerRef.current) {
      clearInterval(outOfFocusTimerRef.current);
      outOfFocusTimerRef.current = null;
    }
    outOfFocusStartTimeRef.current = null;
    setTimeOutOfFocus(0);
  }, []);

  const recordTimeViolationTermination = useCallback(async () => {
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
      
      // Update submission as terminated due to time violation
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          is_terminated: true,
          time_violation: true
        })
        .eq('id', submission.id);

      if (updateError) {
        console.error('Error updating submission with time violation:', updateError);
      }

      // Update the results table
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
      
    } catch (error) {
      console.error('Error recording time violation:', error);
    }
  }, [assessment]);

  const handleFullscreenChange = useCallback(() => {
    const fullscreenStatus = checkFullscreen();
    
    if (!fullscreenStatus) {
      if (!fullscreenExitHandledRef.current) {
        fullscreenExitHandledRef.current = true;
        setShowExitWarning(true);
        addFullscreenWarning();
        recordFullscreenViolation('fullscreen');
        
        // Start timing how long they're out of fullscreen
        startOutOfFocusTimer();
        
        toast({
          title: "Warning",
          description: "Please return to fullscreen mode immediately. This is violation " + (fullscreenWarnings + 1) + "/" + MAX_WARNINGS,
          variant: "destructive",
        });
        
        if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
          endAssessment();
          navigate('/summary');
        }
      }
    } else {
      fullscreenExitHandledRef.current = false;
      setShowExitWarning(false);
      
      // Stop timing when returning to fullscreen
      stopOutOfFocusTimer();
      
      toast({
        title: "Fullscreen Mode",
        description: "You have returned to fullscreen mode.",
      });
    }
  }, [
    checkFullscreen,
    fullscreenWarnings,
    recordFullscreenViolation,
    endAssessment,
    navigate,
    addFullscreenWarning,
    toast,
    startOutOfFocusTimer,
    stopOutOfFocusTimer
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
      
      // Start timing how long they're away
      startOutOfFocusTimer();
      
      recordFullscreenViolation('visibility');
      
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
      
      // Reset timer when returning to tab
      if (!showExitWarning) { // Only if not also out of fullscreen
        stopOutOfFocusTimer();
      }
      
      toast({
        title: "Assessment Tab",
        description: "You have returned to the assessment tab.",
      });
    }
    
    // Update last state
    lastVisibilityState.current = isVisible;
  }, [
    assessment, 
    recordFullscreenViolation, 
    toast, 
    navigate, 
    endAssessment, 
    startOutOfFocusTimer, 
    stopOutOfFocusTimer, 
    showExitWarning
  ]);

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
      if (outOfFocusTimerRef.current) {
        clearInterval(outOfFocusTimerRef.current);
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
    timeOutOfFocus
  };
};
