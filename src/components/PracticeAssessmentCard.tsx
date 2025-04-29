
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCode, Clock, Award, Loader2 } from 'lucide-react';
import { Assessment } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PracticeAssessmentCardProps {
  assessment: Assessment;
  isSolved?: boolean;
  marksObtained?: number;
}

const PracticeAssessmentCard = ({ assessment, isSolved = false, marksObtained = 0 }: PracticeAssessmentCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [marks, setMarks] = useState<number>(marksObtained);
  const [totalMarks, setTotalMarks] = useState<number>((assessment as any).marks || 0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  useEffect(() => {
    if (user && assessment && isSolved) {
      fetchMarks();
    } else {
      setMarks(marksObtained);
    }
  }, [user, assessment, isSolved, marksObtained]);
  
  const fetchMarks = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // First get the total possible marks for this assessment
      const { data: totalMarksData, error: totalMarksError } = await supabase
        .rpc('calculate_assessment_total_marks', { assessment_id: assessment.id });
      
      if (!totalMarksError && totalMarksData !== null) {
        setTotalMarks(totalMarksData || 0);
      }
      
      // Get the latest result for this user and assessment
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select('total_score, total_marks')
        .eq('user_id', user.id)
        .eq('assessment_id', assessment.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!resultsError && results && results.length > 0) {
        setMarks(results[0].total_score || 0);
        if (results[0].total_marks && results[0].total_marks > 0) {
          setTotalMarks(results[0].total_marks);
        }
      }
    } catch (error) {
      console.error('Error fetching marks:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStart = () => {
    localStorage.setItem('assessmentCode', assessment.code);
    navigate('/instructions');
  };
  
  return (
    <Card className="overflow-hidden border border-gray-200 transition-all hover:shadow-md">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-bold">{assessment.name}</CardTitle>
          <Badge variant={isSolved ? "secondary" : "outline"} className={isSolved ? "bg-green-100 text-green-800" : ""}>
            {isSolved ? "Completed" : "Practice"}
          </Badge>
        </div>
        <CardDescription className="text-xs text-gray-500">
          Code: {assessment.code}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center text-sm text-gray-500">
            <FileCode className="mr-2 h-4 w-4" />
            <span>
              {assessment.mcqCount || 0} MCQs, {assessment.codingCount || 0} Coding
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="mr-2 h-4 w-4" />
            <span>{assessment.duration_minutes} minutes</span>
          </div>
          {isSolved && (
            <div className="flex items-center text-sm text-green-600">
              {isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Loading marks...</span>
                </div>
              ) : (
                <>
                  <Award className="mr-2 h-4 w-4" />
                  <span>Marks: {marks}/{totalMarks}</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="bg-gray-50 pt-2">
        <Button 
          variant="outline" 
          className="w-full bg-white hover:bg-gray-100" 
          onClick={handleStart}
        >
          {isSolved ? "Practice Again" : "Start Practice"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PracticeAssessmentCard;
