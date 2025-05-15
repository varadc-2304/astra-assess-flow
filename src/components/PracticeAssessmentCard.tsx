
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCode, Clock, Award, Copy, ArrowRight, Shield } from 'lucide-react';
import { Assessment } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PracticeAssessmentCardProps {
  assessment: Assessment;
  isSolved?: boolean;
  marksObtained?: number;
  totalMarks?: number;
}

const PracticeAssessmentCard = ({ assessment, isSolved = false, marksObtained = 0, totalMarks = 0 }: PracticeAssessmentCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Fetch assessment proctoring details
  const { data: proctoringDetails } = useQuery({
    queryKey: ['assessment-proctoring', assessment?.id],
    queryFn: async () => {
      if (!assessment?.id) return { is_ai_proctored: true };
      
      const { data, error } = await supabase
        .from('assessments')
        .select('is_ai_proctored')
        .eq('id', assessment.id)
        .single();
        
      if (error) {
        console.error('Error fetching assessment proctoring details:', error);
        return { is_ai_proctored: true };
      }
      
      return data;
    },
    enabled: !!assessment?.id,
  });
  
  const isAiProctored = proctoringDetails?.is_ai_proctored ?? true;
  
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
    <Card className="overflow-hidden border border-gray-200 transition-all hover:shadow-md bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 animate-scale">
      <CardHeader className="pb-2 bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-bold text-gray-800 dark:text-gray-200">{assessment.name}</CardTitle>
          <div className="flex space-x-2">
            <Badge variant={isAiProctored ? "outline" : "secondary"} className={isAiProctored ? 
              "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-500" : 
              "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-500"}>
              {isAiProctored ? "AI Proctored" : "Self Proctored"}
            </Badge>
            <Badge variant={isSolved ? "default" : "outline"} className={isSolved ? 
              "bg-blue-500 hover:bg-blue-600" : ""}>
              {isSolved ? "Completed" : "Practice"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Code:</span>
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-sm font-mono">{assessment.code}</code>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" 
                  onClick={handleCopyCode}
                >
                  <Copy className="h-4 w-4 text-gray-500" />
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
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <FileCode className="mr-2 h-4 w-4 text-blue-500" />
              <span>
                {assessment.mcqCount || 0} MCQs, {assessment.codingCount || 0} Coding
              </span>
            </div>
            
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Clock className="mr-2 h-4 w-4 text-blue-500" />
              <span>{assessment.durationMinutes} minutes</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            {isAiProctored ? (
              <div className="flex items-center text-sm text-amber-600 dark:text-amber-500">
                <Shield className="mr-2 h-4 w-4" />
                <span>Camera required</span>
              </div>
            ) : (
              <div className="flex items-center text-sm text-green-600 dark:text-green-500">
                <Shield className="mr-2 h-4 w-4" />
                <span>No camera needed</span>
              </div>
            )}
            
            {isSolved && (
              <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium">
                <Award className="mr-2 h-4 w-4" />
                <span>{marksObtained}/{totalMarks}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 pb-4">
        <Button 
          onClick={handleStart}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow hover:shadow-lg transition-all"
        >
          {isSolved ? "Review" : "Start"} 
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PracticeAssessmentCard;
