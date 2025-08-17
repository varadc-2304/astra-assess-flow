import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const MAX_MOBILE_WARNINGS = 2;

interface MobileAntiCheatingOptions {
  trackTabSwitching?: boolean;
  trackOrientationChanges?: boolean;
}

export const useMobileAntiCheating = (options: MobileAntiCheatingOptions = {}) => {
  const {
    trackTabSwitching = true,
    trackOrientationChanges = true
  } = options;

  const [mobileTabSwitchWarning, setMobileTabSwitchWarning] = useState(false);
  const [mobileViolations, setMobileViolations] = useState(0);
  
  const { toast } = useToast();
  const { assessment, endAssessment } = useAssessment();
  const navigate = useNavigate();
  
  const lastVisibilityState = useRef<boolean>(true);

  // Detect if device is mobile
  const isMobileDevice = useCallback(() => {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  // Record mobile violation
  const recordMobileViolation = useCallback(async (violationType: 'visibility' | 'orientation') => {
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
      toast({
        title: "Mobile Orientation Change",
        description: "Please keep the device in the same orientation during assessment.",
      });
    }, 100); // Small delay to let orientation settle
  }, [isMobileDevice, trackOrientationChanges, toast]);

  // Set up event listeners
  useEffect(() => {
    if (!isMobileDevice()) return;

    if (trackTabSwitching) {
      document.addEventListener('visibilitychange', handleMobileVisibilityChange);
    }
    
    if (trackOrientationChanges) {
      window.addEventListener('orientationchange', handleOrientationChange);
    }

    return () => {
      if (trackTabSwitching) {
        document.removeEventListener('visibilitychange', handleMobileVisibilityChange);
      }
      
      if (trackOrientationChanges) {
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, [
    isMobileDevice,
    handleMobileVisibilityChange,
    handleOrientationChange,
    trackTabSwitching,
    trackOrientationChanges
  ]);

  return {
    isMobileDevice: isMobileDevice(),
    mobileTabSwitchWarning,
    mobileViolations,
  };
};