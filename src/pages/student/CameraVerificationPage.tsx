
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ProctoringCamera } from '@/components/ProctoringCamera';
import { ShieldCheck, Camera, AlertTriangle, CheckCircle, Sparkles, Zap, Shield } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-purple-200 border-opacity-20 border-t-white animate-spin rounded-full mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-purple-300 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xl font-semibold text-white">Loading Assessment</p>
            <p className="text-purple-300">Preparing your verification environment...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-full blur-3xl animate-spin" style={{ animationDuration: '20s' }}></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${10 + Math.random() * 10}s`
            }}
          />
        ))}
      </div>
      
      <div className="relative z-10 min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12 animate-fade-in">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
              <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 p-4 rounded-2xl">
                <img 
                  src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
                  alt="Yudha Logo" 
                  className="w-12 h-12 mx-auto drop-shadow-lg" 
                />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Identity Verification
            </h1>
            <p className="text-xl text-purple-200 max-w-2xl mx-auto leading-relaxed">
              {assessment?.name}
            </p>
            <div className="flex items-center justify-center mt-4 space-x-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-green-300 font-medium">Secure AI Proctoring</span>
            </div>
          </header>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main camera section */}
            <div className="lg:col-span-2">
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-purple-600/50 to-blue-600/50 border-b border-white/20">
                  <CardTitle className="text-2xl flex items-center text-white">
                    <div className="bg-white/20 p-2 rounded-lg mr-3">
                      <Camera className="h-6 w-6" />
                    </div>
                    Camera Verification
                  </CardTitle>
                  <CardDescription className="text-purple-100 text-base">
                    Position yourself in front of the camera for secure identity verification.
                    Our AI will monitor your presence throughout the assessment.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="p-8">
                  {!isCameraActivated ? (
                    <div className="text-center py-16 animate-fade-in">
                      <div className="relative mb-8">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur-xl opacity-75 animate-pulse"></div>
                        <div className="relative w-32 h-32 mx-auto rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center transform hover:scale-110 transition-all duration-300">
                          <Camera className="h-14 w-14 text-white" />
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-white mb-4">Camera Access Required</h3>
                      <p className="text-purple-200 mb-8 max-w-md mx-auto text-lg leading-relaxed">
                        For secure assessment proctoring, we need access to your camera. 
                        Click below to enable your camera and begin verification.
                      </p>
                      
                      <Button 
                        onClick={handleActivateCamera}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                        size="lg"
                      >
                        <Zap className="mr-3 h-5 w-5" />
                        Activate Camera
                      </Button>
                    </div>
                  ) : (
                    <div className="animate-fade-in">
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
                
                <CardFooter className="p-8 bg-white/5 border-t border-white/20">
                  {isVerified ? (
                    <div className="w-full text-center animate-fade-in">
                      <div className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm px-6 py-3 rounded-xl border border-green-400/30 text-green-300 mb-6">
                        <CheckCircle className="h-6 w-6" />
                        <span className="text-lg font-semibold">Verification Complete</span>
                        <Sparkles className="h-5 w-5 animate-pulse" />
                      </div>
                      
                      <p className="text-purple-200 mb-6 text-lg">
                        Your camera is properly configured and your identity has been verified.
                        You're all set to begin your assessment!
                      </p>
                      
                      <Button 
                        onClick={handleStartAssessment}
                        size="lg" 
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-8 py-4 text-lg rounded-xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                      >
                        <ShieldCheck className="mr-3 h-6 w-6" />
                        Start Assessment
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full text-center animate-fade-in">
                      <div className="flex items-center justify-center gap-3 text-amber-300 mb-4">
                        <AlertTriangle className="h-6 w-6 animate-pulse" />
                        <span className="font-semibold text-lg">Complete Verification to Continue</span>
                      </div>
                      <p className="text-purple-200">
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
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
                <CardHeader className="pb-4 bg-white/5 border-b border-white/20">
                  <CardTitle className="text-xl text-white flex items-center">
                    <div className="bg-white/20 p-2 rounded-lg mr-3">
                      <Shield className="h-5 w-5" />
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
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-purple-100 font-medium">{item.label}</span>
                      {item.status ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                      )}
                    </div>
                  ))}
                  
                  {!allSystemChecksOk && (
                    <div className="mt-6 p-4 bg-amber-500/10 border border-amber-400/30 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-300 mb-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-semibold">System Requirements</span>
                      </div>
                      <p className="text-amber-200 text-sm">
                        Some system requirements are not met. You may experience issues during the assessment.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Proctoring Information */}
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
                <CardHeader className="pb-4 bg-white/5 border-b border-white/20">
                  <CardTitle className="text-xl text-white flex items-center">
                    <div className="bg-white/20 p-2 rounded-lg mr-3">
                      <ShieldCheck className="h-5 w-5" />
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
                      <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-purple-100 text-sm leading-relaxed">{guideline}</span>
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
