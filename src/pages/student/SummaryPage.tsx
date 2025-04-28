
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/utils';
import { CheckCircle, BookOpen, Timer, User, ArrowRight, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Result } from '@/types/database';

const SummaryPage = () => {
  const { assessment, assessmentEnded, totalMarksObtained, totalPossibleMarks } = useAssessment();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchResult = async () => {
      if (!user || !assessment) return;
      
      try {
        const { data, error } = await supabase
          .from('results')
          .select('*')
          .eq('user_id', user.id)
          .eq('assessment_id', assessment.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error) {
          console.error('Error fetching result:', error);
          return;
        }
        
        setResult(data);
      } catch (error) {
        console.error('Error in fetchResult:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResult();
  }, [user, assessment]);
  
  // Calculate percentage
  const percentage = totalPossibleMarks > 0 
    ? Math.round((totalMarksObtained / totalPossibleMarks) * 100) 
    : 0;
  
  // If no assessment or not ended, redirect to student dashboard
  useEffect(() => {
    if (!assessment && !loading) {
      toast({
        title: "No Assessment Found",
        description: "Please select an assessment from your dashboard.",
        variant: "destructive",
      });
      navigate('/student');
    }
  }, [assessment, loading, navigate, toast]);
  
  if (loading || !assessment) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading result...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Card className="w-full shadow-md">
        <CardHeader className="text-center border-b pb-6">
          <CardTitle className="text-2xl mb-1">Assessment Completed</CardTitle>
          <CardDescription>
            Great job! You have successfully completed the assessment.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-medium">Your Result</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-1 flex items-center">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Assessment Details
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{assessment.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Duration</p>
                    <p>{assessment.duration_minutes} minutes</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Completed On</p>
                    <p>{result ? formatDate(result.completed_at) : "Just now"}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-1 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Your Information
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{user?.name || user?.email}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-1 flex items-center">
                <Award className="h-4 w-4 mr-2" />
                Score Summary
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{totalMarksObtained}/{totalPossibleMarks}</div>
                  <p className="text-gray-500">Total Score</p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span>Your Performance</span>
                    <span className="font-medium">{percentage}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
                
                <div className="pt-2 border-t mt-4">
                  <div className="text-center">
                    {percentage >= 70 ? (
                      <div className="text-green-600 font-medium flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Well done!
                      </div>
                    ) : percentage >= 40 ? (
                      <div className="text-amber-600 font-medium">
                        Good effort!
                      </div>
                    ) : (
                      <div className="text-red-600 font-medium">
                        Keep practicing!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="border-t pt-6 flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate('/student')}>
            Back to Dashboard
          </Button>
          <div className="text-sm text-gray-500">
            Thank you for completing the assessment!
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SummaryPage;
