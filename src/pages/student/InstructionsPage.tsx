import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Timer } from '@/components/Timer';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Clock, Code, Camera, AlertTriangle, CheckCircle2, Info, Shield } from 'lucide-react';
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="card-modern p-8 text-center max-w-md">
          <div className="animate-spin w-12 h-12 border-4 border-astra-red border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-900">Loading assessment details...</p>
          <p className="text-gray-600 mt-2">Please wait while we prepare your assessment</p>
        </div>
      </div>
    );
  }
  
  if (!assessment) {
    return null; // Don't render anything while redirecting
  }
  
  const handleStartAssessment = () => {
    if (assessment?.isAiProctored) {
      navigate('/camera-verification');
    } else {
      startAssessment();
      navigate('/assessment');
    }
  };

  const handleCountdownEnd = () => {
    setCountdownEnded(true);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container-modern section-spacing">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-astra-red to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <ClipboardList className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
            Assessment Instructions
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Please read the following instructions carefully before starting your assessment
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Assessment Details */}
          <Card className="card-modern border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-astra-red/5 to-orange-500/5 p-1">
              <CardHeader className="bg-white/90 backdrop-blur-sm">
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Info className="h-6 w-6 text-astra-red" />
                  Assessment Details
                </CardTitle>
              </CardHeader>
            </div>
            <CardContent className="p-8 space-y-6">
              <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Instructions</h3>
                <p className="text-gray-700 leading-relaxed">{assessment?.instructions}</p>
              </div>
              
              <Separator className="my-6" />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <ClipboardList className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">MCQ Questions</p>
                  <p className="text-2xl font-bold text-gray-900">{assessment?.mcqCount}</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-100">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Code className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Coding Questions</p>
                  <p className="text-2xl font-bold text-gray-900">{assessment?.codingCount}</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Duration</p>
                  <p className="text-2xl font-bold text-gray-900">{assessment?.durationMinutes}m</p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-100">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Camera className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Proctoring</p>
                  <p className="text-lg font-bold text-gray-900">
                    {assessment?.isAiProctored ? "AI Enabled" : "Self Proctored"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Important Rules */}
          <Card className="card-modern border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 p-1">
              <CardHeader className="bg-white/90 backdrop-blur-sm">
                <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Shield className="h-6 w-6 text-amber-600" />
                  Important Rules & Guidelines
                </CardTitle>
              </CardHeader>
            </div>
            <CardContent className="p-8">
              <div className="grid gap-4">
                {[
                  "You must stay in fullscreen mode during the entire assessment",
                  "Exiting fullscreen mode 3 times will automatically terminate your assessment",
                  "Staying outside of fullscreen for more than 30 seconds will terminate your assessment",
                  "The assessment will start automatically when the countdown reaches zero",
                  "You can navigate between questions using the navigation panel",
                  "Your answers are auto-saved as you progress",
                  "The assessment will automatically submit when the time expires",
                  ...(assessment?.isAiProctored ? ["Camera proctoring will be active throughout the entire assessment"] : [])
                ].map((rule, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100">
                    <div className="w-6 h-6 bg-gradient-to-br from-astra-red to-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                    <p className="text-gray-700 leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Countdown & Start */}
          <Card className="card-modern border-0 text-center overflow-hidden">
            <div className="bg-gradient-to-r from-astra-red/5 to-red-600/5 p-1">
              <CardContent className="bg-white/90 backdrop-blur-sm pt-12 pb-6">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Assessment starts in</h3>
                  <div className="flex justify-center">
                    <Timer 
                      variant="countdown"
                      targetTime={assessment?.startTime || ''}
                      onCountdownEnd={handleCountdownEnd}
                    />
                  </div>
                </div>
              </CardContent>
            </div>
            <CardFooter className="flex justify-center pb-12 bg-white/90 backdrop-blur-sm">
              <Button 
                onClick={handleStartAssessment}
                disabled={!countdownEnded}
                size="lg"
                className={`btn-modern h-16 px-12 text-lg font-bold ${
                  countdownEnded 
                    ? 'bg-gradient-to-r from-astra-red to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl animate-pulse' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {countdownEnded ? (
                  assessment?.isAiProctored ? 'Proceed to Camera Setup' : 'Start Assessment'
                ) : (
                  'Please Wait...'
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InstructionsPage;
