
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ProctoringCamera } from '@/components/ProctoringCamera';
import { ShieldCheck, Camera, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CameraVerificationPage = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { assessment, startAssessment, assessmentCode, loading } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!loading && !assessment && assessmentCode) {
      console.log("No assessment data available, redirecting to dashboard");
      toast({
        title: "Error",
        description: "Assessment data is not available. Please try again.",
        variant: "destructive",
      });
      navigate('/student');
    }
  }, [assessment, assessmentCode, loading, navigate, toast]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading assessment details...</p>
      </div>
    );
  }
  
  if (!assessment) {
    return null; // Don't render anything while redirecting
  }
  
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
    }, 1500);
  };
  
  const handleStartAssessment = () => {
    startAssessment();
    navigate('/assessment');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-astra-red">Yudha</h1>
          <p className="text-gray-600">{assessment?.name}</p>
        </header>
        
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Camera className="mr-2 h-5 w-5 text-astra-red" />
              Camera Verification
            </CardTitle>
            <CardDescription>
              Please position yourself in front of the camera for identity verification.
              This camera feed will be used for proctoring during your assessment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProctoringCamera 
              onVerificationComplete={handleVerificationComplete}
              showControls={!isVerified}
              showStatus={true}
            />
          </CardContent>
          <CardFooter className="flex-col gap-4">
            {isVerified ? (
              <div className="w-full text-center">
                <div className="inline-flex items-center justify-center gap-2 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-full text-green-700 dark:text-green-400 mb-4">
                  <CheckCircle className="h-5 w-5" />
                  <span>Verification Complete</span>
                </div>
                <p className="text-sm text-gray-500 mb-4">
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
                <div className="flex items-center justify-center gap-2 text-amber-600 mb-3">
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
        
        <Card className="shadow-lg border-0">
          <CardHeader>
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
  );
};

export default CameraVerificationPage;
