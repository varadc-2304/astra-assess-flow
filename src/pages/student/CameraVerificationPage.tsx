
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Camera, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProctoring } from '@/hooks/useProctoring';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const CameraVerificationPage = () => {
  const { assessment, assessmentStarted } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [environmentReady, setEnvironmentReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetectionAttempts, setFaceDetectionAttempts] = useState(0);

  const {
    videoRef,
    canvasRef,
    isModelLoaded,
    isCameraReady,
    faceDetected,
    initCamera,
    startDetection,
    stopDetection
  } = useProctoring();

  useEffect(() => {
    if (!assessment) {
      toast({
        title: "Error",
        description: "Assessment data is not available. Please try again.",
        variant: "destructive",
      });
      navigate('/student');
      return;
    }

    // Automatically start camera initialization
    initCamera();
    
    return () => {
      // Clean up - stop detection if it was started
      stopDetection();
    };
  }, [assessment, initCamera, navigate, stopDetection, toast]);

  useEffect(() => {
    if (isCameraReady && isModelLoaded && !cameraReady) {
      console.log("Camera and model are ready");
      startDetection();
      setCameraReady(true);
    }
  }, [isCameraReady, isModelLoaded, cameraReady, startDetection]);

  // Face detection monitoring effect
  useEffect(() => {
    let detectionTimer: number;
    
    if (cameraReady && !environmentReady) {
      // Check for face detection every second
      detectionTimer = window.setInterval(() => {
        if (faceDetected) {
          console.log("Face detected, environment ready");
          setEnvironmentReady(true);
          setIsVerifying(false);
          clearInterval(detectionTimer);
        } else {
          // Count attempts to detect face
          setFaceDetectionAttempts(prev => {
            const newCount = prev + 1;
            console.log(`Face detection attempt: ${newCount}, face detected: ${faceDetected}`);
            
            // After 5 seconds (5 attempts), show guidance toast
            if (newCount === 5) {
              toast({
                title: "Face Not Detected",
                description: "Please make sure your face is visible in the camera and well-lit.",
                variant: "default",
              });
            }
            return newCount;
          });
        }
      }, 1000);
    }
    
    return () => {
      if (detectionTimer) clearInterval(detectionTimer);
    };
  }, [cameraReady, environmentReady, faceDetected, toast]);

  const handleProceedToAssessment = () => {
    if (!environmentReady || !cameraReady) {
      toast({
        title: "Environment Not Ready",
        description: "Please ensure your camera is working and your face is visible.",
        variant: "destructive",
      });
      return;
    }
    
    navigate('/assessment');
  };
  
  const handleBackToInstructions = () => {
    navigate('/instructions');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-astra-red">Yudha</h1>
          <p className="text-gray-600">{assessment?.name}</p>
        </header>
        
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Camera className="mr-2 h-5 w-5 text-astra-red" />
              Environment Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Please ensure your camera is working and your face is clearly visible before proceeding with the assessment.
              The assessment requires continuous proctoring through your camera.
            </p>
            
            <Separator />
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full ${isModelLoaded ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}>
                  {isModelLoaded && <Check className="w-4 h-4 text-white" />}
                </div>
                <p className={`${isModelLoaded ? 'text-green-700' : 'text-yellow-700'}`}>
                  Face Detection Model: {isModelLoaded ? 'Loaded' : 'Loading...'}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full ${cameraReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}>
                  {cameraReady && <Check className="w-4 h-4 text-white" />}
                </div>
                <p className={`${cameraReady ? 'text-green-700' : 'text-yellow-700'}`}>
                  Camera Status: {cameraReady ? 'Ready' : 'Initializing...'}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full ${environmentReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}>
                  {environmentReady && <Check className="w-4 h-4 text-white" />}
                </div>
                <p className={`${environmentReady ? 'text-green-700' : 'text-yellow-700'}`}>
                  Face Detection: {environmentReady ? 'Face Detected' : 'Waiting for face...'}
                </p>
              </div>
            </div>
            
            {!cameraReady && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>
                  Please allow camera access in your browser to proceed with the assessment.
                </AlertDescription>
              </Alert>
            )}
            
            {cameraReady && !environmentReady && faceDetectionAttempts > 10 && (
              <Alert variant="default" className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Face Detection Issues</AlertTitle>
                <AlertDescription className="text-amber-700">
                  <p>Trouble detecting your face. Please try:</p>
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>Ensure your face is centered and well-lit</li>
                    <li>Remove any face coverings or accessories</li>
                    <li>Adjust your position to face the camera directly</li>
                    <li>Make sure there's adequate lighting in your room</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          
          <div className="flex justify-center my-4">
            <div className="camera-preview-container relative border-4 border-gray-300 rounded-lg overflow-hidden" 
                 style={{ width: '320px', height: '240px', borderColor: environmentReady ? '#10b981' : '#f59e0b' }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                style={{ transform: 'scaleX(-1)' }} // Mirror image
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ transform: 'scaleX(-1)' }} // Mirror image
              />
              
              {isVerifying && !environmentReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <div className="text-white text-center p-4">
                    <div className="animate-spin w-8 h-8 border-4 border-t-transparent border-white rounded-full mx-auto mb-2"></div>
                    <p>Verifying environment...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <CardFooter className="flex justify-between pb-6">
            <Button 
              onClick={handleBackToInstructions}
              variant="outline"
              className="border-gray-300"
            >
              Back to Instructions
            </Button>
            
            <Button 
              onClick={handleProceedToAssessment}
              disabled={!environmentReady || !cameraReady}
              className={`bg-astra-red hover:bg-red-600 text-white transition-all ${
                environmentReady && cameraReady ? '' : 'opacity-50'
              }`}
            >
              {environmentReady && cameraReady ? 'Proceed to Assessment' : 'Waiting for Verification...'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default CameraVerificationPage;
