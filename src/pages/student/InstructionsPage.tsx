import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Timer } from '@/components/Timer';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Clock, Code, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const InstructionsPage = () => {
  const { assessment, assessmentCode, loading, startAssessment } = useAssessment();
  const navigate = useNavigate();
  const [countdownEnded, setCountdownEnded] = useState(false);
  const { toast } = useToast();
  

  useEffect(() => {
    if (!loading && !assessment && assessmentCode) {
      console.log("No assessment data available, redirecting to dashboard");
      toast({
        title: "Error",
        description: "Assessment data is not available. Please try again.",
        variant: "destructive",
      });
      navigate('/student');
    }
  }, [assessment, assessmentCode, loading, navigate, toast]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading assessment details...</p>
      </div>
    );
  }
  
  if (!assessment) {
    return null; // Don't render anything while redirecting
  }
  
  const handleStartAssessment = () => {
    // Check if assessment has ended
    if (assessment?.endTime && new Date() > new Date(assessment.endTime)) {
      toast({
        title: "Assessment Expired",
        description: "This assessment has already ended and cannot be started.",
        variant: "destructive",
      });
      return;
    }

    // Check if proctoring is required based on the is_ai_proctored flag
    if (assessment?.isAiProctored) {
      // If AI proctoring is enabled, navigate to camera verification
      navigate('/camera-verification');
    } else {
      // If AI proctoring is disabled, start assessment directly
      startAssessment();
      navigate('/assessment');
    }
  };

  const handleCountdownEnd = () => {
    setCountdownEnded(true);
  };

  
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-xl">Assessment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Instructions</h3>
              <p className="text-gray-600 mt-1">{assessment?.instructions}</p>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">MCQ Questions</p>
                  <p className="font-semibold">{assessment?.mcqCount}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Coding Questions</p>
                  <p className="font-semibold">{assessment?.codingCount}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-semibold">{assessment?.durationMinutes} minutes</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Proctoring</p>
                  <p className="font-semibold">
                    {assessment?.isAiProctored ? "Camera Required" : "Self Proctored"}
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
            <p>• The assessment will start automatically when the countdown reaches zero.</p>
            <p>• You can navigate between questions using the navigation panel.</p>
            <p>• Your answers are auto-saved as you progress.</p>
            <p>• The assessment will automatically submit when the time expires.</p>
            {assessment?.isAiProctored && (
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
                  targetTime={assessment?.startTime || ''}
                  onCountdownEnd={handleCountdownEnd}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pb-6">
            <Button 
              onClick={handleStartAssessment}
              disabled={!countdownEnded || (assessment?.endTime && new Date() > new Date(assessment.endTime))}
              size="lg"
              className={`bg-astra-red hover:bg-red-600 text-white transition-all ${
                countdownEnded && (!assessment?.endTime || new Date() <= new Date(assessment.endTime)) ? 'animate-pulse' : 'opacity-50'
              }`}
            >
              {assessment?.endTime && new Date() > new Date(assessment.endTime) 
                ? 'Assessment Expired' 
                : countdownEnded 
                  ? (assessment?.isAiProctored ? 'Proceed to Camera Setup' : 'Start Assessment') 
                  : 'Please Wait...'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default InstructionsPage;
