
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenExitTime, setFullscreenExitTime] = useState<number | null>(null);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const { fullscreenWarnings, addFullscreenWarning, endAssessment, assessment } = useAssessment();
  const navigate = useNavigate();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const persistentTimeRef = useRef<number>(30);
  const fullscreenExitHandledRef = useRef<boolean>(false);
  
  const MAX_WARNINGS = 3;
  const MAX_FULLSCREEN_EXIT_TIME = 30;

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
  };

  const startOrResumeTimer = useCallback(() => {
    clearTimerIfExists();
    persistentTimeRef.current = MAX_FULLSCREEN_EXIT_TIME;
    setTimeRemaining(MAX_FULLSCREEN_EXIT_TIME);

    timerRef.current = setInterval(() => {
      persistentTimeRef.current = Math.max(0, persistentTimeRef.current - 1);
      setTimeRemaining(persistentTimeRef.current);

      if (persistentTimeRef.current <= 0) {
        clearTimerIfExists();
        fullscreenExitHandledRef.current = false;
        endAssessment();
        navigate('/summary');
      }
    }, 1000);
  }, [endAssessment, navigate]);

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
        startOrResumeTimer();
        
        if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
          endAssessment();
          navigate('/summary');
          return;
        }
      }
    } else {
      fullscreenExitHandledRef.current = false;
      clearTimerIfExists();
      setFullscreenExitTime(null);
      setShowExitWarning(false);
    }
  }, [
    checkFullscreen,
    fullscreenWarnings,
    recordFullscreenViolation,
    endAssessment,
    navigate,
    addFullscreenWarning,
    startOrResumeTimer
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
    timeRemaining,
    terminateAssessment,
    MAX_WARNINGS
  };
};
