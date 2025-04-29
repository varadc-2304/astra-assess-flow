
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAssessment } from '@/contexts/AssessmentContext';

const InstructionsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loadAssessment, assessment, setSubmissionId } = useAssessment();
  const [loading, setLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const assessmentCode = localStorage.getItem('assessmentCode');
    if (!assessmentCode) {
      navigate('/student');
      toast({
        title: "No assessment code found",
        description: "Please enter a valid assessment code",
        variant: "destructive",
        duration: 1000,
      });
      return;
    }

    const fetchAssessment = async () => {
      setLoading(true);
      try {
        await loadAssessment(assessmentCode);
      } catch (error) {
        console.error('Error loading assessment:', error);
        toast({
          title: "Error",
          description: "Failed to load assessment details",
          variant: "destructive",
          duration: 1000,
        });
        navigate('/student');
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [loadAssessment, navigate, toast]);

  const handleStartAssessment = async () => {
    if (!assessment || !user) return;
    
    setIsStarting(true);
    try {
      // Create a new submission record
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          user_id: user.id,
          assessment_id: assessment.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setSubmissionId(data.id);
      navigate('/assessment');
    } catch (error) {
      console.error('Error starting assessment:', error);
      toast({
        title: "Error",
        description: "Failed to start assessment",
        variant: "destructive",
        duration: 1000,
      });
    } finally {
      setIsStarting(false);
    }
  };

  if (loading || !assessment) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p>Loading assessment instructions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-astra-red/10 to-astra-red/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">{assessment.name}</CardTitle>
              <CardDescription className="mt-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>Duration: {assessment.duration_minutes} minutes</span>
                </div>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Instructions</h3>
              <Separator className="mb-2" />
              <div className="text-sm space-y-2">
                {assessment.instructions ? (
                  <div dangerouslySetInnerHTML={{ __html: assessment.instructions }} />
                ) : (
                  <div className="space-y-2">
                    <p>Please read the following instructions carefully before starting the assessment:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>This assessment consists of multiple-choice questions (MCQs) and coding questions.</li>
                      <li>You have {assessment.duration_minutes} minutes to complete the assessment.</li>
                      <li>Once you start, the timer will begin and cannot be paused.</li>
                      <li>You can navigate between questions using the navigation panel.</li>
                      <li>Your responses will be automatically saved.</li>
                      <li>Click the "Submit" button when you're done with the assessment.</li>
                      <li>Do not refresh the page or navigate away during the assessment.</li>
                      <li>In case of any technical issues, please contact the administrator immediately.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Assessment Details</h3>
              <Separator className="mb-2" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">MCQ Questions</p>
                  <p className="font-medium">{assessment.mcqCount || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Coding Questions</p>
                  <p className="font-medium">{assessment.codingCount || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Questions</p>
                  <p className="font-medium">{(assessment.mcqCount || 0) + (assessment.codingCount || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assessment Code</p>
                  <p className="font-medium font-mono">{assessment.code}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50 flex justify-center py-6">
          <Button 
            onClick={handleStartAssessment} 
            disabled={isStarting}
            className="bg-astra-red hover:bg-red-700 text-white px-8"
          >
            {isStarting ? (
              <span>Starting...</span>
            ) : (
              <span className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4" />
                Start Assessment
              </span>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default InstructionsPage;
