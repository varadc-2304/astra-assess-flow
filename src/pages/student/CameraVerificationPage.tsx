
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ProctoringCamera } from '@/components/ProctoringCamera';
import { ShieldCheck, Camera, AlertTriangle, CheckCircle, MonitorSmartphone, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

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
            face_violations: []
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center animate-fade-in">
          <div className="relative mx-auto w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-t-primary border-primary/30 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="h-6 w-6 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-200">Loading assessment details...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Setting up your secure testing environment</p>
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12">
      <div className="max-w-4xl mx-auto px-4 animate-fade-in">
        <header className="text-center mb-8">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 mb-4">
              <img 
                src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
                alt="Yudha Logo" 
                className="w-full h-full object-contain shadow-lg rounded-lg p-2 bg-white dark:bg-gray-800"
              />
              <div className="absolute -bottom-2 -right-2 bg-primary text-white rounded-full p-1">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">{assessment?.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Camera Verification Required
            </p>
          </div>
        </header>
        
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-8">
            <Card className="mb-6 overflow-hidden border-0 shadow-lg dark:shadow-primary/5 animate-scale-in transition-all hover:shadow-xl">
              <CardHeader className="bg-gradient-to-r from-astra-red to-red-700 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl flex items-center">
                      <Camera className="mr-2 h-5 w-5" />
                      Camera Verification
                    </CardTitle>
                    <CardDescription className="text-white/90 mt-1">
                      Please position yourself in front of the camera for identity verification.
                    </CardDescription>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                    <MonitorSmartphone className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                {!isCameraActivated ? (
                  <div className="text-center py-12 px-6">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Camera className="h-12 w-12 text-astra-red opacity-70" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Camera Access Required</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                      Your camera will be used for identity verification and proctoring during the assessment. Please ensure good lighting and position yourself clearly.
                    </p>
                    <Button 
                      onClick={handleActivateCamera}
                      className="bg-astra-red hover:bg-red-600 text-white animate-pulse-slow transition-all transform hover:scale-105 shadow-md hover:shadow-lg"
                      size="lg"
                    >
                      <Camera className="mr-2 h-5 w-5" />
                      Activate Camera
                    </Button>
                  </div>
                ) : (
                  <div className="camera-container transition-all duration-300 transform">
                    <ProctoringCamera 
                      onVerificationComplete={handleVerificationComplete}
                      showControls={!isVerified}
                      showStatus={true}
                      trackViolations={false}
                      assessmentId={assessment.id}
                      submissionId={submissionId || undefined}
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-4 p-6 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/70">
                {isVerified ? (
                  <div className="w-full text-center animate-fade-in">
                    <div className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 px-5 py-3 rounded-full text-green-700 dark:text-green-400 mb-4 shadow-inner">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Verification Complete</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                      Your camera is properly configured and your identity has been verified.
                      You can now proceed to the assessment.
                    </p>
                    <Button 
                      onClick={handleStartAssessment}
                      size="lg" 
                      className="bg-gradient-to-r from-astra-red to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all transform hover:scale-105 shadow-md hover:shadow-lg"
                    >
                      <ShieldCheck className="mr-2 h-5 w-5" />
                      Start Assessment
                    </Button>
                  </div>
                ) : (
                  <div className="w-full text-center">
                    <div className={cn(
                      "flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 mb-3",
                      isCameraActivated ? "animate-fade-in" : "opacity-50"
                    )}>
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
            <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in">
              <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  System Check
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm p-0">
                {/* System check items with visual improvements */}
                <div className="divide-y dark:divide-gray-700">
                  <SystemCheckItem
                    name="Browser Compatibility"
                    isOk={systemInfo.browserOk}
                    description="Modern browser with camera access"
                  />
                  <SystemCheckItem
                    name="Operating System"
                    isOk={systemInfo.osOk}
                    description="Compatible OS version"
                  />
                  <SystemCheckItem
                    name="Memory"
                    isOk={systemInfo.memoryOk}
                    description="Sufficient RAM available"
                  />
                  <SystemCheckItem
                    name="CPU"
                    isOk={systemInfo.cpuOk}
                    description="Adequate processing power"
                  />
                </div>
                
                {!allSystemChecksOk && (
                  <div className="m-5 p-3 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800/50 rounded-lg text-sm text-amber-700 dark:text-amber-400 shadow-inner">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <p>
                        Some system requirements are not met. You may experience issues during the assessment. Please try using a different device or browser.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in delay-150">
              <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Proctoring Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm p-5">
                <InfoItem icon={<Camera className="h-4 w-4" />} text="Camera will monitor your presence throughout the assessment" />
                <InfoItem icon={<CheckCircle className="h-4 w-4" />} text="Ensure that your face remains visible at all times" />
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} text="The system will detect if you leave the camera view" />
                <InfoItem icon={<CheckCircle className="h-4 w-4" />} text="Do not wear sunglasses, hats, or face-obscuring items" />
                <InfoItem icon={<CheckCircle className="h-4 w-4" />} text="Ensure you have proper lighting so your face is visible" />
                <InfoItem icon={<AlertTriangle className="h-4 w-4" />} text="If technical issues occur, the system will notify you" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for system check items
const SystemCheckItem = ({ name, isOk, description }: { name: string; isOk: boolean; description: string }) => (
  <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
    <div>
      <p className="font-medium text-gray-700 dark:text-gray-200">{name}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
    </div>
    <div className={cn(
      "flex h-8 w-8 items-center justify-center rounded-full transition-all",
      isOk ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : 
             "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
    )}>
      {isOk ? (
        <CheckCircle className="h-5 w-5" />
      ) : (
        <AlertTriangle className="h-5 w-5" />
      )}
    </div>
  </div>
);

// Helper component for info items
const InfoItem = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-start gap-3 group">
    <div className="mt-0.5 p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-primary group-hover:text-white group-hover:bg-primary transition-colors">
      {icon}
    </div>
    <p className="text-gray-700 dark:text-gray-300">{text}</p>
  </div>
);

export default CameraVerificationPage;
