
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const MAX_WARNINGS = 2;

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const { fullscreenWarnings, addFullscreenWarning, endAssessment, assessment } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fullscreenExitHandledRef = useRef<boolean>(false);

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
      await docElm.requestFullscreen();
      setIsFullscreen(true);
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

      // Update the results table if this violation leads to termination
      if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
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
      console.error('Error recording fullscreen violation:', error);
    }
  }, [assessment, fullscreenWarnings]);

  const handleFullscreenChange = useCallback(() => {
    const fullscreenStatus = checkFullscreen();
    
    if (!fullscreenStatus) {
      if (!fullscreenExitHandledRef.current) {
        fullscreenExitHandledRef.current = true;
        setShowExitWarning(true);
        addFullscreenWarning();
        recordFullscreenViolation();
        
        toast({
          title: "Warning",
          description: "Please return to fullscreen mode immediately. This is violation " + (fullscreenWarnings + 1) + "/" + MAX_WARNINGS,
          variant: "destructive",
        });
        
        if (fullscreenWarnings + 1 >= MAX_WARNINGS) {
          endAssessment();
          navigate('/summary');
        }
      }
    } else {
      fullscreenExitHandledRef.current = false;
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
    toast
  ]);

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
    };
  }, [handleFullscreenChange]);

  const terminateAssessment = useCallback(() => {
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
  };
};
