import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Timer } from '@/components/Timer';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Clock, Code, Camera, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

const InstructionsPage = () => {
  const { assessmentCode, loading, loadAssessment, startAssessment } = useAssessment();
  const navigate = useNavigate();
  const [countdownEnded, setCountdownEnded] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [assessmentMetadata, setAssessmentMetadata] = useState<any>(null);
  const { toast } = useToast();
  

  // Load assessment metadata when component mounts
  useEffect(() => {
  const loadMetadata = async () => {
      if (!assessmentCode) {
        navigate('/student');
        return;
      }

      try {
        const { data: assessmentData, error } = await supabase
          .from('assessments')
          .select('*')
          .eq('code', assessmentCode.toUpperCase())
          .single();

        if (error || !assessmentData) {
          toast({
            title: "Error",
            description: "Failed to load assessment details.",
            variant: "destructive",
          });
          navigate('/student');
          return;
        }

        setAssessmentMetadata(assessmentData);
      } catch (error) {
        toast({
          title: "Error",
          description: "An error occurred while loading assessment details.",
          variant: "destructive",
        });
        navigate('/student');
      }
    };

    loadMetadata();
  }, [assessmentCode, navigate, toast]);
  
  if (!assessmentMetadata) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg">Loading assessment details...</p>
      </div>
    );
  }
  
  const handleStartAssessment = async () => {
    // Check if assessment has ended
    if (assessmentMetadata?.end_time && new Date() > new Date(assessmentMetadata.end_time)) {
      toast({
        title: "Assessment Expired",
        description: "This assessment has already ended and cannot be started.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingQuestions(true);
    
    try {
      // Load assessment questions
      const success = await loadAssessment(assessmentCode);
      
      if (!success) {
        toast({
          title: "Error",
          description: "Failed to load assessment questions. Please try again.",
          variant: "destructive",
        });
        setIsLoadingQuestions(false);
        return;
      }

      // Check if proctoring is required based on the is_ai_proctored flag
      if (assessmentMetadata?.is_ai_proctored) {
        // If AI proctoring is enabled, navigate to camera verification
        navigate('/camera-verification');
      } else {
        // If AI proctoring is disabled, start assessment directly
        startAssessment();
        navigate('/assessment');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while loading the assessment.",
        variant: "destructive",
      });
      setIsLoadingQuestions(false);
    }
  };

  const handleCountdownEnd = () => {
    setCountdownEnded(true);
  };

  
  // Count questions from assessment metadata
  const mcqCount = assessmentMetadata?.is_dynamic 
    ? 0 // Will be calculated from constraints
    : 0; // Will need to fetch from related tables
  const codingCount = assessmentMetadata?.is_dynamic
    ? 0 // Will be calculated from constraints  
    : 0; // Will need to fetch from related tables

  return (
    <div className="min-h-screen bg-gray-50 py-12 relative">
      {/* Loading Overlay */}
      {isLoadingQuestions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-8 max-w-sm mx-4">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Loading Assessment</h3>
                <p className="text-sm text-muted-foreground">Please wait while we prepare your questions...</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4">
        <Card className="mb-6 shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <CardTitle className="text-xl flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Assessment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <div className="h-1 w-8 bg-primary rounded" />
                Instructions
              </h3>
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <MarkdownRenderer 
                  content={assessmentMetadata?.instructions || 'No instructions provided.'} 
                />
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="p-2 rounded-full bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Duration</p>
                  <p className="font-semibold text-foreground">{assessmentMetadata?.duration_minutes} minutes</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="p-2 rounded-full bg-primary/10">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Proctoring</p>
                  <p className="font-semibold text-foreground">
                    {assessmentMetadata?.is_ai_proctored ? "Camera Required" : "Self Proctored"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mb-6 shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader className="border-b bg-gradient-to-r from-amber-500/5 to-orange-500/5">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              Important Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm pt-6">
            <div className="space-y-2.5">
              <p className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Tab switching and app switching detection is active on all devices.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span className="font-semibold text-destructive">Switching tabs/apps 3 times will automatically terminate your assessment.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>All browsers are supported with robust anti-cheating measures.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>The assessment will start when you click the button below.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>You can navigate between questions using the navigation panel.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Your answers are auto-saved as you progress.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>The assessment will automatically submit when the time expires.</span>
              </p>
              {assessmentMetadata?.is_ai_proctored && (
                <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <span className="text-primary mt-0.5">•</span>
                  <span className="font-medium">Camera proctoring will be active throughout the entire assessment.</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="text-center shadow-lg border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur">
          <CardContent className="pt-8 pb-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2 flex items-center justify-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Assessment starts in
              </h3>
              <div className="flex justify-center my-6">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-xl border border-primary/20">
                  <Timer 
                    variant="countdown"
                    targetTime={assessmentMetadata?.start_time || ''}
                    onCountdownEnd={handleCountdownEnd}
                  />
                </div>
              </div>
            </div>
            <Button 
              onClick={handleStartAssessment}
              disabled={!countdownEnded || (assessmentMetadata?.end_time && new Date() > new Date(assessmentMetadata.end_time)) || isLoadingQuestions}
              size="lg"
              className={`bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all shadow-lg ${
                countdownEnded && (!assessmentMetadata?.end_time || new Date() <= new Date(assessmentMetadata.end_time)) && !isLoadingQuestions ? 'animate-pulse' : 'opacity-50'
              }`}
            >
              {assessmentMetadata?.end_time && new Date() > new Date(assessmentMetadata.end_time) 
                ? 'Assessment Expired' 
                : countdownEnded 
                  ? (assessmentMetadata?.is_ai_proctored ? 'Proceed to Camera Setup' : 'Start Assessment') 
                  : 'Please Wait...'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstructionsPage;
