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
  }, [assessment, assessmentCode, loading, navigate, toast, user, createSubmissionMutation, submissionId, isCreatingSubmission, startAssessment]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-6">
          <div className="h-12 w-12 border-4 border-gray-200 border-t-red-600 animate-spin rounded-full mx-auto"></div>
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-black/5">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-red-100 to-red-200 rounded-full opacity-30 blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-black/10 to-gray-200 rounded-full opacity-30 blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="relative min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl shadow-xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
                <img 
                  src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
                  alt="Yudha Logo" 
                  className="w-12 h-12 drop-shadow-sm" 
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
              <Shield className="w-5 h-5 text-red-500" />
              <span className="text-red-600 font-medium">Secure AI Proctoring</span>
            </div>
          </header>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main camera section */}
            <div className="lg:col-span-2">
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gray-50/80 border-b">
                  <CardTitle className="text-2xl flex items-center text-gray-900">
                    <div className="bg-red-100 p-2 rounded-lg mr-3">
                      <Camera className="h-6 w-6 text-red-600" />
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
                      <div className="w-32 h-32 mx-auto mb-8 bg-red-50 rounded-full flex items-center justify-center">
                        <Camera className="h-16 w-16 text-red-600" />
                      </div>
                      
                      <h3 className="text-2xl font-bold text-gray-900 mb-4">Camera Access Required</h3>
                      <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg leading-relaxed">
                        For secure assessment proctoring, we need access to your camera. 
                        Click below to enable your camera and begin verification.
                      </p>
                      
                      <Button 
                        onClick={handleActivateCamera}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-4 text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
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
                
                <CardFooter className="p-8 bg-gray-50/80 border-t">
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
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
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
              {/* Proctoring Information */}
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-4 bg-gray-50/80 border-b">
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <div className="bg-red-100 p-2 rounded-lg mr-3">
                      <ShieldCheck className="h-5 w-5 text-red-600" />
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
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
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
