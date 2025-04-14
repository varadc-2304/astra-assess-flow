
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, FileCog } from 'lucide-react';

const SummaryPage = () => {
  const { assessment, assessmentEnded } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!assessment || !assessmentEnded) {
      navigate('/student');
    }
  }, [assessment, assessmentEnded, navigate]);
  
  if (!assessment) {
    return null;
  }
  
  // Calculate dummy results for demo purposes
  const totalQuestions = assessment.questions.length;
  const attemptedMCQ = assessment.questions
    .filter(q => q.type === 'mcq' && (q.selectedOption !== undefined))
    .length;
  
  const attemptedCode = assessment.questions
    .filter(q => q.type === 'code' && Object.values(q.userSolution).some(solution => solution && solution.trim() !== ''))
    .length;
  
  const score = Math.floor(Math.random() * 51) + 50; // Random score between 50 and 100 for demo
  
  const handleDownloadReport = () => {
    alert('Report download functionality would be implemented here.');
  };
  
  const handleReturnToDashboard = () => {
    navigate('/student');
  };
  
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
                  <p className="text-2xl font-bold text-astra-red">{score}%</p>
                  <p className="text-xs text-gray-500">Score</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold">{totalQuestions}</p>
                  <p className="text-xs text-gray-500">Total Questions</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold">{attemptedMCQ}</p>
                  <p className="text-xs text-gray-500">MCQs Attempted</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold">{attemptedCode}</p>
                  <p className="text-xs text-gray-500">Coding Questions</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                A detailed report of your performance has been generated. 
                You can download it for future reference or return to the dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  variant="outline" 
                  onClick={handleDownloadReport}
                >
                  Download Report
                </Button>
                <Button 
                  onClick={handleReturnToDashboard}
                  className="bg-astra-red hover:bg-red-600 text-white"
                >
                  Return to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SummaryPage;
