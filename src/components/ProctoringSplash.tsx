
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Video, Check, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { useProctoring } from '@/hooks/useProctoring';
import { useToast } from '@/hooks/use-toast';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useIsMobile } from '@/hooks/use-mobile';

const ProctoringSplash = () => {
  const [step, setStep] = useState<'intro' | 'camera' | 'environment' | 'ready'>('intro');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { assessment, startAssessment } = useAssessment();
  const { isMobile } = useIsMobile();
  
  const {
    videoRef,
    cameraAccess,
    environmentCheckPassed,
    loadingModels,
    requestCameraAccess,
    checkEnvironment,
    startRecording,
  } = useProctoring();
  
  useEffect(() => {
    if (!assessment) {
      navigate('/student');
    }
  }, [assessment, navigate]);
  
  const handleCameraAccess = async () => {
    setStep('camera');
    const stream = await requestCameraAccess();
    if (!stream) {
      setError('Camera access denied. Please allow camera access to continue.');
    }
  };
  
  const handleEnvironmentCheck = async () => {
    if (loadingModels) {
      toast({
        title: "Please wait",
        description: "AI proctoring models are still loading.",
      });
      return;
    }
    
    if (!cameraAccess) {
      setError('Camera access required for environment check.');
      return;
    }
    
    const passed = await checkEnvironment();
    if (passed) {
      setStep('ready');
    }
  };
  
  const handleStartAssessment = () => {
    if (!environmentCheckPassed) {
      toast({
        title: "Environment check required",
        description: "Please complete the environment check before starting.",
        variant: "destructive"
      });
      return;
    }
    
    // Start recording and proctoring
    startRecording();
    
    // Start assessment and navigate to assessment page
    startAssessment();
    navigate('/assessment');
  };
  
  if (isMobile) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center flex items-center justify-center">
              <ShieldAlert className="mr-2 h-6 w-6 text-amber-500" />
              Device Not Supported
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p>Proctored assessments are not available on mobile devices. Please use a desktop or laptop computer.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate('/student')} className="w-full">
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            AI Proctoring Setup
          </CardTitle>
          <CardDescription className="text-center">
            {step === 'intro' && "Please follow these steps to enable proctoring for your assessment"}
            {step === 'camera' && "Please allow camera access for proctoring"}
            {step === 'environment' && "Let's check your environment"}
            {step === 'ready' && "You're ready to begin the assessment"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
          
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="rounded-lg overflow-hidden bg-black relative h-80 flex items-center justify-center">
                {step === 'intro' ? (
                  <Video className="h-16 w-16 text-gray-500" />
                ) : (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline
                    muted
                    className="w-full h-full object-contain" 
                  />
                )}
                
                {loadingModels && step !== 'intro' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p className="text-sm">Loading AI Models...</p>
                    </div>
                  </div>
                )}
              </div>
              
              {step === 'environment' && cameraAccess && (
                <Button 
                  onClick={handleEnvironmentCheck}
                  disabled={loadingModels}
                  className="w-full"
                >
                  {loadingModels ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading AI Models...
                    </>
                  ) : (
                    <>Check Environment</>
                  )}
                </Button>
              )}
            </div>
            
            <div className="flex-1 space-y-4">
              <h3 className="font-medium text-lg">Proctoring Requirements</h3>
              
              <div className="space-y-2">
                <div className={`p-3 flex items-center justify-between rounded-md border ${cameraAccess ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
                  <div className="flex items-center">
                    <span className="mr-2 font-medium">Camera Access</span>
                  </div>
                  {cameraAccess ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                
                <div className={`p-3 flex items-center justify-between rounded-md border ${environmentCheckPassed ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
                  <div className="flex items-center">
                    <span className="mr-2 font-medium">Environment Check</span>
                  </div>
                  {environmentCheckPassed ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                
                <div className="mt-6 space-y-2">
                  <h4 className="font-medium">During the assessment:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li>Stay within the camera frame</li>
                    <li>You must be the only person visible</li>
                    <li>Make sure your face is clearly visible</li>
                    <li>Don't use virtual backgrounds</li>
                    <li>Avoid looking away from the screen</li>
                    <li>Any violations will be recorded</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/student')}
          >
            Cancel
          </Button>
          
          {step === 'intro' && (
            <Button onClick={handleCameraAccess}>
              Begin Setup
            </Button>
          )}
          
          {step === 'camera' && !cameraAccess && (
            <Button onClick={requestCameraAccess}>
              Allow Camera
            </Button>
          )}
          
          {step === 'camera' && cameraAccess && (
            <Button onClick={() => setStep('environment')}>
              Continue
            </Button>
          )}
          
          {step === 'ready' && environmentCheckPassed && (
            <Button 
              onClick={handleStartAssessment}
              variant="default"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              Start Assessment
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default ProctoringSplash;
