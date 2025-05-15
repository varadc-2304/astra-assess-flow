
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Camera, CheckCircle2, Loader2 } from 'lucide-react';
import ProctoringCamera from '@/components/ProctoringCamera';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CameraVerificationPage = () => {
  const { assessment, startAssessment } = useAssessment();
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch assessment details to check if AI proctoring is required
  const { data: assessmentDetails, isLoading: isAssessmentLoading } = useQuery({
    queryKey: ['assessment', assessment?.id],
    queryFn: async () => {
      if (!assessment?.id) return null;
      
      const { data, error } = await supabase
        .from('assessments')
        .select('is_ai_proctored')
        .eq('id', assessment.id)
        .single();
        
      if (error) {
        console.error('Error fetching assessment details:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!assessment?.id,
  });

  const isAiProctored = assessmentDetails?.is_ai_proctored ?? true;

  // If AI proctoring is disabled, auto-verify and proceed
  useEffect(() => {
    if (assessment && !isAssessmentLoading && !isAiProctored) {
      setIsVerified(true); // Auto-verify if no AI proctoring
    }
  }, [assessment, isAssessmentLoading, isAiProctored]);

  const handleVerificationComplete = (success: boolean) => {
    if (success) {
      setIsVerified(true);
      toast({
        title: "Verification Successful",
        description: "Your camera is set up correctly for proctoring.",
        variant: "default",
      });
    }
  };

  const handleContinue = () => {
    setIsLoading(true);
    
    try {
      startAssessment();
      navigate('/student/assessment');
    } catch (error) {
      console.error('Error starting assessment:', error);
      toast({
        title: "Error",
        description: "There was a problem starting the assessment. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    setIsLoading(true);
    
    try {
      startAssessment();
      navigate('/student/assessment');
    } catch (error) {
      console.error('Error skipping camera verification:', error);
      toast({
        title: "Error",
        description: "There was a problem starting the assessment. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  if (!assessment) {
    navigate('/student');
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md shadow-xl dark:shadow-gray-800/10">
        <CardHeader>
          <CardTitle className="text-xl">Camera Verification</CardTitle>
          <CardDescription>
            {isAiProctored 
              ? "Please position yourself correctly for AI proctoring." 
              : "This assessment doesn't require camera verification."}
          </CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          {isAssessmentLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isAiProctored ? (
            <>
              <ProctoringCamera
                onVerificationComplete={handleVerificationComplete}
                showStatus={true}
                autoStart={false}
              />
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 inline mr-1 text-amber-500" />
                  This assessment requires AI proctoring. Your camera will be active throughout the test.
                </p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-amber-500 mr-2"></span>
                  Make sure your face is clearly visible
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-amber-500 mr-2"></span>
                  Ensure good lighting in your room
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-amber-500 mr-2"></span>
                  Remove hats, sunglasses or face coverings
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-red-500 mr-2"></span>
                  Phones and other devices will be flagged
                </div>
              </div>
            </>
          ) : (
            <div className="py-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">AI Proctoring Not Required</p>
              <p className="text-sm text-muted-foreground mt-2">
                This assessment doesn't require camera verification. You can proceed directly to the assessment.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          {isAiProctored ? (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate('/student')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!isVerified || isLoading}
                className="relative"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue 
                    {isVerified && <CheckCircle2 className="ml-2 h-4 w-4" />}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleSkip}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Proceed to Assessment
                  <Camera className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default CameraVerificationPage;
