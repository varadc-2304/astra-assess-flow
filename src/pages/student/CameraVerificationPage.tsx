
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Check, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useToast } from '@/hooks/use-toast';
import ProctoringCamera from '@/components/ProctoringCamera';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const CameraVerificationPage = () => {
  const { assessment, assessmentCode, startAssessment } = useAssessment();
  const [isVerified, setIsVerified] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!assessment) {
      navigate('/student/instructions');
    }
  }, [assessment, navigate]);

  const handleVerificationComplete = async (success: boolean) => {
    if (success) {
      setIsVerified(true);
      
      try {
        // Create a proctoring session record
        if (assessment && user) {
          const { data, error } = await supabase
            .from('proctoring_sessions')
            .insert({
              user_id: user.id,
              assessment_id: assessment.id,
              recording_path: 'none', // No actual recording in this version
              started_at: new Date().toISOString()
            });
            
          if (error) {
            console.error('Error creating proctoring session:', error);
          }
        }
      } catch (err) {
        console.error('Error in camera verification:', err);
      }
    }
  };
  
  const handleEnableCamera = () => {
    setCameraEnabled(true);
  };

  const handleStartAssessment = () => {
    if (isVerified) {
      startAssessment();
      navigate('/student/assessment');
    } else {
      toast({
        title: "Verification Required",
        description: "Please complete camera verification before starting the assessment.",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    navigate('/student/instructions');
  };

  if (!assessment) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="mb-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="mx-auto">
              <div className="mx-auto w-16 h-16 mb-2">
                <img src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" alt="Yudha Logo" className="w-full h-full" />
              </div>
            </div>
            <div className="w-8"></div>
          </div>
          <CardTitle className="text-center text-xl">Camera Verification</CardTitle>
          <CardDescription className="text-center">
            We need to verify your camera for the proctored assessment.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {!cameraEnabled ? (
            <div className="text-center p-8">
              <div className="mb-6 flex justify-center">
                <Camera className="h-16 w-16 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Camera Access Required</h3>
              <p className="text-gray-600 mb-4">
                This assessment requires camera proctoring. Please enable your camera to continue.
              </p>
              <Button
                onClick={handleEnableCamera}
                size="lg"
                className="bg-astra-red hover:bg-red-600"
              >
                <Camera className="mr-2 h-5 w-5" />
                Enable Camera
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                Position your face within the frame and ensure good lighting.
              </p>
              <div className="flex justify-center">
                <div className="w-full max-w-md">
                  <ProctoringCamera 
                    onVerificationComplete={handleVerificationComplete}
                    showControls={true}
                    showStatus={true}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 mt-6">
            <div className="flex items-center gap-2">
              <div className={`rounded-full h-5 w-5 flex items-center justify-center ${isVerified ? 'bg-green-100' : 'bg-gray-100'}`}>
                {isVerified ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-gray-300"></span>
                )}
              </div>
              <span className={`text-sm ${isVerified ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                Camera verification {isVerified ? 'completed' : 'pending'}
              </span>
            </div>
          </div>

          {!isVerified && cameraEnabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-sm mt-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5 shrink-0" />
                <p>
                  Please click the "Verify" button once your face is clearly visible in the camera. 
                  This helps us confirm your identity during the assessment.
                </p>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter>
          <div className="w-full flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleStartAssessment}
              disabled={!isVerified}
              className={`flex-1 ${isVerified ? 'bg-astra-red hover:bg-red-600' : ''}`}
            >
              Start Assessment
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CameraVerificationPage;
