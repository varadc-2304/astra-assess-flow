
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AssessmentCodeInput } from '@/components/AssessmentCodeInput';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';
import { AlertCircle, CheckCircle, Clock, PenTool, ShieldAlert, Code2 } from 'lucide-react';

const InstructionsPage = () => {
  const { 
    assessment, 
    assessmentCode, 
    setAssessmentCode, 
    startAssessment, 
    loadAssessment, 
    loading, 
    error, 
    checkReattemptAvailability 
  } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  
  useEffect(() => {
    // If there's an assessment already loaded, check reattempt availability
    if (assessment?.id) {
      checkReattemptAvailability(assessment.id);
    }
  }, [assessment?.id, checkReattemptAvailability]);
  
  const handleLoadAssessment = async () => {
    setLoadingAssessment(true);
    try {
      const success = await loadAssessment(assessmentCode);
      if (success) {
        // Assessment loaded successfully, now check reattempt availability
        if (assessment?.id) {
          await checkReattemptAvailability(assessment.id);
        }
      }
    } finally {
      setLoadingAssessment(false);
    }
  };
  
  const handleStartAssessment = () => {
    startAssessment();
    navigate('/assessment');
  };
  
  if (loading || loadingAssessment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md text-center">
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to access the assessment.</p>
          <Button onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }
  
  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Enter Assessment Code</h1>
          
          <div className="mb-6">
            <AssessmentCodeInput 
              value={assessmentCode} 
              onChange={setAssessmentCode}
              onSubmit={handleLoadAssessment}
            />
          </div>
          
          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>{error}</span>
              </div>
            </div>
          )}
          
          <Button 
            className="w-full" 
            onClick={handleLoadAssessment}
            disabled={!assessmentCode || assessmentCode.length < 6}
          >
            Load Assessment
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-4xl p-6 bg-white rounded-lg shadow-md">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{assessment.name}</h1>
          <div className="flex items-center text-gray-500">
            <Clock className="h-4 w-4 mr-1" />
            <span>{assessment.duration_minutes} minutes</span>
            <span className="mx-2">•</span>
            <span>Starts: {formatDate(assessment.start_time)}</span>
          </div>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          {assessment.instructions ? (
            <div className="prose max-w-none">
              {assessment.instructions}
            </div>
          ) : (
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500 shrink-0" />
                <span>This assessment consists of multiple-choice and coding questions.</span>
              </li>
              <li className="flex items-start">
                <Clock className="h-5 w-5 mr-2 text-amber-500 shrink-0" />
                <span>You have {assessment.duration_minutes} minutes to complete this assessment.</span>
              </li>
              <li className="flex items-start">
                <PenTool className="h-5 w-5 mr-2 text-blue-500 shrink-0" />
                <span>Answer all questions to the best of your ability.</span>
              </li>
              <li className="flex items-start">
                <Code2 className="h-5 w-5 mr-2 text-purple-500 shrink-0" />
                <span>For coding questions, you can write and test your code before submission.</span>
              </li>
              <li className="flex items-start">
                <ShieldAlert className="h-5 w-5 mr-2 text-red-500 shrink-0" />
                <span>Exiting fullscreen mode or navigating away will be recorded and may result in termination.</span>
              </li>
            </ul>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-4 rounded-lg mb-6">
          <div>
            <h3 className="font-medium">Assessment Overview</h3>
            <div className="text-sm text-gray-500 mt-1">
              <div>MCQ Questions: {assessment.mcqCount}</div>
              <div>Coding Questions: {assessment.codingCount}</div>
              <div>Total Questions: {assessment.questions.length}</div>
            </div>
          </div>
          <Button 
            onClick={handleStartAssessment}
            className="mt-4 sm:mt-0"
          >
            Start Assessment
          </Button>
        </div>
        
        <div className="text-sm text-gray-500">
          <p>Note: Once you start the assessment, the timer will begin and you will need to remain in fullscreen mode.</p>
        </div>
      </div>
    </div>
  );
};

export default InstructionsPage;
