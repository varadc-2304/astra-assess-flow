
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';
import { AlertCircle, CheckCircle, Clock, CircleOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AssessmentResult {
  totalScore: number;
  totalMarks: number;
  percentage: number;
  completedAt: string;
  assessmentName: string;
  assessmentId: string;
}

const SummaryPage = () => {
  const { assessment, totalMarksObtained, totalPossibleMarks } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchResult = async () => {
      if (!assessment || !user) {
        setLoading(false);
        return;
      }
      
      try {
        // Get the latest result for this assessment
        const { data, error } = await supabase
          .from('results')
          .select('*')
          .eq('assessment_id', assessment.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          setResult({
            totalScore: data[0].total_score,
            totalMarks: data[0].total_marks,
            percentage: data[0].percentage,
            completedAt: data[0].completed_at,
            assessmentName: assessment.name,
            assessmentId: assessment.id
          });
        }
      } catch (error) {
        console.error('Error fetching result:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResult();
  }, [assessment, user]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p>Loading your results...</p>
      </div>
    );
  }
  
  if (!assessment || !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-4">No Assessment Data</h2>
          <p className="text-gray-600 mb-6">
            We couldn't find your assessment data. You may need to start a new assessment.
          </p>
          <Button onClick={() => navigate('/student')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getPerformanceFeedback = (percentage: number) => {
    if (percentage >= 90) return "Excellent performance! You've mastered this topic.";
    if (percentage >= 75) return "Great job! You have a strong understanding.";
    if (percentage >= 60) return "Good work! You understand most concepts, but there's room for improvement.";
    if (percentage >= 40) return "You've demonstrated basic understanding, but more practice is needed.";
    return "More practice needed. Focus on strengthening your understanding.";
  };
  
  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 90) return <CheckCircle className="h-6 w-6 text-green-600" />;
    if (percentage >= 75) return <CheckCircle className="h-6 w-6 text-green-500" />;
    if (percentage >= 60) return <CheckCircle className="h-6 w-6 text-amber-500" />;
    if (percentage >= 40) return <CircleOff className="h-6 w-6 text-orange-500" />;
    return <AlertCircle className="h-6 w-6 text-red-500" />;
  };
  
  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-green-600";
    if (percentage >= 75) return "bg-green-500";
    if (percentage >= 60) return "bg-amber-500";
    if (percentage >= 40) return "bg-orange-500";
    return "bg-red-500";
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-3xl">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Assessment Result</h1>
              <Button variant="outline" onClick={() => navigate('/student')}>
                Return to Dashboard
              </Button>
            </div>
            
            <div className="mb-6">
              <h2 className="text-lg font-medium">{result.assessmentName}</h2>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                <span>Completed on {formatDate(result.completedAt)}</span>
                <span className="mx-2">•</span>
                <span>Duration: {assessment.duration_minutes} minutes</span>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center mb-6 gap-6">
              <div className="relative h-40 w-40">
                {/* Circular progress */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {result.percentage}%
                    </div>
                    <div className="text-sm text-gray-500">Score</div>
                  </div>
                </div>
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <path
                    className="stroke-gray-200"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    className={`stroke-current ${getProgressColor(result.percentage)}`}
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="100"
                    strokeDashoffset={100 - result.percentage}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              
              <div className="flex-1">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getPerformanceBadge(result.percentage)}
                    <h3 className="font-medium">Your Performance</h3>
                  </div>
                  <p className="text-gray-600">
                    {getPerformanceFeedback(result.percentage)}
                  </p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium">Score Breakdown</div>
                    <div className="text-sm text-gray-500">
                      {result.totalScore} / {result.totalMarks} points
                    </div>
                  </div>
                  <Progress 
                    value={result.percentage} 
                    className="h-2"
                    indicatorClassName={cn(getProgressColor(result.percentage))}
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="text-sm font-medium mb-1">Total Questions</div>
                <div>{assessment.questions.length}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="text-sm font-medium mb-1">Question Types</div>
                <div>MCQ: {assessment.mcqCount}, Coding: {assessment.codingCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">
            Thank you for completing this assessment.
          </p>
          <p className="text-sm text-gray-500">
            Your results have been recorded and are available to your instructors.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
