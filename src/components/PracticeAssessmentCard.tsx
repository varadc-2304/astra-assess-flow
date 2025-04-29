
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCode, Clock, Award, Copy } from 'lucide-react';
import { Assessment } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PracticeAssessmentCardProps {
  assessment: Assessment;
  isSolved?: boolean;
  marksObtained?: number;
  totalMarks?: number; // Add this prop
}

const PracticeAssessmentCard = ({ 
  assessment, 
  isSolved = false, 
  marksObtained = 0,
  totalMarks = 0 // Add default value
}: PracticeAssessmentCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const handleStart = () => {
    // Clear any previous assessment data from localStorage
    localStorage.removeItem('assessmentCode');
    // Set the new assessment code
    localStorage.setItem('assessmentCode', assessment.code);
    
    toast({
      title: "Loading assessment",
      description: `Starting ${assessment.name}`,
      duration: 1000
    });
    
    // Directly navigate to instructions page with the assessment code
    navigate('/instructions');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(assessment.code);
    toast({
      title: "Code copied",
      description: "Assessment code copied to clipboard",
      duration: 1000
    });
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
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-700">Code:</span>
            <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">{assessment.code}</code>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={handleCopyCode}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy assessment code</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
              <span>Marks: {marksObtained}/{totalMarks}</span>
            </div>
          )}
        </div>
      </CardContent>
      

    </Card>
  );
};

export default PracticeAssessmentCard;
