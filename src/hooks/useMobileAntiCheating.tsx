import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const MAX_MOBILE_WARNINGS = 2;

interface MobileAntiCheatingOptions {
  enforceFullscreen?: boolean;
  trackTabSwitching?: boolean;
  trackOrientationChanges?: boolean;
}

export const useMobileAntiCheating = (options: MobileAntiCheatingOptions = {}) => {
  const {
    enforceFullscreen = true,
    trackTabSwitching = true,
    trackOrientationChanges = true
  } = options;

  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const [showMobileExitWarning, setShowMobileExitWarning] = useState(false);
  const [mobileTabSwitchWarning, setMobileTabSwitchWarning] = useState(false);
  const [mobileViolations, setMobileViolations] = useState(0);
  
  const { toast } = useToast();
  const { assessment, endAssessment } = useAssessment();
  const navigate = useNavigate();
  
  const lastVisibilityState = useRef<boolean>(true);
  const fullscreenExitHandledRef = useRef<boolean>(false);
  const orientationChangeHandledRef = useRef<boolean>(false);

  // Detect if device is mobile
  const isMobileDevice = useCallback(() => {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  // Check if mobile is in fullscreen-like mode
  const checkMobileFullscreen = useCallback(() => {
    if (!isMobileDevice()) return true; // Non-mobile devices always pass
    
    const viewportHeight = window.innerHeight;
    const screenHeight = window.screen.height;
    const isStandalone = (window.navigator as any).standalone === true; // iOS Safari
    const isFullHeight = viewportHeight >= screenHeight * 0.90; // Allow some tolerance for mobile browsers
    
    // Check if address bar is hidden (mobile fullscreen indicators)
    const hasMinimalUI = window.outerHeight - window.innerHeight < 100;
    
    return isStandalone || isFullHeight || hasMinimalUI;
  }, [isMobileDevice]);

  // Enter mobile fullscreen mode
  const enterMobileFullscreen = useCallback(async () => {
    if (!isMobileDevice()) return;
    
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

      // Lock orientation if supported (portrait mode for assessment)
      if (window.screen?.orientation && 'lock' in window.screen.orientation) {
        try {
          await (window.screen.orientation as any).lock('portrait-primary');
        } catch (error) {
          console.log('Orientation lock not supported:', error);
        }
      }

      // Additional mobile-specific adjustments
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }

      setIsMobileFullscreen(true);
      setShowMobileExitWarning(false);
      fullscreenExitHandledRef.current = false;
      
      toast({
        title: "Mobile Fullscreen Mode",
        description: "Assessment is now in fullscreen mode for anti-cheating protection.",
      });
    } catch (error) {
      console.error('Failed to enter mobile fullscreen:', error);
      toast({
        title: "Fullscreen Required",
        description: "Please enable fullscreen mode to continue with the assessment on mobile.",
        variant: "destructive",
      });
    }
  }, [isMobileDevice, toast]);

  // Record mobile violation
  const recordMobileViolation = useCallback(async (violationType: 'fullscreen' | 'visibility' | 'orientation') => {
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
      const newViolationCount = (submission.fullscreen_violations || 0) + 1;
      const isTerminated = newViolationCount >= MAX_MOBILE_WARNINGS;
      
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          fullscreen_violations: newViolationCount,
          is_terminated: isTerminated
        })
        .eq('id', submission.id);

      if (updateError) {
        console.error('Error updating submission with mobile violation:', updateError);
      }

      setMobileViolations(newViolationCount);

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
      console.error('Error recording mobile violation:', error);
    }
  }, [assessment]);

  // Handle mobile fullscreen changes
  const handleMobileFullscreenChange = useCallback(() => {
    if (!isMobileDevice() || !enforceFullscreen) return;
    
    const isFullscreen = checkMobileFullscreen();
    setIsMobileFullscreen(isFullscreen);
    
    if (!isFullscreen && !fullscreenExitHandledRef.current) {
      fullscreenExitHandledRef.current = true;
      setShowMobileExitWarning(true);
      recordMobileViolation('fullscreen');
      
      const newViolationCount = mobileViolations + 1;
      
      toast({
        title: "Mobile Fullscreen Warning",
        description: `Please return to fullscreen mode immediately. Mobile violation ${newViolationCount}/${MAX_MOBILE_WARNINGS}`,
        variant: "destructive",
      });
      
      if (newViolationCount >= MAX_MOBILE_WARNINGS) {
        toast({
          title: "Assessment Terminated",
          description: "Too many mobile fullscreen violations. Assessment is being terminated.",
          variant: "destructive",
        });
        setTimeout(() => {
          endAssessment();
          navigate('/summary');
        }, 2000);
      }
    } else if (isFullscreen) {
      fullscreenExitHandledRef.current = false;
      setShowMobileExitWarning(false);
    }
  }, [isMobileDevice, enforceFullscreen, checkMobileFullscreen, mobileViolations, recordMobileViolation, toast, endAssessment, navigate]);

  // Handle mobile visibility changes (app switching)
  const handleMobileVisibilityChange = useCallback(() => {
    if (!isMobileDevice() || !trackTabSwitching || !assessment) return;
    
    const isVisible = !document.hidden;
    
    // App/tab switched on mobile
    if (lastVisibilityState.current && !isVisible) {
      setMobileTabSwitchWarning(true);
      recordMobileViolation('visibility');
      
      const newViolationCount = mobileViolations + 1;
      
      toast({
        title: "Mobile App Switch Warning", 
        description: `You left the assessment app. Mobile violation ${newViolationCount}/${MAX_MOBILE_WARNINGS}`,
        variant: "destructive",
      });
      
      if (newViolationCount >= MAX_MOBILE_WARNINGS) {
        toast({
          title: "Assessment Terminated",
          description: "Too many mobile app switching violations. Assessment is being terminated.",
          variant: "destructive",
        });
        setTimeout(() => {
          endAssessment();
          navigate('/summary');
        }, 2000);
      }
    } 
    // Returned to assessment app
    else if (!lastVisibilityState.current && isVisible) {
      setMobileTabSwitchWarning(false);
      toast({
        title: "Assessment App",
        description: "You have returned to the assessment app.",
      });
    }
    
    lastVisibilityState.current = isVisible;
  }, [isMobileDevice, trackTabSwitching, assessment, mobileViolations, recordMobileViolation, toast, endAssessment, navigate]);

  // Handle orientation changes on mobile
  const handleOrientationChange = useCallback(() => {
    if (!isMobileDevice() || !trackOrientationChanges) return;
    
    setTimeout(() => {
      if (!orientationChangeHandledRef.current) {
        orientationChangeHandledRef.current = true;
        
        // Re-check fullscreen after orientation change
        handleMobileFullscreenChange();
        
        toast({
          title: "Mobile Orientation Change",
          description: "Please ensure you remain in fullscreen mode after orientation change.",
        });
        
        setTimeout(() => {
          orientationChangeHandledRef.current = false;
        }, 1000);
      }
    }, 100); // Small delay to let orientation settle
  }, [isMobileDevice, trackOrientationChanges, handleMobileFullscreenChange, toast]);

  // Set up event listeners
  useEffect(() => {
    if (!isMobileDevice()) return;

    // Fullscreen change listeners
    const fullscreenEvents = [
      'fullscreenchange',
      'webkitfullscreenchange', 
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    fullscreenEvents.forEach(event => {
      document.addEventListener(event, handleMobileFullscreenChange);
    });

    // Mobile-specific listeners
    window.addEventListener('resize', handleMobileFullscreenChange);
    
    if (trackTabSwitching) {
      document.addEventListener('visibilitychange', handleMobileVisibilityChange);
    }
    
    if (trackOrientationChanges) {
      window.addEventListener('orientationchange', handleOrientationChange);
    }

    // Initial check
    handleMobileFullscreenChange();

    return () => {
      fullscreenEvents.forEach(event => {
        document.removeEventListener(event, handleMobileFullscreenChange);
      });
      
      window.removeEventListener('resize', handleMobileFullscreenChange);
      
      if (trackTabSwitching) {
        document.removeEventListener('visibilitychange', handleMobileVisibilityChange);
      }
      
      if (trackOrientationChanges) {
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, [
    isMobileDevice,
    handleMobileFullscreenChange,
    handleMobileVisibilityChange,
    handleOrientationChange,
    trackTabSwitching,
    trackOrientationChanges
  ]);

  return {
    isMobileDevice: isMobileDevice(),
    isMobileFullscreen,
    showMobileExitWarning,
    mobileTabSwitchWarning,
    mobileViolations,
    enterMobileFullscreen,
    checkMobileFullscreen,
  };
};