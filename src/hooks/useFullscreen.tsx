
import { useState, useEffect, useCallback } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useToast } from '@/components/ui/use-toast';

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenExitTime, setFullscreenExitTime] = useState<number | null>(null);
  const { fullscreenWarnings, addFullscreenWarning, endAssessment } = useAssessment();
  const { toast } = useToast();

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

  // Handle fullscreen change events
  const handleFullscreenChange = useCallback(() => {
    const fullscreenStatus = checkFullscreen();
    setIsFullscreen(fullscreenStatus);
    
    if (!fullscreenStatus) {
      // User exited fullscreen
      setFullscreenExitTime(Date.now());
      addFullscreenWarning();
      
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
      }
    } else {
      // User returned to fullscreen
      setFullscreenExitTime(null);
    }
  }, [checkFullscreen, fullscreenWarnings, addFullscreenWarning, endAssessment, toast]);

  // Monitor time spent outside fullscreen
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
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
          clearInterval(timer);
        } else if (secondsOut % 10 === 0) {
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
      clearInterval(timer);
    };
  }, [fullscreenExitTime, endAssessment, toast]);

  // Register event listeners
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [handleFullscreenChange]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    fullscreenWarnings,
  };
};
