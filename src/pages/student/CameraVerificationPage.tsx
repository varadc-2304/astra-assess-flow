
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import ProctoringCamera from '@/components/ProctoringCamera';
import { Timer } from '@/components/Timer';
import { AlertCircle, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CameraVerificationPage = () => {
  const { assessment, startAssessment } = useAssessment();
  const navigate = useNavigate();
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const { toast } = useToast();

  if (!assessment) {
    navigate('/student');
    return null;
  }

  const handleVerificationComplete = (success: boolean) => {
    if (success) {
      setVerificationComplete(true);
      toast({
        title: "Verification Successful",
        description: "Camera check completed successfully.",
      });
    }
  };

  const handleStartAssessment = () => {
    startAssessment();
    navigate('/assessment');
  };
  
  const handleStartCamera = () => {
    setCameraStarted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl px-4">
        <header className="text-center mb-8">
          <div className="mx-auto w-16 h-16 mb-2">
            <img src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" alt="Yudha Logo" className="w-full h-full" />
          </div>
          <h1 className="font-semibold text-2xl">{assessment.name}</h1>
          <p className="text-gray-600 mt-2">Camera Verification</p>
        </header>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-center">Camera Setup</CardTitle>
            <CardDescription className="text-center">
              We need to verify your camera is working correctly before starting the assessment
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {!cameraStarted ? (
              <div className="text-center p-8">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 mb-6 flex flex-col items-center">
                  <Camera className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Please enable your camera to continue with the assessment. Your face will be monitored during the entire assessment.
                  </p>
                  <Button 
                    onClick={handleStartCamera}
                    className="bg-astra-red hover:bg-red-600 text-white"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Enable Camera
                  </Button>
                </div>
                
                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300 text-left">
                    <p className="font-medium mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1 pl-1">
                      <li>Position yourself in a well-lit environment</li>
                      <li>Make sure your face is clearly visible</li>
                      <li>Avoid having other people in the background</li>
                      <li>Remove any face coverings or accessories</li>
                      <li>Do not have mobile phones or other devices in view</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <ProctoringCamera 
                  onVerificationComplete={handleVerificationComplete}
                  showControls={true}
                  showStatus={true}
                  autoStart={true}
                />
                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg mt-6 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium mb-1">Make sure:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>You have proper lighting</li>
                      <li>Your face is clearly visible</li>
                      <li>You are the only person in the frame</li>
                      <li>No electronic devices are visible</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex flex-col">
            <Button
              onClick={handleStartAssessment}
              disabled={!verificationComplete}
              className={`w-full bg-astra-red hover:bg-red-600 text-white ${
                !verificationComplete ? 'opacity-50' : ''
              }`}
              size="lg"
            >
              {verificationComplete ? 'Start Assessment' : 'Verify Camera First'}
            </Button>
            
            <div className="text-center mt-6">
              <p className="text-gray-500 text-sm font-medium mb-2">Assessment will begin in</p>
              <div className="flex justify-center">
                <Timer 
                  variant="countdown" 
                  targetTime={assessment.startTime || ''}
                />
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default CameraVerificationPage;
