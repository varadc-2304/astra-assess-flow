
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ProctoringCamera } from '@/components/ProctoringCamera';
import { ShieldCheck, Camera, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';

const CameraVerificationPage = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isCreatingSubmission, setIsCreatingSubmission] = useState(false);
  const [isCameraActivated, setIsCameraActivated] = useState(false);
  const [systemInfo, setSystemInfo] = useState<{
    browserOk: boolean;
    osOk: boolean;
    memoryOk: boolean;
    cpuOk: boolean;
  }>({
    browserOk: false,
    osOk: false,
    memoryOk: false,
    cpuOk: false,
  });
  
  const { assessment, startAssessment, assessmentCode, loading } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Create submission record for tracking with retry logic
  const createSubmissionMutation = useMutation({
    mutationFn: async () => {
      if (!user || !assessment) return null;
      
      setIsCreatingSubmission(true);
      
      try {
        // First check if there's already an active submission
        const { data: existingSubmissions, error: fetchError } = await supabase
          .from('submissions')
          .select('id')
          .eq('assessment_id', assessment.id)
          .eq('user_id', user.id)
          .is('completed_at', null)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (fetchError) {
          console.error('Error checking existing submissions:', fetchError);
          throw fetchError;
        }
        
        // If there's an active submission, use that
        if (existingSubmissions && existingSubmissions.length > 0) {
          console.log('Using existing submission:', existingSubmissions[0]);
          return existingSubmissions[0];
        }
        
        // Otherwise, create a new submission
        const { data, error } = await supabase
          .from('submissions')
          .insert({
            assessment_id: assessment.id,
            user_id: user.id,
            started_at: new Date().toISOString(),
            fullscreen_violations: 0,
            face_violations: [] // Initialize empty violations array
          })
          .select('id')
          .single();
          
        if (error) {
          console.error('Error creating new submission:', error);
          throw error;
        }
        
        console.log('Created new submission:', data);
        return data;
      } finally {
        setIsCreatingSubmission(false);
      }
    },
    retry: 3, // Retry up to 3 times
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // Exponential backoff
    onSuccess: (data) => {
      if (data) {
        console.log('Submission created/found successfully:', data.id);
        setSubmissionId(data.id);
      }
    },
    onError: (error) => {
      console.error('Error creating submission after retries:', error);
      toast({
        title: "Error",
        description: "Failed to create submission record. Please try refreshing the page.",
        variant: "destructive",
      });
    }
  });
  
  useEffect(() => {
    if (!loading && !assessment && assessmentCode) {
      console.log("No assessment data available, redirecting to dashboard");
      toast({
        title: "Error",
        description: "Assessment data is not available. Please try again.",
        variant: "destructive",
      });
      navigate('/student');
      return;
    }
    
    // Only create submission when needed, don't initialize camera yet
    if (user && assessment && !submissionId && !isCreatingSubmission) {
      console.log("Creating submission for assessment", assessment.id);
      createSubmissionMutation.mutate();
    }
    
    // Check system requirements
    const checkSystemRequirements = async () => {
      // Check browser compatibility
      const isModernBrowser = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
      
      // Check operating system
      const userAgent = navigator.userAgent;
      const isWindows = userAgent.indexOf("Windows") !== -1;
      const isMac = userAgent.indexOf("Mac") !== -1;
      const isLinux = userAgent.indexOf("Linux") !== -1;
      const isAndroid = userAgent.indexOf("Android") !== -1;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isSupportedOS = isWindows || isMac || isLinux || isAndroid || isIOS;
      
      // Check device memory (if available)
      // @ts-ignore - navigator.deviceMemory is not in TypeScript defs yet
      const deviceMemory = navigator.deviceMemory || 4; // Default to 4GB if not available
      const hasEnoughMemory = deviceMemory >= 2; // Require at least 2GB
      
      // Check CPU cores (if available)
      const cpuCores = navigator.hardwareConcurrency || 2;
      const hasEnoughCPU = cpuCores >= 2; // Require at least 2 cores
      
      setSystemInfo({
        browserOk: isModernBrowser,
        osOk: isSupportedOS,
        memoryOk: hasEnoughMemory,
        cpuOk: hasEnoughCPU
      });
    };
    
    checkSystemRequirements();
  }, [assessment, assessmentCode, loading, navigate, toast, user, createSubmissionMutation, submissionId, isCreatingSubmission]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading assessment details...</p>
        </div>
      </div>
    );
  }
  
  if (!assessment) {
    return null; // Don't render anything while redirecting
  }
  
  const allSystemChecksOk = 
    systemInfo.browserOk && 
    systemInfo.osOk && 
    systemInfo.memoryOk && 
    systemInfo.cpuOk;

  const handleActivateCamera = () => {
    setIsCameraActivated(true);
  };
  
  const handleVerificationComplete = (success: boolean) => {
    setIsVerifying(true);
    
    // Simulate verification process with a short delay
    setTimeout(() => {
      setIsVerified(success);
      setIsVerifying(false);
      
      if (success) {
        toast({
          title: "Verification Successful",
          description: "Your identity has been verified. You can now start the assessment.",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
      }
    }, 1000); // Reduced delay for better UX
  };
  
  const handleStartAssessment = () => {
    startAssessment();
    navigate('/assessment');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <header className="text-center mb-8">
          <div className="mx-auto w-16 h-16 mb-2">
            <img src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" alt="Yudha Logo" className="w-full h-full" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">{assessment?.name}</p>
        </header>
        
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-8">
            <Card className="mb-6 shadow-lg border-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-astra-red to-red-700 text-white">
                <CardTitle className="text-xl flex items-center">
                  <Camera className="mr-2 h-5 w-5" />
                  Camera Verification
                </CardTitle>
                <CardDescription className="text-white/90">
                  Please position yourself in front of the camera for identity verification.
                  This camera feed will be used for proctoring during your assessment.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {!isCameraActivated ? (
                  <div className="text-center py-8">
                    <Camera className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
                    <p className="text-gray-500 mb-6">Click the button below to activate your camera for verification</p>
                    <Button 
                      onClick={handleActivateCamera}
                      className="bg-astra-red hover:bg-red-600 text-white"
                      size="lg"
                    >
                      Activate Camera
                    </Button>
                  </div>
                ) : (
                  <ProctoringCamera 
                    onVerificationComplete={handleVerificationComplete}
                    showControls={!isVerified}
                    showStatus={true}
                    trackViolations={false}
                    assessmentId={assessment.id}
                    submissionId={submissionId || undefined}
                    enableOnMount={true} // Start the camera immediately when component mounts
                  />
                )}
              </CardContent>
              <CardFooter className="flex-col gap-4 p-6 bg-gray-50 dark:bg-gray-800/50">
                {isVerified ? (
                  <div className="w-full text-center">
                    <div className="inline-flex items-center justify-center gap-2 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-full text-green-700 dark:text-green-400 mb-4">
                      <CheckCircle className="h-5 w-5" />
                      <span>Verification Complete</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Your camera is properly configured and your identity has been verified.
                      You can now proceed to the assessment.
                    </p>
                    <Button 
                      onClick={handleStartAssessment}
                      size="lg" 
                      className="bg-astra-red hover:bg-red-600 text-white transition-all"
                    >
                      <ShieldCheck className="mr-2 h-5 w-5" />
                      Start Assessment
                    </Button>
                  </div>
                ) : (
                  <div className="w-full text-center">
                    <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 mb-3">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">Please complete verification first</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Position your face within the frame and ensure good lighting.
                      Click "Verify" when ready.
                    </p>
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>
          
          <div className="md:col-span-4 space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">System Check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span>Browser Compatibility</span>
                  {systemInfo.browserOk ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>Operating System</span>
                  {systemInfo.osOk ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>Memory</span>
                  {systemInfo.memoryOk ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>CPU</span>
                  {systemInfo.cpuOk ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                
                {!allSystemChecksOk && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="inline-block h-4 w-4 mr-1" />
                    Some system requirements are not met. You may experience issues during the assessment.
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Proctoring Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>• The camera will monitor your presence throughout the assessment.</p>
                <p>• Please ensure that your face remains visible at all times.</p>
                <p>• The system will detect if you leave the camera view or if other people appear.</p>
                <p>• Do not wear sunglasses, hats, or other face-obscuring items.</p>
                <p>• Ensure you have proper lighting so your face is clearly visible.</p>
                <p>• If technical issues occur, the system will notify you.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraVerificationPage;
