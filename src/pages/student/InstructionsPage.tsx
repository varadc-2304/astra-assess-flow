import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Clock, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { supabase } from '@/integrations/supabase/client';

const InstructionsPage = () => {
  const { assessment, setCurrentAssessment } = useAssessment();
  const [isAgree, setIsAgree] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch assessment details to check if AI proctoring is required
  const { data: assessmentDetails, isLoading: isAssessmentLoading } = useQuery({
    queryKey: ['assessment-details', assessment?.id],
    queryFn: async () => {
      if (!assessment?.id) return null;
      
      const { data, error } = await supabase
        .from('assessments')
        .select('is_ai_proctored, instructions')
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
  const instructions = assessmentDetails?.instructions || assessment?.instructions || '';

  const handleStartAssessment = () => {
    if (!assessment) return;
    
    setIsLoading(true);
    
    // Go through camera verification if AI proctoring is enabled
    if (isAiProctored) {
      navigate('/student/camera-verification');
    } else {
      // Otherwise go directly to the assessment
      navigate('/student/assessment');
    }
  };

  if (!assessment) {
    navigate('/student');
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-3xl shadow-xl dark:shadow-gray-800/10">
        <CardHeader>
          <CardTitle className="text-2xl">{assessment.name}</CardTitle>
          <CardDescription>Please read the instructions carefully before proceeding</CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className="py-6 space-y-6">
          {isAssessmentLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-sm font-medium dark:border-gray-800 dark:bg-gray-900">
                  <Clock className="h-3.5 w-3.5 mr-1 text-gray-500 dark:text-gray-400" />
                  {assessment.duration_minutes} minutes
                </div>
                <div className="inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-sm font-medium dark:border-gray-800 dark:bg-gray-900">
                  <FileText className="h-3.5 w-3.5 mr-1 text-gray-500 dark:text-gray-400" />
                  {assessment.mcqCount || 0} MCQs, {assessment.codingCount || 0} Coding
                </div>
                {isAiProctored ? (
                  <div className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-500">
                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                    AI Proctored
                  </div>
                ) : (
                  <div className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2.5 py-0.5 text-sm font-medium text-green-800 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-500">
                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                    Self Proctored
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-md border dark:bg-gray-800 dark:border-gray-700">
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Instructions:</h3>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {instructions ? (
                    <div dangerouslySetInnerHTML={{ __html: instructions }} />
                  ) : (
                    <p>No additional instructions provided.</p>
                  )}
                </div>
              </div>

              {isAiProctored && (
                <div className="bg-amber-50 p-4 rounded-md border border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30">
                  <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-500 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    AI Proctoring Requirements:
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-amber-700 dark:text-amber-400">
                    <li>You must allow camera access for the duration of the assessment.</li>
                    <li>Your face should be clearly visible throughout the test.</li>
                    <li>Ensure good lighting and position yourself centrally in the camera frame.</li>
                    <li>No other person should be visible in the frame during the assessment.</li>
                    <li>Phones and other electronic devices will be detected and flagged.</li>
                    <li>Multiple violations may result in automatic assessment termination.</li>
                  </ul>
                </div>
              )}

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="agree"
                  checked={isAgree}
                  onChange={(e) => setIsAgree(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="agree" className="text-sm text-gray-600 dark:text-gray-300">
                  I have read and understood the instructions and agree to follow them during the assessment.
                  {isAiProctored && " I consent to camera monitoring during this assessment."}
                </label>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/student')}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStartAssessment}
            disabled={!isAgree || isLoading || isAssessmentLoading}
            className="relative"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {isAiProctored ? 'Proceed to Camera Verification' : 'Start Assessment'}
                <ExternalLink className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default InstructionsPage;
