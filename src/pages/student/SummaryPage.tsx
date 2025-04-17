
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, FileCog, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Result } from '@/types/database';

interface SubmissionSummary {
  totalQuestions: number;
  attemptedMCQ: number;
  attemptedCode: number;
  correctMCQ: number;
  correctCode: number;
  totalScore: number;
  totalMarks: number;
  percentage: number;
}

const SummaryPage = () => {
  const { assessment, assessmentEnded, totalMarksObtained, totalPossibleMarks } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SubmissionSummary | null>(null);
  
  useEffect(() => {
    if (!assessment || !assessmentEnded) {
      navigate('/student');
      return;
    }
    
    const fetchSummary = async () => {
      if (!assessment || !user) return;
      
      try {
        console.log('Fetching summary for assessment:', assessment.id, 'and user:', user.id);
        
        // Get the latest result for this assessment
        const { data: results, error: resultsError } = await supabase
          .from('results')
          .select('*')
          .eq('assessment_id', assessment.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (resultsError) {
          console.error('Error fetching results:', resultsError);
          throw new Error('No results found');
        }
        
        if (!results || results.length === 0) {
          console.error('No results found');
          throw new Error('No results found');
        }
        
        console.log('Found result:', results[0]);
        const result = results[0];
        
        // Get questions data
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('assessment_id', assessment.id);
        
        if (questionsError) {
          console.error('Error fetching questions:', questionsError);
          throw new Error('Failed to load questions');
        }
        
        console.log('Found questions:', questions?.length || 0);
        
        // Get answers for this assessment
        const { data: submissions, error: submissionsError } = await supabase
          .from('submissions')
          .select('*')
          .eq('assessment_id', assessment.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (submissionsError || !submissions || submissions.length === 0) {
          console.error('Error fetching submissions:', submissionsError);
          throw new Error('No submission found');
        }
        
        const latestSubmission = submissions[0];
        
        const { data: answers, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .eq('submission_id', latestSubmission.id);
        
        if (answersError) {
          console.error('Error fetching answers:', answersError);
          throw new Error('Failed to load answers');
        }
        
        console.log('Found answers:', answers?.length || 0);
        
        // Calculate summary statistics
        const mcqQuestions = questions?.filter(q => q.type === 'mcq') || [];
        const codeQuestions = questions?.filter(q => q.type === 'code') || [];
        
        const mcqAnswers = answers?.filter(a => mcqQuestions.some(q => q.id === a.question_id)) || [];
        const codeAnswers = answers?.filter(a => codeQuestions.some(q => q.id === a.question_id)) || [];
        
        const correctMCQ = mcqAnswers.filter(a => a.is_correct).length;
        const correctCode = codeAnswers.filter(a => a.is_correct).length;
        
        setSummary({
          totalQuestions: questions?.length || 0,
          attemptedMCQ: mcqAnswers.length,
          attemptedCode: codeAnswers.length,
          correctMCQ,
          correctCode,
          totalScore: result.total_score,
          totalMarks: result.total_marks,
          percentage: result.percentage
        });
        
        console.log('Summary data set:', {
          totalScore: result.total_score,
          totalMarks: result.total_marks,
          percentage: result.percentage
        });
        
      } catch (error) {
        console.error('Error fetching summary:', error);
        
        // Fall back to context values if database fetch fails
        if (assessment) {
          const mcqCount = assessment.questions.filter(q => q.type === 'mcq').length;
          const codeCount = assessment.questions.filter(q => q.type === 'code').length;
          const attemptedMCQ = assessment.questions.filter(q => q.type === 'mcq' && 'selectedOption' in q && q.selectedOption).length;
          const attemptedCode = assessment.questions.filter(q => q.type === 'code' && 'userSolution' in q && Object.values(q.userSolution).some(sol => sol && sol.trim() !== '')).length;
          
          setSummary({
            totalQuestions: assessment.questions.length,
            attemptedMCQ,
            attemptedCode,
            correctMCQ: 0, // We don't know this without database
            correctCode: 0, // We don't know this without database
            totalScore: totalMarksObtained,
            totalMarks: totalPossibleMarks,
            percentage: totalPossibleMarks > 0 ? Math.round((totalMarksObtained / totalPossibleMarks) * 100) : 0
          });
          
          toast({
            title: "Warning",
            description: "Could not load complete results from database, showing partial data.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to load assessment summary",
            variant: "destructive"
          });
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchSummary();
    
    // Auto-redirect to the detailed report page after 5 seconds
    const timer = setTimeout(() => {
      navigate('/report');
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [assessment, assessmentEnded, navigate, user, toast, totalMarksObtained, totalPossibleMarks]);
  
  if (loading || !assessment || !summary) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-astra-red mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Processing your results...</h2>
          <p className="text-gray-600 mt-2">Please wait while we calculate your assessment summary.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Assessment Complete!</h1>
          <p className="text-gray-600">Your responses have been recorded successfully</p>
        </div>
        
        <Card className="mb-8 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCog className="h-5 w-5" />
              Assessment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm text-gray-500">Assessment</h3>
                <p className="font-medium">{assessment.name}</p>
              </div>
              <div>
                <h3 className="text-sm text-gray-500">Code</h3>
                <p className="font-medium">{assessment.code}</p>
              </div>
              <div>
                <h3 className="text-sm text-gray-500">Student</h3>
                <p className="font-medium">{user?.name}</p>
              </div>
              <div>
                <h3 className="text-sm text-gray-500">Email</h3>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-lg font-medium mb-3">Performance</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold text-astra-red">{summary.percentage}%</p>
                  <p className="text-xs text-gray-500">Score</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold">{summary.totalScore}/{summary.totalMarks}</p>
                  <p className="text-xs text-gray-500">Marks</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold">{summary.attemptedMCQ}</p>
                  <p className="text-xs text-gray-500">MCQs Attempted</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold">{summary.attemptedCode}</p>
                  <p className="text-xs text-gray-500">Coding Questions</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Redirecting to detailed report...</span>
              </div>
              <Button 
                onClick={() => navigate('/report')}
                className="bg-astra-red hover:bg-red-600 text-white"
              >
                View Detailed Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SummaryPage;
