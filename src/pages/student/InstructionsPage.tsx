
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Clock, Code, AlertTriangle, FileQuestion } from 'lucide-react';
import { Assessment } from '@/types/database';

const InstructionsPage = () => {
  const { assessment, startAssessment } = useAssessment();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    // Redirect if no assessment is loaded
    if (!assessment) {
      navigate('/student');
    }
  }, [assessment, navigate]);

  const handleStartAssessment = () => {
    if (!agreed) return;
    startAssessment();
    navigate('/assessment');
  };

  if (!assessment) {
    return <div>Loading...</div>;
  }

  // Count of each question type
  const mcqCount = assessment.questions?.filter(q => q.type === 'mcq').length || 0;
  const codingCount = assessment.questions?.filter(q => q.type === 'code').length || 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card className="shadow-lg border-astra-red border-t-4">
        <CardHeader className="bg-gray-50">
          <CardTitle className="text-2xl font-bold text-center">
            Assessment Instructions
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6 p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-astra-red">
              {assessment.name}
            </h2>
            
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                <Clock className="h-4 w-4 text-gray-600" />
                <span><strong>Duration:</strong> {assessment.durationMinutes} minutes</span>
              </div>
              
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                <FileQuestion className="h-4 w-4 text-gray-600" />
                <span><strong>MCQ Questions:</strong> {mcqCount}</span>
              </div>
              
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                <Code className="h-4 w-4 text-gray-600" />
                <span><strong>Coding Questions:</strong> {codingCount}</span>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h3 className="font-semibold">Assessment Guidelines:</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                {assessment.instructions ? (
                  <div className="whitespace-pre-line text-gray-700">
                    {assessment.instructions}
                  </div>
                ) : (
                  <ul className="list-disc pl-5 space-y-2 text-gray-700">
                    <li>The assessment must be completed within the allocated time.</li>
                    <li>You must remain in fullscreen mode throughout the assessment.</li>
                    <li>Switching tabs or leaving the assessment window will be logged.</li>
                    <li>For coding questions, write your solution in the provided editor.</li>
                    <li>Your answers are automatically saved as you progress.</li>
                  </ul>
                )}
              </div>
              
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-800">Important Note</h4>
                    <p className="text-amber-700 text-sm">
                      Exiting fullscreen mode or switching tabs more than twice will result in automatic termination of your assessment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="agree" checked={agreed} onCheckedChange={(checked) => setAgreed(checked === true)} />
                <Label htmlFor="agree" className="text-sm font-medium leading-none">
                  I understand and agree to follow all of the above rules.
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="bg-gray-50 flex justify-between px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate('/student')}
          >
            Back to Dashboard
          </Button>
          
          <Button
            onClick={handleStartAssessment}
            disabled={!agreed}
            className="bg-astra-red hover:bg-red-700"
          >
            Start Assessment
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default InstructionsPage;
