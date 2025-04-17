
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Timer } from '@/components/Timer';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Clock, Code } from 'lucide-react';

const InstructionsPage = () => {
  const { assessment, startAssessment, assessmentCode } = useAssessment();
  const navigate = useNavigate();
  const [countdownEnded, setCountdownEnded] = useState(false);
  
  // Check if assessment exists and redirect if not
  useEffect(() => {
    if (!assessment && assessmentCode) {
      navigate('/student');
    }
  }, [assessment, assessmentCode, navigate]);
  
  if (!assessment) {
    return null; // Don't render anything while redirecting
  }
  
  const handleStartAssessment = () => {
    startAssessment();
    navigate('/assessment');
  };

  // Handle countdown end
  const handleCountdownEnd = () => {
    setCountdownEnded(true);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-astra-red">Yudh</h1>
          <p className="text-gray-600">{assessment.name}</p>
        </header>
        
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-xl">Assessment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Instructions</h3>
              <p className="text-gray-600 mt-1">{assessment.instructions}</p>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">MCQ Questions</p>
                  <p className="font-semibold">{assessment.mcqCount}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Coding Questions</p>
                  <p className="font-semibold">{assessment.codingCount}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-astra-red" />
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-semibold">{assessment.durationMinutes} minutes</p>
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
          </CardContent>
        </Card>
        
        <Card className="text-center shadow-lg border-0">
          <CardContent className="pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium">Assessment starts in</h3>
              <div className="flex justify-center my-4">
                <Timer 
                  variant="countdown"
                  targetTime={assessment.startTime}
                  onCountdownEnd={handleCountdownEnd}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pb-6">
            <Button 
              onClick={handleStartAssessment}
              disabled={!countdownEnded}
              size="lg"
              className={`bg-astra-red hover:bg-red-600 text-white transition-all ${
                countdownEnded ? 'animate-pulse' : 'opacity-50'
              }`}
            >
              {countdownEnded ? 'Start Assessment' : 'Please Wait...'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default InstructionsPage;
