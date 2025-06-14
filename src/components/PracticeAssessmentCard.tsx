
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCode, Clock, Award, Copy, ArrowRight, Trophy, CheckCircle2, Play } from 'lucide-react';
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
  totalMarks?: number;
}

const PracticeAssessmentCard = ({ assessment, isSolved = false, marksObtained = 0, totalMarks = 0  }: PracticeAssessmentCardProps) => {
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
    <Card className="card-modern group relative overflow-hidden border-0">
      <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 opacity-80"></div>
      
      {isSolved && (
        <div className="absolute top-4 right-4 z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
            <Trophy className="h-6 w-6 text-white" />
          </div>
        </div>
      )}

      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-astra-red transition-colors">
              {assessment.name}
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                <span className="text-xs font-medium text-gray-600">Code:</span>
                <code className="text-xs font-mono font-bold text-gray-900">{assessment.code}</code>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 hover:bg-gray-200 rounded-full" 
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
          </div>
          <Badge 
            variant={isSolved ? "default" : "outline"} 
            className={`${isSolved ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg" : "border-gray-300"} px-3 py-1`}
          >
            {isSolved ? "Completed" : "Practice"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileCode className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium">Questions</p>
              <p className="text-lg font-bold text-gray-900">
                {(assessment.mcqCount || 0) + (assessment.codingCount || 0)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium">Duration</p>
              <p className="text-lg font-bold text-gray-900">{assessment.duration_minutes}m</p>
            </div>
          </div>
        </div>

        {isSolved && (
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Award className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Your Score</p>
              <p className="text-lg font-bold text-emerald-700">{marksObtained}/{totalMarks}</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
        )}
      </CardContent>

      <CardFooter className="relative pt-4">
        <Button 
          onClick={handleStart}
          className="btn-modern w-full h-12 bg-gradient-to-r from-astra-red to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold"
        >
          <Play className="mr-2 h-5 w-5" />
          {isSolved ? "Retake Assessment" : "Start Practice"}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PracticeAssessmentCard;
