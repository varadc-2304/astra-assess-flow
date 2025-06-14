import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ProctoringCamera } from '@/components/ProctoringCamera';
import { ShieldCheck, Camera, CheckCircle } from 'lucide-react';
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
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
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
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Minimal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 bg-red-50 rounded-full flex items-center justify-center">
            <Camera className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Camera Verification</h1>
          <p className="text-gray-600">{assessment?.name}</p>
        </div>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            {!isCameraActivated ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
                  <Camera className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Camera Access Required</h3>
                <p className="text-gray-600 mb-6 text-sm">
                  Please allow camera access to proceed with identity verification.
                </p>
                <Button 
                  onClick={handleActivateCamera}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Activate Camera
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <ProctoringCamera 
                  onVerificationComplete={handleVerificationComplete}
                  showControls={!isVerified}
                  showStatus={true}
                  trackViolations={false}
                  enableRecording={false}
                  assessmentId={assessment.id}
                  submissionId={submissionId || undefined}
                  size="default"
                />
                
                {/* Minimal Guidelines */}
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-red-800 text-sm text-center">
                    Ensure your face is clearly visible and well-lit
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="p-6 pt-0">
            {isVerified ? (
              <div className="w-full text-center">
                <div className="inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full text-green-700 mb-4">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Verification Complete</span>
                </div>
                <div>
                  <Button 
                    onClick={handleStartAssessment}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Start Assessment
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full text-center">
                <p className="text-gray-500 text-sm">
                  {!isCameraActivated 
                    ? "Activate your camera to begin verification" 
                    : "Complete verification to proceed"
                  }
                </p>
              </div>
            )}
          </CardFooter>
        </Card>
        
        {/* Minimal Security Notice */}
        <div className="text-center mt-4">
          <div className="inline-flex items-center gap-1 text-gray-400 text-xs">
            <ShieldCheck className="h-3 w-3" />
            <span>Secure & encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraVerificationPage;
