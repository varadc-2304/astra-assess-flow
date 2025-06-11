
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ProctoringCamera } from '@/components/ProctoringCamera';
import { ShieldCheck, Camera, AlertTriangle, CheckCircle, Sparkles, Eye, Lock } from 'lucide-react';
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
  
  const createSubmissionMutation = useMutation({
    mutationFn: async () => {
      if (!user || !assessment) return null;
      
      setIsCreatingSubmission(true);
      
      try {
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
        
        if (existingSubmissions && existingSubmissions.length > 0) {
          console.log('Using existing submission:', existingSubmissions[0]);
          return existingSubmissions[0];
        }
        
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
    
    if (user && assessment && !submissionId && !isCreatingSubmission) {
      console.log("Creating submission for assessment", assessment.id);
      createSubmissionMutation.mutate();
    }
  }, [assessment, assessmentCode, loading, navigate, toast, user, createSubmissionMutation, submissionId, isCreatingSubmission, startAssessment]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6 animate-spin"></div>
          <p className="text-xl font-medium text-gray-600">Loading assessment details...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-blue-50/30">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="relative max-w-5xl mx-auto px-6 py-12">
        {/* Header with Logo */}
        <header className="text-center mb-16">
          <div className="mx-auto w-24 h-24 mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-red-600/20 rounded-full animate-pulse"></div>
            <div className="absolute inset-2 bg-white rounded-full shadow-lg"></div>
            <img 
              src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
              alt="Yudha Logo" 
              className="w-full h-full relative z-10" 
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Identity Verification</h1>
          <p className="text-xl text-gray-600 mb-2">{assessment?.name}</p>
          <div className="flex items-center justify-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-medium">Secure AI Proctoring</span>
          </div>
        </header>
        
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-2xl border-0 overflow-hidden bg-white/95 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-primary via-primary/90 to-red-600 text-white p-10">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm relative">
                  <Camera className="h-10 w-10 text-white" />
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-6 w-6 text-yellow-300 animate-pulse" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-3xl text-center font-bold mb-4">
                AI-Powered Verification Required
              </CardTitle>
              <CardDescription className="text-white/90 text-center text-lg leading-relaxed max-w-2xl mx-auto">
                Our advanced AI system will verify your identity to ensure exam integrity. 
                Position yourself clearly in front of the camera for seamless verification.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-10">
              {!isCameraActivated ? (
                <div className="text-center py-20">
                  <div className="w-40 h-40 mx-auto mb-8 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent animate-pulse"></div>
                    <Camera className="h-20 w-20 text-primary relative z-10" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">Camera Access Required</h3>
                  <p className="text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed text-lg">
                    For secure assessment proctoring, we need access to your camera. 
                    Your privacy is protected and the feed is only used for verification and monitoring purposes.
                  </p>
                  <Button 
                    onClick={handleActivateCamera}
                    className="bg-gradient-to-r from-primary to-red-600 hover:from-primary/90 hover:to-red-600/90 text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 px-8 py-4 text-lg"
                    size="lg"
                  >
                    <Camera className="mr-3 h-6 w-6" />
                    Activate Camera
                  </Button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-8 border border-gray-200">
                    <ProctoringCamera 
                      onVerificationComplete={handleVerificationComplete}
                      showControls={!isVerified}
                      showStatus={true}
                      trackViolations={false}
                      assessmentId={assessment.id}
                      submissionId={submissionId || undefined}
                    />
                  </div>
                  
                  {/* Enhanced Verification Guidelines */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8">
                    <h4 className="font-bold text-blue-900 mb-6 flex items-center text-xl">
                      <Eye className="h-6 w-6 mr-3" />
                      Verification Guidelines
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <p className="text-blue-800">Ensure your face is clearly visible and well-lit</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <p className="text-blue-800">Remove any hats, sunglasses, or face coverings</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <p className="text-blue-800">Look directly at the camera during verification</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <p className="text-blue-800">Maintain a stable internet connection</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="p-10 bg-gradient-to-r from-gray-50 to-gray-100/50 border-t border-gray-200">
              {isVerified ? (
                <div className="w-full text-center">
                  <div className="inline-flex items-center justify-center gap-4 bg-green-100 px-8 py-4 rounded-2xl text-green-700 mb-8">
                    <CheckCircle className="h-8 w-8" />
                    <span className="font-bold text-xl">Verification Complete</span>
                  </div>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg leading-relaxed">
                    Your camera is properly configured and your identity has been verified.
                    You are now ready to begin your assessment.
                  </p>
                  <Button 
                    onClick={handleStartAssessment}
                    size="lg" 
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 px-8 py-4 text-lg"
                  >
                    <ShieldCheck className="mr-3 h-6 w-6" />
                    Start Assessment
                  </Button>
                </div>
              ) : (
                <div className="w-full text-center">
                  <div className="flex items-center justify-center gap-4 text-amber-600 mb-6">
                    <AlertTriangle className="h-6 w-6" />
                    <span className="font-bold text-lg">Verification Required</span>
                  </div>
                  <p className="text-gray-600 max-w-md mx-auto text-lg">
                    Please activate your camera and complete the verification process to proceed with your assessment.
                  </p>
                </div>
              )}
            </CardFooter>
          </Card>
          
          {/* Enhanced Security Notice */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-gray-200">
              <Lock className="h-5 w-5 text-gray-500" />
              <span className="text-gray-600 font-medium">Your privacy is protected. Camera feed is encrypted and secure.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraVerificationPage;
