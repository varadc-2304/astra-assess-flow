import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useMobileFullscreen = () => {
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const { toast } = useToast();

  const checkMobileFullscreen = useCallback(() => {
    // Check if device is mobile
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (!isMobile) return false;

    // Check various mobile fullscreen indicators
    const viewportHeight = window.innerHeight;
    const screenHeight = window.screen.height;
    const isStandalone = (window.navigator as any).standalone === true; // iOS Safari
    const isFullHeight = viewportHeight >= screenHeight * 0.95; // Allow some tolerance

    return isStandalone || isFullHeight;
  }, []);

  const enterMobileFullscreen = useCallback(async () => {
    try {
      // Hide address bar on mobile browsers
      if ('scrollTo' in window) {
        window.scrollTo(0, 1);
      }

      // Request fullscreen if available
      const docElm = document.documentElement;
      if (docElm.requestFullscreen) {
        await docElm.requestFullscreen();
      } else if ((docElm as any).webkitRequestFullscreen) {
        await (docElm as any).webkitRequestFullscreen();
      }

      // Lock orientation if supported
      if (window.screen?.orientation && 'lock' in window.screen.orientation) {
        try {
          await (window.screen.orientation as any).lock('portrait-primary');
        } catch (error) {
          console.log('Orientation lock not supported:', error);
        }
      }

      setIsMobileFullscreen(true);
    } catch (error) {
      console.error('Failed to enter mobile fullscreen:', error);
      toast({
        title: "Fullscreen Required",
        description: "Please enable fullscreen mode to continue with the assessment.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleMobileFullscreenChange = useCallback(() => {
    const isFullscreen = checkMobileFullscreen();
    setIsMobileFullscreen(isFullscreen);
  }, [checkMobileFullscreen]);

  useEffect(() => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Add event listeners for mobile fullscreen detection
    window.addEventListener('resize', handleMobileFullscreenChange);
    window.addEventListener('orientationchange', handleMobileFullscreenChange);
    document.addEventListener('fullscreenchange', handleMobileFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleMobileFullscreenChange);

    // Initial check
    handleMobileFullscreenChange();

    return () => {
      window.removeEventListener('resize', handleMobileFullscreenChange);
      window.removeEventListener('orientationchange', handleMobileFullscreenChange);
      document.removeEventListener('fullscreenchange', handleMobileFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleMobileFullscreenChange);
    };
  }, [handleMobileFullscreenChange]);

  return {
    isMobileFullscreen,
    enterMobileFullscreen,
    checkMobileFullscreen,
  };
};