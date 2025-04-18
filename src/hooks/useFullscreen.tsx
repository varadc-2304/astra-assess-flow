import { useState, useEffect, useCallback, useRef } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const MAX_WARNINGS = 3;
export const MAX_FULLSCREEN_EXIT_TIME = 20;

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenExitTime, setFullscreenExitTime] = useState<number | null>(null);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const { fullscreenWarnings, addFullscreenWarning, endAssessment, assessment } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const persistentTimeRef = useRef<number>(MAX_FULLSCREEN_EXIT_TIME);
  const fullscreenExitHandledRef = useRef<boolean>(false);
  const toastIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkFullscreen = useCallback(() => {
    const isDocumentFullscreen =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement;
    return !!isDocumentFullscreen;
  }, []);

  const clearTimerIfExists = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (toastIntervalRef.current) {
      clearInterval(toastIntervalRef.current);
      toastIntervalRef.current = null;
    }
  };

  const startOrResumeTimer = useCallback(() => {
    clearTimerIfExists();
    persistentTimeRef.current = MAX_FULLSCREEN_EXIT_TIME;
    
    // Show initial warning
    toast({
      title: "Warning",
      description: `Return to fullscreen mode within ${MAX_FULLSCREEN_EXIT_TIME} seconds or your assessment will be terminated.`,
      variant: "destructive",
    });

    // Set up toast interval for remaining time notifications
    toastIntervalRef.current = setInterval(() => {
      const timeLeft = persistentTimeRef.current;
      if (timeLeft === 15 || timeLeft === 10 || timeLeft === 5) {
        toast({
          title: "Warning",
          description: `${timeLeft} seconds remaining to return to fullscreen mode.`,
          variant: "destructive",
        });
      }
    }, 1000);

    timerRef.current = setInterval(() => {
      persistentTimeRef.current = Math.max(0, persistentTimeRef.current - 1);
      console.log('Timer tick:', persistentTimeRef.current);
      
      if (persistentTimeRef.current <= 0) {
        clearTimerIfExists();
        fullscreenExitHandledRef.current = false;
        endAssessment();
        navigate('/summary');
      }
    }, 1000);

    console.log('Timer started with interval ID:', timerRef.current);
    return () => clearTimerIfExists();
  }, [endAssessment, navigate, toast]);

  const enterFullscreen = useCallback(async () => {
    try {
      const docElm = document.documentElement;
      await docElm.requestFullscreen();
      setIsFullscreen(true);
      clearTimerIfExists();
      setFullscreenExitTime(null);
      setShowExitWarning(false);
      fullscreenExitHandledRef.current = false;
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

  const recordFullscreenViolation = useCallback(async () => {
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
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          fullscreen_violations: (submission.fullscreen_violations || 0) + 1,
          is_terminated: fullscreenWarnings + 1 >= MAX_WARNINGS
        })
        .eq('id', submission.id);

      if (updateError) {
        console.error('Error updating submission with fullscreen violation:', updateError);
      }
    } catch (error) {
      console.error('Error recording fullscreen violation:', error);
    }
  }, [assessment, fullscreenWarnings]);

  const handleFullscreenChange = useCallback(() => {
    const fullscreenStatus = checkFullscreen();
    
    if (!fullscreenStatus) {
      if (!fullscreenExitHandledRef.current) {
        fullscreenExitHandledRef.current = true;
        setFullscreenExitTime(Date.now());
        setShowExitWarning(true);
        addFullscreenWarning();
        recordFullscreenViolation();
        
        // Start the timer when exiting fullscreen
        const cleanupTimer = startOrResumeTimer();
        
        if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
          endAssessment();
          navigate('/summary');
          return cleanupTimer;
        }
      }
    } else {
      fullscreenExitHandledRef.current = false;
      clearTimerIfExists();
      setFullscreenExitTime(null);
      setShowExitWarning(false);
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
    startOrResumeTimer,
    toast
  ]);

  useEffect(() => {
    persistentTimeRef.current = MAX_FULLSCREEN_EXIT_TIME;
  }, []);

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
      clearTimerIfExists();
    };
  }, [handleFullscreenChange]);

  const terminateAssessment = useCallback(() => {
    clearTimerIfExists();
    endAssessment();
    navigate('/summary');
  }, [endAssessment, navigate]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    fullscreenWarnings,
    showExitWarning,
    terminateAssessment,
    timeRemaining: persistentTimeRef.current,
  };
};
