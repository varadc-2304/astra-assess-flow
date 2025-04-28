
import { useState, useEffect } from 'react';

interface UseFullscreenReturn {
  isFullscreen: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => void;
  fullscreenWarnings: number;
  showExitWarning: boolean;
  terminateAssessment: () => void;
  addFullscreenWarning: () => void;
  fullscreenViolations: number;
  setFullscreenViolations: React.Dispatch<React.SetStateAction<number>>;
}

export const useFullscreen = (): UseFullscreenReturn => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showExitWarning, setShowExitWarning] = useState<boolean>(false);
  const [fullscreenWarnings, setFullscreenWarnings] = useState<number>(0);
  const [fullscreenViolations, setFullscreenViolations] = useState<number>(0);

  // Check if fullscreen is supported
  const fullscreenSupported = typeof document !== 'undefined' && (
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );

  // Function to enter fullscreen
  const enterFullscreen = async (): Promise<void> => {
    try {
      if (!fullscreenSupported) {
        console.error('Fullscreen not supported');
        return;
      }

      const docEl = document.documentElement;

      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if ((docEl as any).mozRequestFullScreen) {
        await (docEl as any).mozRequestFullScreen();
      } else if ((docEl as any).webkitRequestFullscreen) {
        await (docEl as any).webkitRequestFullscreen();
      } else if ((docEl as any).msRequestFullscreen) {
        await (docEl as any).msRequestFullscreen();
      }

      setIsFullscreen(true);
      setShowExitWarning(false);
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  };

  // Function to exit fullscreen
  const exitFullscreen = (): void => {
    try {
      if (!fullscreenSupported) {
        console.error('Fullscreen not supported');
        return;
      }

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
      console.error('Error exiting fullscreen:', error);
    }
  };

  // Function to add a fullscreen warning
  const addFullscreenWarning = () => {
    setFullscreenWarnings(prev => prev + 1);
  };

  // Function to terminate assessment
  const terminateAssessment = () => {
    // This would be implemented by the component using this hook
    console.log('Assessment terminated due to fullscreen violations');
    exitFullscreen();
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen) {
        setShowExitWarning(true);
      } else {
        setShowExitWarning(false);
      }
    };

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
  }, []);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    fullscreenWarnings,
    showExitWarning,
    terminateAssessment,
    addFullscreenWarning,
    fullscreenViolations,
    setFullscreenViolations
  };
};
