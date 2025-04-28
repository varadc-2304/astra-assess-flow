import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, FileText, Timer, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AssessmentCodeInput from '@/components/AssessmentCodeInput';

const InstructionsPage = () => {
  const { 
    assessment, 
    assessmentCode,
    startAssessment, 
    loadAssessment, 
    checkReattemptAvailability,
    loading 
  } = useAssessment();
  const [isVerifying, setIsVerifying] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Keep track if assessment was loaded using the loadAssessment
  // This is for when navigating back from Assessment page, we don't want to trigger loadAssessment again
  const [wasLoaded, setWasLoaded] = useState(false);

  useEffect(() => {
    if (assessmentCode && !assessment && !wasLoaded && !loading) {
      const loadExistingAssessment = async () => {
        setIsVerifying(true);
        
        try {
          const result = await loadAssessment(assessmentCode);
          setWasLoaded(result);
          
          if (!result) {
            toast({
              title: "Assessment Not Found",
              description: "The assessment code is invalid or the assessment is not available.",
              variant: "destructive",
            });
            navigate('/student');
          }
        } finally {
          setIsVerifying(false);
        }
      };
      
      loadExistingAssessment();
    }
  }, [assessmentCode, assessment, loadAssessment, navigate, toast, wasLoaded, loading]);

  const handleStartAssessment = async () => {
    if (!assessment) return;
    
    setIsVerifying(true);
    
    try {
      // Check if user can reattempt this assessment
      const canAttempt = await checkReattemptAvailability(assessment.id);
      
      if (!canAttempt) {
        // If reattempt is not allowed, the user will be redirected in checkReattemptAvailability
        return;
      }
      
      startAssessment();
      navigate('/assessment');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start assessment. Please try again.",
        variant: "destructive",
      });
      console.error('Error starting assessment:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!assessment) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Enter Assessment Code</CardTitle>
            <CardDescription>
              Please enter the assessment code provided by your instructor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssessmentCodeInput />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{assessment.name}</CardTitle>
              <CardDescription className="mt-2">
                Code: <span className="font-medium">{assessment.code}</span>
              </CardDescription>
            </div>
            <Badge variant="outline" className={`
              ${assessment.status === 'Active' ? 'bg-green-100 text-green-800 border-green-200' : ''}
              ${assessment.status === 'Scheduled' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
              ${assessment.status === 'Completed' ? 'bg-gray-100 text-gray-800 border-gray-200' : ''}
            `}>
              {assessment.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <Timer className="h-5 w-5 mr-2 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">Duration</p>
                <p className="text-base">{assessment.duration_minutes} minutes</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">Questions</p>
                <p className="text-base">
                  {assessment.mcqCount + assessment.codingCount} Total ({assessment.mcqCount} MCQ, {assessment.codingCount} Coding)
                </p>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="text-base font-medium mb-2">Instructions</h4>
            <div className="prose prose-sm max-w-none">
              {assessment.instructions ? (
                <p className="whitespace-pre-line text-gray-700">{assessment.instructions}</p>
              ) : (
                <p className="text-gray-500 italic">No specific instructions provided.</p>
              )}
            </div>
          </div>
          
          <div className="border-t pt-4 space-y-4">
            <h4 className="text-base font-medium">Important Notes:</h4>
            
            <div className="space-y-2">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                <p className="text-sm text-gray-700">
                  The assessment begins at {formatDate(assessment.start_time)}.
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Once started, you will have {assessment.duration_minutes} minutes to complete the assessment.
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                <p className="text-sm text-gray-700">
                  The assessment must be completed in a single session. Your progress will be automatically submitted if the time runs out.
                </p>
              </div>
              
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                <p className="text-sm text-gray-700">
                  <strong>Important:</strong> You must stay in full-screen mode during the assessment. Repeatedly exiting full-screen will flag your submission.
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                <p className="text-sm text-gray-700">
                  You can navigate between questions freely and change your answers at any time before submission.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between border-t pt-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/student')}
          >
            Back to Dashboard
          </Button>
          <Button 
            onClick={handleStartAssessment} 
            disabled={isVerifying || assessment.status !== 'Active'}
            className="bg-astra-red hover:bg-red-600 text-white"
          >
            {isVerifying ? (
              <>Loading...</>
            ) : assessment.status === 'Active' ? (
              <>Start Assessment</>
            ) : assessment.status === 'Scheduled' ? (
              <>Not Available Yet</>
            ) : (
              <>Assessment Closed</>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default InstructionsPage;
