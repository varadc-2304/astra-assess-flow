
import { useState, useEffect, useCallback } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const navigate = useNavigate();

  const MAX_WARNINGS = 3;
  const MAX_FULLSCREEN_EXIT_TIME = 30; // seconds

  // Check if browser is in fullscreen mode
  const checkFullscreen = useCallback(() => {
    const isDocumentFullscreen = 
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement;
    
    return !!isDocumentFullscreen;
  }, []);

  // Enter fullscreen
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
      toast({
        title: "Fullscreen Error",
        description: "Could not enter fullscreen mode. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Exit fullscreen
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

  // Record a fullscreen violation in the database
  const recordFullscreenViolation = useCallback(async () => {
    if (!assessment) return;
    
    try {
      // Find the latest submission for this assessment
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
      
      // Update the submission with a new fullscreen violation
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

  // Handle fullscreen change events
  const handleFullscreenChange = useCallback(() => {
    const fullscreenStatus = checkFullscreen();
    setIsFullscreen(fullscreenStatus);
    
    if (!fullscreenStatus) {
      // User exited fullscreen
      setFullscreenExitTime(Date.now());
      addFullscreenWarning();
      recordFullscreenViolation();
      
      // Show exit dialog (and don't hide it automatically)
      setShowExitDialog(true);
      
      toast({
        title: `Warning ${fullscreenWarnings + 1}/${MAX_WARNINGS}`,
        description: "Please return to fullscreen mode immediately. Multiple violations will terminate your test.",
        variant: "destructive",
      });
      
      // If this is the third warning, end the assessment
      if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
        toast({
          title: "Test Terminated",
          description: "You've exited fullscreen mode too many times. Your test has been terminated.",
          variant: "destructive",
        });
        endAssessment();
        navigate('/summary');
      }
    } else {
      // User returned to fullscreen
      setFullscreenExitTime(null);
      setShowExitDialog(false);
    }
  }, [checkFullscreen, fullscreenWarnings, addFullscreenWarning, endAssessment, toast, recordFullscreenViolation, navigate]);

  // Monitor time spent outside fullscreen
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    
    if (fullscreenExitTime !== null) {
      timer = setInterval(() => {
        const secondsOut = Math.floor((Date.now() - fullscreenExitTime) / 1000);
        
        if (secondsOut >= MAX_FULLSCREEN_EXIT_TIME) {
          toast({
            title: "Test Terminated",
            description: `You've been outside fullscreen mode for over ${MAX_FULLSCREEN_EXIT_TIME} seconds. Your test has been terminated.`,
            variant: "destructive",
          });
          endAssessment();
          navigate('/summary');
          clearInterval(timer);
        } else if (secondsOut % 10 === 0 && secondsOut > 0) {
          // Remind every 10 seconds
          toast({
            title: "Return to Fullscreen",
            description: `You've been out of fullscreen for ${secondsOut} seconds. Test will terminate after ${MAX_FULLSCREEN_EXIT_TIME - secondsOut} more seconds.`,
            variant: "destructive",
          });
        }
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [fullscreenExitTime, endAssessment, toast, navigate]);

  // Register event listeners
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // Check initial fullscreen state
    setIsFullscreen(checkFullscreen());
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [handleFullscreenChange, checkFullscreen]);
  
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
