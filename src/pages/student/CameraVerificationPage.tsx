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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-astra-red border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-600">Loading assessment details...</p>
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
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header with Logo */}
        <header className="text-center mb-12">
          <div className="mx-auto w-20 h-20 mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-astra-red/20 to-red-600/20 rounded-full animate-pulse"></div>
            <img 
              src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
              alt="Yudha Logo" 
              className="w-full h-full relative z-10" 
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Camera Verification</h1>
          <p className="text-lg text-gray-600">{assessment?.name}</p>
        </header>
        
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-astra-red to-red-700 text-white p-8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Camera className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl text-center font-bold">
                Identity Verification Required
              </CardTitle>
              <CardDescription className="text-white/90 text-center text-lg mt-2">
                Please position yourself in front of the camera for identity verification.
                {assessment.isAiProctored && " Your session will be recorded for proctoring purposes."}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-8">
              {!isCameraActivated ? (
                <div className="text-center py-16">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center shadow-lg">
                    <Camera className="h-16 w-16 text-astra-red" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Camera Access Required</h3>
                  <p className="text-gray-600 mb-8 max-w-lg mx-auto leading-relaxed">
                    For secure assessment proctoring, we need access to your camera. 
                    {assessment.isAiProctored && " This assessment includes video recording for integrity monitoring."}
                    {" "}Your privacy is protected and the feed is only used for verification and monitoring purposes.
                  </p>
                  <Button 
                    onClick={handleActivateCamera}
                    className="bg-astra-red hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                    size="lg"
                  >
                    <Camera className="mr-3 h-5 w-5" />
                    Activate Camera
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6">
                    <ProctoringCamera 
                      onVerificationComplete={handleVerificationComplete}
                      showControls={!isVerified}
                      showStatus={true}
                      trackViolations={false}
                      assessmentId={assessment.id}
                      submissionId={submissionId || undefined}
                      enableRecording={assessment.isAiProctored}
                    />
                  </div>
                  
                  {/* Verification Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Verification Guidelines
                    </h4>
                    <ul className="text-blue-800 space-y-2 text-sm">
                      <li>• Ensure your face is clearly visible and well-lit</li>
                      <li>• Remove any hats, sunglasses, or face coverings</li>
                      <li>• Look directly at the camera during verification</li>
                      <li>• Maintain a stable internet connection</li>
                      {assessment.isAiProctored && (
                        <li>• Your session will be recorded for integrity monitoring</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="p-8 bg-gray-50 border-t">
              {isVerified ? (
                <div className="w-full text-center">
                  <div className="inline-flex items-center justify-center gap-3 bg-green-100 px-6 py-3 rounded-full text-green-700 mb-6">
                    <CheckCircle className="h-6 w-6" />
                    <span className="font-semibold text-lg">Verification Complete</span>
                  </div>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Your camera is properly configured and your identity has been verified.
                    You are now ready to begin your assessment.
                  </p>
                  <Button 
                    onClick={handleStartAssessment}
                    size="lg" 
                    className="bg-astra-red hover:bg-red-600 text-white transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    <ShieldCheck className="mr-3 h-5 w-5" />
                    Start Assessment
                  </Button>
                </div>
              ) : (
                <div className="w-full text-center">
                  <div className="flex items-center justify-center gap-3 text-amber-600 mb-4">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">Verification Required</span>
                  </div>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Please activate your camera and complete the verification process to proceed with your assessment.
                  </p>
                </div>
              )}
            </CardFooter>
          </Card>
          
          {/* Security Notice */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
              <ShieldCheck className="h-4 w-4" />
              <span>Your privacy is protected. Camera feed is encrypted and secure.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraVerificationPage;
