
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Timer } from '@/components/Timer';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Clock, Code, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const InstructionsPage = () => {
  const { assessment, assessmentCode, loading } = useAssessment();
  const navigate = useNavigate();
  const [countdownEnded, setCountdownEnded] = useState(false);
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
  
  const handleStartVerification = () => {
    navigate('/camera-verification');
  };

  const handleCountdownEnd = () => {
    setCountdownEnded(true);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <header className="text-center mb-8">
          <div className="mx-auto w-16 h-16 mb-2">
            <img src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" alt="Yudha Logo" className="w-full h-full" />
          </div>
          <p className="text-gray-600">{assessment?.name}</p>
        </header>
        
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-xl">Assessment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Instructions</h3>
              <p className="text-gray-600 mt-1">{assessment?.instructions}</p>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">MCQ Questions</p>
                  <p className="font-semibold">{assessment?.mcqCount}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Coding Questions</p>
                  <p className="font-semibold">{assessment?.codingCount}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-semibold">{assessment?.durationMinutes} minutes</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Proctoring</p>
                  <p className="font-semibold">Camera Required</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg">Important Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• You must stay in fullscreen mode during the entire assessment.</p>
            <p>• Exiting fullscreen mode 3 times will automatically terminate your assessment.</p>
            <p>• Staying outside of fullscreen for more than 30 seconds will terminate your assessment.</p>
            <p>• The assessment will start automatically when the countdown reaches zero.</p>
            <p>• You can navigate between questions using the navigation panel.</p>
            <p>• Your answers are auto-saved as you progress.</p>
            <p>• The assessment will automatically submit when the time expires.</p>
            <p>• Camera proctoring will be active throughout the entire assessment.</p>
          </CardContent>
        </Card>
        
        <Card className="text-center shadow-lg border-0">
          <CardContent className="pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium">Assessment starts in</h3>
              <div className="flex justify-center my-4">
                <Timer 
                  variant="countdown"
                  targetTime={assessment?.startTime || ''}
                  onCountdownEnd={handleCountdownEnd}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pb-6">
            <Button 
              onClick={handleStartVerification}
              disabled={!countdownEnded}
              size="lg"
              className={`bg-astra-red hover:bg-red-600 text-white transition-all ${
                countdownEnded ? 'animate-pulse' : 'opacity-50'
              }`}
            >
              {countdownEnded ? 'Proceed to Camera Setup' : 'Please Wait...'}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* Fix global styles by using proper style attribute without jsx and global */}
      <style>
        {`
          .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: .7;
            }
          }
        `}
      </style>
    </div>
  );
};

export default InstructionsPage;
