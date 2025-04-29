
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCode, Clock, Award } from 'lucide-react';
import { Assessment } from '@/types/database';

interface PracticeAssessmentCardProps {
  assessment: Assessment;
  isSolved?: boolean;
  marksObtained?: number;
}

const PracticeAssessmentCard = ({ assessment, isSolved = false, marksObtained = 0 }: PracticeAssessmentCardProps) => {
  const navigate = useNavigate();
  
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
              <Award className="mr-2 h-4 w-4" />
              <span>Marks: {marksObtained}/{(assessment as any).marks || 0}</span>
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
