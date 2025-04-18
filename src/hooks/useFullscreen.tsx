import { useState, useEffect, useCallback } from 'react';
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
  const { fullscreenWarnings, addFullscreenWarning, endAssessment, assessment } = useAssessment();
  const navigate = useNavigate();

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
    setIsFullscreen(fullscreenStatus);
    
    if (!fullscreenStatus) {
      setFullscreenExitTime(Date.now());
      addFullscreenWarning();
      recordFullscreenViolation();
      setShowExitDialog(true);
      
      if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
        endAssessment();
        navigate('/summary');
      }
    } else {
      setFullscreenExitTime(null);
      setShowExitDialog(false);
    }
  }, [checkFullscreen, fullscreenWarnings, addFullscreenWarning, endAssessment, recordFullscreenViolation, navigate]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    
    if (fullscreenExitTime !== null) {
      timer = setInterval(() => {
        const secondsOut = Math.floor((Date.now() - fullscreenExitTime) / 1000);
        
        if (secondsOut >= MAX_FULLSCREEN_EXIT_TIME) {
          endAssessment();
          navigate('/summary');
          clearInterval(timer);
        }
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [fullscreenExitTime, endAssessment, navigate]);

  const handleReturnToHome = useCallback(() => {
    endAssessment();
    navigate('/summary');
  }, [endAssessment, navigate]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    fullscreenWarnings,
    ExitDialog: () => (
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Fullscreen Mode Exited</AlertDialogTitle>
          <AlertDialogDescription>
            You have exited fullscreen mode. This is violation {fullscreenWarnings}/{MAX_WARNINGS}.
            Please return to fullscreen immediately or your test will be terminated.
            <div className="mt-2 font-semibold text-red-600">
              You have {MAX_FULLSCREEN_EXIT_TIME} seconds to return to fullscreen.
            </div>
          </AlertDialogDescription>
          <div className="flex justify-between mt-4">
            <AlertDialogAction onClick={() => enterFullscreen()}>
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
