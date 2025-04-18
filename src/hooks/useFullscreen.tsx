
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useNavigate } from 'react-router-dom';
import { 
  AlertDialog, 
  AlertDialogContent, 
  AlertDialogTitle, 
  AlertDialogDescription, 
  AlertDialogAction 
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenExitTime, setFullscreenExitTime] = useState<number | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const { fullscreenWarnings, addFullscreenWarning, endAssessment, assessment } = useAssessment();
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const persistentTimeRef = useRef<number>(30);
  // Changed to use a MutableRefObject with a function type
  const fullscreenChangeHandlerRef = useRef<boolean>(false);

  const MAX_WARNINGS = 3;
  const MAX_FULLSCREEN_EXIT_TIME = 30; // seconds

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
      
      if (docElm.requestFullscreen) {
        await docElm.requestFullscreen();
      } else if ((docElm as any).mozRequestFullScreen) {
        await (docElm as any).mozRequestFullScreen();
      } else if ((docElm as any).webkitRequestFullscreen) {
        await (docElm as any).webkitRequestFullscreen();
      } else if ((docElm as any).msRequestFullscreen) {
        await (docElm as any).msRequestFullscreen();
      }
      
      setIsFullscreen(true);
      clearTimerIfExists();
      setFullscreenExitTime(null);
      setShowExitDialog(false);
    } catch (error) {
      console.error('Failed to enter fullscreen mode:', error);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      
      setIsFullscreen(false);
    } catch (error) {
      console.error('Failed to exit fullscreen mode:', error);
    }
  }, []);

  const clearTimerIfExists = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

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

  // Define startOrResumeTimer before using it in handleFullscreenChange
  const startOrResumeTimer = useCallback(() => {
    clearTimerIfExists();
    
    timerRef.current = setInterval(() => {
      persistentTimeRef.current = Math.max(0, persistentTimeRef.current - 1);
      setTimeRemaining(persistentTimeRef.current);
      
      console.log("Timer update:", { remaining: persistentTimeRef.current, showDialog: showExitDialog });
      
      if (persistentTimeRef.current <= 0) {
        clearTimerIfExists();
        endAssessment();
        navigate('/summary');
      }
    }, 1000);
  }, [endAssessment, navigate, showExitDialog]);

  const handleFullscreenChange = useCallback(() => {
    const fullscreenStatus = checkFullscreen();
    
    if (!fullscreenStatus) {
      if (!fullscreenChangeHandlerRef.current) {
        fullscreenChangeHandlerRef.current = true;
        
        setFullscreenExitTime(Date.now());
        addFullscreenWarning();
        recordFullscreenViolation();
        
        setShowExitDialog(true);
        startOrResumeTimer();
        
        if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
          endAssessment();
          navigate('/summary');
          return;
        }
      }
    } else {
      fullscreenChangeHandlerRef.current = false;
      clearTimerIfExists();
      setFullscreenExitTime(null);
      setShowExitDialog(false);
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

  // We're not actually storing a function in fullscreenChangeHandlerRef anymore, so we don't need this effect
  // Instead, we're directly using the handler inside the event listener

  useEffect(() => {
    const handler = () => {
      handleFullscreenChange();
    };
    
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

  const handleReturnToHome = useCallback(() => {
    clearTimerIfExists();
    endAssessment();
    navigate('/summary');
  }, [endAssessment, navigate]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    fullscreenWarnings,
    ExitDialog: () => (
      <AlertDialog 
        open={showExitDialog} 
        onOpenChange={(open) => {
          if (!open && !isFullscreen) {
            setTimeout(() => setShowExitDialog(true), 0);
          }
        }}
      >
        <AlertDialogContent className="z-[1000]">
          <AlertDialogTitle>Fullscreen Mode Exited</AlertDialogTitle>
          <AlertDialogDescription>
            You have exited fullscreen mode. This is violation {fullscreenWarnings}/{MAX_WARNINGS}.
            Please return to fullscreen immediately or your test will be terminated.
            <div className="mt-2 font-semibold text-red-600">
              Time remaining: {timeRemaining} seconds
            </div>
          </AlertDialogDescription>
          <div className="flex justify-between mt-4">
            <AlertDialogAction onClick={enterFullscreen}>
              Return to Fullscreen
            </AlertDialogAction>
            <AlertDialogAction onClick={handleReturnToHome} className="bg-red-600 hover:bg-red-700">
              End Test
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    )
  };
};
