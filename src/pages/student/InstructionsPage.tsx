import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Timer } from '@/components/Timer';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Clock, Code, Camera, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const InstructionsPage = () => {
  const { assessmentCode, loading, loadAssessment, startAssessment } = useAssessment();
  const navigate = useNavigate();
  const [countdownEnded, setCountdownEnded] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [assessmentMetadata, setAssessmentMetadata] = useState<any>(null);
  const { toast } = useToast();
  

  // Load assessment metadata when component mounts
  useEffect(() => {
    const loadMetadata = async () => {
      if (!assessmentCode) {
        console.log("No assessment code available, redirecting to dashboard");
        navigate('/student');
        return;
      }

      try {
        const { data: assessmentData, error } = await supabase
          .from('assessments')
          .select('*')
          .eq('code', assessmentCode.toUpperCase())
          .single();

        if (error || !assessmentData) {
          toast({
            title: "Error",
            description: "Failed to load assessment details.",
            variant: "destructive",
          });
          navigate('/student');
          return;
        }

        setAssessmentMetadata(assessmentData);
      } catch (error) {
        console.error('Error loading assessment metadata:', error);
        toast({
          title: "Error",
          description: "An error occurred while loading assessment details.",
          variant: "destructive",
        });
        navigate('/student');
      }
    };

    loadMetadata();
  }, [assessmentCode, navigate, toast]);
  
  if (!assessmentMetadata) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg">Loading assessment details...</p>
      </div>
    );
  }
  
  const handleStartAssessment = async () => {
    // Check if assessment has ended
    if (assessmentMetadata?.end_time && new Date() > new Date(assessmentMetadata.end_time)) {
      toast({
        title: "Assessment Expired",
        description: "This assessment has already ended and cannot be started.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingQuestions(true);
    
    try {
      // Load assessment questions
      const success = await loadAssessment(assessmentCode);
      
      if (!success) {
        toast({
          title: "Error",
          description: "Failed to load assessment questions. Please try again.",
          variant: "destructive",
        });
        setIsLoadingQuestions(false);
        return;
      }

      // Check if proctoring is required based on the is_ai_proctored flag
      if (assessmentMetadata?.is_ai_proctored) {
        // If AI proctoring is enabled, navigate to camera verification
        navigate('/camera-verification');
      } else {
        // If AI proctoring is disabled, start assessment directly
        startAssessment();
        navigate('/assessment');
      }
    } catch (error) {
      console.error('Error loading assessment:', error);
      toast({
        title: "Error",
        description: "An error occurred while loading the assessment.",
        variant: "destructive",
      });
      setIsLoadingQuestions(false);
    }
  };

  const handleCountdownEnd = () => {
    setCountdownEnded(true);
  };

  
  // Count questions from assessment metadata
  const mcqCount = assessmentMetadata?.is_dynamic 
    ? 0 // Will be calculated from constraints
    : 0; // Will need to fetch from related tables
  const codingCount = assessmentMetadata?.is_dynamic
    ? 0 // Will be calculated from constraints  
    : 0; // Will need to fetch from related tables

  return (
    <div className="min-h-screen bg-gray-50 py-12 relative">
      {/* Loading Overlay */}
      {isLoadingQuestions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-8 max-w-sm mx-4">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Loading Assessment</h3>
                <p className="text-sm text-muted-foreground">Please wait while we prepare your questions...</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4">
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-xl">Assessment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Instructions</h3>
              <p className="text-gray-600 mt-1">{assessmentMetadata?.instructions || 'No instructions provided.'}</p>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-semibold">{assessmentMetadata?.duration_minutes} minutes</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Proctoring</p>
                  <p className="font-semibold">
                    {assessmentMetadata?.is_ai_proctored ? "Camera Required" : "Self Proctored"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg">Important Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• Tab switching and app switching detection is active on all devices.</p>
            <p>• Switching tabs/apps 3 times will automatically terminate your assessment.</p>
            <p>• All browsers are supported with robust anti-cheating measures.</p>
            <p>• The assessment will start when you click the button below.</p>
            <p>• You can navigate between questions using the navigation panel.</p>
            <p>• Your answers are auto-saved as you progress.</p>
            <p>• The assessment will automatically submit when the time expires.</p>
            {assessmentMetadata?.is_ai_proctored && (
              <p>• Camera proctoring will be active throughout the entire assessment.</p>
            )}
          </CardContent>
        </Card>
        
        <Card className="text-center shadow-lg border-0">
          <CardContent className="pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium">Assessment starts in</h3>
              <div className="flex justify-center my-4">
                <Timer 
                  variant="countdown"
                  targetTime={assessmentMetadata?.start_time || ''}
                  onCountdownEnd={handleCountdownEnd}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pb-6">
            <Button 
              onClick={handleStartAssessment}
              disabled={!countdownEnded || (assessmentMetadata?.end_time && new Date() > new Date(assessmentMetadata.end_time)) || isLoadingQuestions}
              size="lg"
              className={`bg-astra-red hover:bg-red-600 text-white transition-all ${
                countdownEnded && (!assessmentMetadata?.end_time || new Date() <= new Date(assessmentMetadata.end_time)) && !isLoadingQuestions ? 'animate-pulse' : 'opacity-50'
              }`}
            >
              {assessmentMetadata?.end_time && new Date() > new Date(assessmentMetadata.end_time) 
                ? 'Assessment Expired' 
                : countdownEnded 
                  ? (assessmentMetadata?.is_ai_proctored ? 'Proceed to Camera Setup' : 'Start Assessment') 
                  : 'Please Wait...'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default InstructionsPage;
