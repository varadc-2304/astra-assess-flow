
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-astra-red border-t-transparent rounded-full mx-auto mb-6"></div>
          <p className="text-xl font-medium text-gray-700">Loading assessment details...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="mx-auto w-24 h-24 mb-6 bg-gradient-to-br from-astra-red/10 to-astra-red/5 rounded-full flex items-center justify-center shadow-lg">
            <Shield className="h-12 w-12 text-astra-red" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Identity Verification</h1>
          <div className="max-w-2xl mx-auto">
            <p className="text-xl text-gray-600 mb-2">{assessment?.name}</p>
            <div className="w-24 h-1 bg-gradient-to-r from-astra-red to-red-600 mx-auto rounded-full"></div>
          </div>
        </header>
        
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-2xl border-0 overflow-hidden bg-white/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-astra-red to-red-700 text-white p-10">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg">
                  <Camera className="h-10 w-10 text-white" />
                </div>
              </div>
              <CardTitle className="text-3xl text-center font-bold mb-4">
                Secure Camera Verification
              </CardTitle>
              <CardDescription className="text-white/90 text-center text-lg leading-relaxed">
                To maintain assessment integrity, we need to verify your identity using your camera.
                This process ensures secure and fair testing conditions for all participants.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-10">
              {!isCameraActivated ? (
                <div className="text-center py-20">
                  <div className="w-40 h-40 mx-auto mb-8 rounded-full bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center shadow-xl">
                    <Camera className="h-20 w-20 text-astra-red" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-6">Camera Access Required</h3>
                  <p className="text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed text-lg">
                    For secure assessment proctoring, we need access to your camera. 
                    Your privacy is protected and the feed is only used for verification and monitoring purposes during the assessment.
                  </p>
                  <Button 
                    onClick={handleActivateCamera}
                    className="bg-astra-red hover:bg-red-600 text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 px-8 py-4 text-lg"
                    size="lg"
                  >
                    <Camera className="mr-3 h-6 w-6" />
                    Activate Camera System
                  </Button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-8 shadow-inner">
                    <ProctoringCamera 
                      onVerificationComplete={handleVerificationComplete}
                      showControls={!isVerified}
                      showStatus={true}
                      trackViolations={false}
                      assessmentId={assessment.id}
                      submissionId={submissionId || undefined}
                    />
                  </div>
                  
                  {/* Verification Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 shadow-sm">
                    <h4 className="font-semibold text-blue-900 mb-4 flex items-center text-lg">
                      <AlertTriangle className="h-6 w-6 mr-3" />
                      Verification Guidelines
                    </h4>
                    <ul className="text-blue-800 space-y-3 text-base leading-relaxed">
                      <li className="flex items-start">
                        <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        Ensure your face is clearly visible and well-lit
                      </li>
                      <li className="flex items-start">
                        <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        Remove any hats, sunglasses, or face coverings
                      </li>
                      <li className="flex items-start">
                        <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        Look directly at the camera during verification
                      </li>
                      <li className="flex items-start">
                        <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        Maintain a stable internet connection
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="p-10 bg-gray-50 border-t">
              {isVerified ? (
                <div className="w-full text-center">
                  <div className="inline-flex items-center justify-center gap-4 bg-green-100 px-8 py-4 rounded-full text-green-700 mb-8 shadow-lg">
                    <CheckCircle className="h-8 w-8" />
                    <span className="font-semibold text-xl">Verification Complete</span>
                  </div>
                  <p className="text-gray-600 mb-8 max-w-2xl mx-auto text-lg leading-relaxed">
                    Your camera system is properly configured and your identity has been successfully verified.
                    You are now authorized to begin your assessment.
                  </p>
                  <Button 
                    onClick={handleStartAssessment}
                    size="lg" 
                    className="bg-astra-red hover:bg-red-600 text-white transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 px-8 py-4 text-lg"
                  >
                    <ShieldCheck className="mr-3 h-6 w-6" />
                    Begin Assessment
                  </Button>
                </div>
              ) : (
                <div className="w-full text-center">
                  <div className="flex items-center justify-center gap-4 text-amber-600 mb-6">
                    <AlertTriangle className="h-6 w-6" />
                    <span className="font-semibold text-lg">Verification Required</span>
                  </div>
                  <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
                    Please activate your camera and complete the verification process to proceed with your assessment.
                  </p>
                </div>
              )}
            </CardFooter>
          </Card>
          
          {/* Security Notice */}
          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-3 text-gray-500 text-base bg-white/80 px-6 py-3 rounded-full shadow-sm">
              <ShieldCheck className="h-5 w-5" />
              <span>Your privacy is protected. Camera feed is encrypted and secure.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraVerificationPage;
