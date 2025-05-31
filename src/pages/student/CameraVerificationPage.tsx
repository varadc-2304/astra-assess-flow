import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ProctoringCamera } from '@/components/ProctoringCamera';
import { ShieldCheck, Camera, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
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
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
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
    // Check if assessment requires AI proctoring, if not, redirect to assessment page
    if (!loading && assessment && !assessment.isAiProctored) {
      console.log("Assessment doesn't require AI proctoring, redirecting to assessment page");
      startAssessment();
      navigate('/assessment');
      return;
    }
    
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
  }, [assessment, assessmentCode, loading, navigate, toast, user, createSubmissionMutation, submissionId, isCreatingSubmission, startAssessment]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-6">
          <div className="h-12 w-12 border-4 border-gray-200 border-t-blue-600 animate-spin rounded-full mx-auto"></div>
          <div className="space-y-2">
            <p className="text-xl font-semibold text-gray-900">Loading Assessment</p>
            <p className="text-gray-600">Preparing your verification environment...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!assessment) {
    return null;
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
    }, 1000);
  };
  
  const handleStartAssessment = () => {
    startAssessment();
    navigate('/assessment');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
                <img 
                  src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
                  alt="Yudha Logo" 
                  className="w-10 h-10" 
                />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Identity Verification
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-4">
              {assessment?.name}
            </p>
            <div className="flex items-center justify-center space-x-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="text-green-600 font-medium">Secure AI Proctoring</span>
            </div>
          </header>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main camera section */}
            <div className="lg:col-span-2">
              <Card className="shadow-lg border-0 bg-white">
                <CardHeader className="bg-gray-50 border-b">
                  <CardTitle className="text-2xl flex items-center text-gray-900">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <Camera className="h-6 w-6 text-blue-600" />
                    </div>
                    Camera Verification
                  </CardTitle>
                  <CardDescription className="text-gray-600 text-base">
                    Position yourself in front of the camera for secure identity verification.
                    Our AI will monitor your presence throughout the assessment.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="p-8">
                  {!isCameraActivated ? (
                    <div className="text-center py-16">
                      <div className="w-32 h-32 mx-auto mb-8 bg-blue-50 rounded-full flex items-center justify-center">
                        <Camera className="h-16 w-16 text-blue-600" />
                      </div>
                      
                      <h3 className="text-2xl font-bold text-gray-900 mb-4">Camera Access Required</h3>
                      <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg leading-relaxed">
                        For secure assessment proctoring, we need access to your camera. 
                        Click below to enable your camera and begin verification.
                      </p>
                      
                      <Button 
                        onClick={handleActivateCamera}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 text-lg"
                        size="lg"
                      >
                        <Camera className="mr-3 h-5 w-5" />
                        Activate Camera
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <ProctoringCamera 
                        onVerificationComplete={handleVerificationComplete}
                        showControls={!isVerified}
                        showStatus={true}
                        trackViolations={false}
                        assessmentId={assessment.id}
                        submissionId={submissionId || undefined}
                        size="large"
                      />
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className="p-8 bg-gray-50 border-t">
                  {isVerified ? (
                    <div className="w-full text-center">
                      <div className="inline-flex items-center justify-center gap-3 bg-green-50 px-6 py-3 rounded-xl border border-green-200 text-green-700 mb-6">
                        <CheckCircle className="h-6 w-6" />
                        <span className="text-lg font-semibold">Verification Complete</span>
                      </div>
                      
                      <p className="text-gray-600 mb-6 text-lg">
                        Your camera is properly configured and your identity has been verified.
                        You're all set to begin your assessment!
                      </p>
                      
                      <Button 
                        onClick={handleStartAssessment}
                        size="lg" 
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 text-lg"
                      >
                        <ShieldCheck className="mr-3 h-6 w-6" />
                        Start Assessment
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full text-center">
                      <div className="flex items-center justify-center gap-3 text-amber-600 mb-4">
                        <AlertTriangle className="h-6 w-6" />
                        <span className="font-semibold text-lg">Complete Verification to Continue</span>
                      </div>
                      <p className="text-gray-600">
                        Position your face within the frame, ensure good lighting, and click "Verify" when ready.
                      </p>
                    </div>
                  )}
                </CardFooter>
              </Card>
            </div>
            
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* System Check */}
              <Card className="shadow-lg border-0 bg-white">
                <CardHeader className="pb-4 bg-gray-50 border-b">
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                    System Check
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {[
                    { label: 'Browser Compatibility', status: systemInfo.browserOk },
                    { label: 'Operating System', status: systemInfo.osOk },
                    { label: 'Memory', status: systemInfo.memoryOk },
                    { label: 'CPU', status: systemInfo.cpuOk }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="text-gray-700 font-medium">{item.label}</span>
                      {item.status ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                  ))}
                  
                  {!allSystemChecksOk && (
                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-700 mb-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-semibold">System Requirements</span>
                      </div>
                      <p className="text-amber-600 text-sm">
                        Some system requirements are not met. You may experience issues during the assessment.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Proctoring Information */}
              <Card className="shadow-lg border-0 bg-white">
                <CardHeader className="pb-4 bg-gray-50 border-b">
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <ShieldCheck className="h-5 w-5 text-blue-600" />
                    </div>
                    Proctoring Guidelines
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {[
                    'Keep your face visible throughout the assessment',
                    'Ensure proper lighting for clear visibility',
                    'Avoid wearing sunglasses or face coverings',
                    'Stay within the camera frame at all times',
                    'Only you should be visible in the frame',
                    'Technical issues will be automatically detected'
                  ].map((guideline, index) => (
                    <div key={index} className="flex items-start gap-3 p-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700 text-sm leading-relaxed">{guideline}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraVerificationPage;
