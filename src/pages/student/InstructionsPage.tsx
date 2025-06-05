
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Timer } from '@/components/Timer';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Clock, Code, Camera, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const InstructionsPage = () => {
  const { assessment, assessmentCode, loading, startAssessment } = useAssessment();
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-astra-red border-t-transparent rounded-full mx-auto mb-6"></div>
          <p className="text-xl font-medium text-gray-700">Loading assessment details...</p>
        </div>
      </div>
    );
  }
  
  if (!assessment) {
    return null; // Don't render anything while redirecting
  }
  
  const handleStartAssessment = () => {
    // Check if proctoring is required based on the is_ai_proctored flag
    if (assessment?.isAiProctored) {
      // If AI proctoring is enabled, navigate to camera verification
      navigate('/camera-verification');
    } else {
      // If AI proctoring is disabled, start assessment directly
      startAssessment();
      navigate('/assessment');
    }
  };

  const handleCountdownEnd = () => {
    setCountdownEnded(true);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <header className="text-center mb-12">
          <div className="mx-auto w-20 h-20 mb-6 bg-gradient-to-br from-astra-red/10 to-astra-red/5 rounded-full flex items-center justify-center shadow-lg">
            <Shield className="h-10 w-10 text-astra-red" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Assessment Instructions</h1>
          <div className="max-w-2xl mx-auto">
            <p className="text-xl text-gray-600 mb-2">{assessment?.name}</p>
            <div className="w-24 h-1 bg-gradient-to-r from-astra-red to-red-600 mx-auto rounded-full"></div>
          </div>
        </header>
        
        <div className="space-y-8">
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
              <CardTitle className="text-2xl font-semibold text-gray-900">Assessment Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Instructions</h3>
                <p className="text-gray-700 leading-relaxed text-lg">{assessment?.instructions}</p>
              </div>
              
              <Separator className="my-6" />
              
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <ClipboardList className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">MCQ Questions</p>
                    <p className="text-2xl font-bold text-blue-700">{assessment?.mcqCount}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Code className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-900">Coding Questions</p>
                    <p className="text-2xl font-bold text-green-700">{assessment?.codingCount}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-900">Duration</p>
                    <p className="text-2xl font-bold text-purple-700">{assessment?.durationMinutes} min</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <Camera className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-900">Monitoring</p>
                    <p className="text-lg font-bold text-red-700">
                      {assessment?.isAiProctored ? "AI Proctored" : "Self Monitored"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
                Important Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid gap-4 text-gray-700">
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-astra-red rounded-full mt-2 flex-shrink-0"></span>
                  <p>You must remain in fullscreen mode throughout the entire assessment</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-astra-red rounded-full mt-2 flex-shrink-0"></span>
                  <p>Exiting fullscreen mode 3 times will automatically terminate your assessment</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-astra-red rounded-full mt-2 flex-shrink-0"></span>
                  <p>Staying outside fullscreen for more than 30 seconds will terminate your assessment</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-astra-red rounded-full mt-2 flex-shrink-0"></span>
                  <p>Navigate between questions using the provided navigation panel</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-astra-red rounded-full mt-2 flex-shrink-0"></span>
                  <p>Your answers are automatically saved as you progress</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-astra-red rounded-full mt-2 flex-shrink-0"></span>
                  <p>The assessment will automatically submit when time expires</p>
                </div>
                {assessment?.isAiProctored && (
                  <div className="flex items-start gap-3">
                    <span className="w-2 h-2 bg-astra-red rounded-full mt-2 flex-shrink-0"></span>
                    <p>AI monitoring will be active throughout the entire assessment duration</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="text-center shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="pt-10 pb-6">
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">Assessment Begins In</h3>
                <div className="flex justify-center my-6">
                  <div className="bg-gray-50 px-8 py-4 rounded-xl shadow-inner">
                    <Timer 
                      variant="countdown"
                      targetTime={assessment?.startTime || ''}
                      onCountdownEnd={handleCountdownEnd}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center pb-10">
              <Button 
                onClick={handleStartAssessment}
                disabled={!countdownEnded}
                size="lg"
                className={`bg-astra-red hover:bg-red-600 text-white transition-all px-8 py-4 text-lg font-medium shadow-xl ${
                  countdownEnded ? 'animate-pulse hover:shadow-2xl transform hover:-translate-y-1' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                {countdownEnded ? (assessment?.isAiProctored ? 'Proceed to Verification' : 'Begin Assessment') : 'Please Wait...'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InstructionsPage;
