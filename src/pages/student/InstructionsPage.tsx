
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ArrowRight, AlertTriangle, ShieldCheck, Camera, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const InstructionsPage = () => {
  const { 
    assessment, 
    loading: assessmentLoading, 
    error: assessmentError, 
    loadAssessment 
  } = useAssessment();
  const [enableProctoring, setEnableProctoring] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isMobile } = useIsMobile();

  useEffect(() => {
    // Get assessment code from localStorage
    const code = localStorage.getItem('assessmentCode');
    if (code) {
      console.log("Found assessment code in localStorage:", code);
      // Call loadAssessment and handle any issues
      loadAssessment(code).then(success => {
        if (!success) {
          console.error("Failed to load assessment with code:", code);
          toast({
            title: "Error",
            description: "Could not load assessment. Please check the code and try again.",
            variant: "destructive"
          });
        }
      }).catch(err => {
        console.error("Error loading assessment:", err);
      });
    } else {
      console.error("No assessment code found in localStorage");
      navigate('/student');
    }
  }, [loadAssessment, navigate, toast]);

  const handleStartAssessment = () => {
    console.log("Start assessment clicked, enableProctoring:", enableProctoring);
    if (enableProctoring) {
      // Navigate to proctoring setup page
      navigate('/proctoring-setup');
    } else {
      // Skip proctoring and start the assessment directly
      navigate('/assessment');
    }
  };
  
  if (assessmentLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (assessmentError || !assessment) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Assessment</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {assessmentError || "The assessment could not be found. Please check the assessment code."}
          </p>
          <Button onClick={() => navigate('/student')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const TestInstructions = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Instructions</h2>
      <div className="space-y-4 text-gray-600 dark:text-gray-300">
        <p>Please read the following instructions carefully before starting the assessment:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>The assessment contains multiple choice questions and coding problems.</li>
          <li>Total duration: <span className="font-medium text-gray-900 dark:text-gray-100">{assessment.durationMinutes} minutes</span></li>
          <li>You can navigate between questions using the Next and Previous buttons.</li>
          <li>Your progress will be automatically saved as you go.</li>
          <li>Once you submit the assessment, you cannot retake it.</li>
          <li className="text-red-600 dark:text-red-400">Do not refresh the page or close the browser during the assessment.</li>
          {enableProctoring && (
            <li className="font-semibold flex items-center">
              <ShieldCheck className="mr-2 h-4 w-4 text-green-500" />
              This assessment is proctored using AI monitoring
            </li>
          )}
        </ul>
      </div>
    </div>
  );

  const ProctoringSetting = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
          <Camera className="mr-2 h-5 w-5" />
          AI Proctoring
        </h2>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="proctoring-toggle"
            checked={enableProctoring}
            onChange={(e) => setEnableProctoring(e.target.checked)}
            className="sr-only"
          />
          <label
            htmlFor="proctoring-toggle"
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
              enableProctoring ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                enableProctoring ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </label>
        </div>
      </div>
      {enableProctoring ? (
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <p className="font-medium text-gray-900 dark:text-gray-100">AI Proctoring Enabled</p>
              <p className="text-sm">This assessment will be monitored using AI to ensure academic integrity.</p>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-100 dark:border-blue-800">
            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-1">What to expect:</h3>
            <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-200 space-y-1">
              <li>You will need to grant camera access</li>
              <li>The system will verify your environment</li>
              <li>Your assessment will be recorded</li>
              <li>AI will monitor for unusual activities</li>
            </ul>
          </div>
          
          {isMobile && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-md border border-amber-200 dark:border-amber-800 flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="font-medium text-amber-800 dark:text-amber-300">Mobile Devices Not Supported</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Proctoring is not available on mobile devices. Please use a desktop or laptop computer.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-md border border-amber-200 dark:border-amber-800">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="ml-2 font-medium text-amber-800 dark:text-amber-300">Proctoring Disabled</p>
          </div>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            Note: Disabling proctoring may affect the validity of your assessment results. 
            Some institutions may require proctoring for certification purposes.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{assessment.name}</h1>
        <div className="text-gray-600 dark:text-gray-400 flex items-center justify-center space-x-4">
          <span>Duration: {assessment.durationMinutes} minutes</span>
          <span>•</span>
          <span>Questions: {assessment.questions?.length || 0}</span>
        </div>
      </div>
      
      <TestInstructions />
      <ProctoringSetting />
      
      <div className="flex justify-end">
        <Button
          onClick={handleStartAssessment}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium px-6 py-2 rounded-md shadow-sm hover:shadow transition-all"
          disabled={isMobile && enableProctoring}
        >
          {enableProctoring ? 'Continue to Proctoring Setup' : 'Start Assessment'} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default InstructionsPage;
