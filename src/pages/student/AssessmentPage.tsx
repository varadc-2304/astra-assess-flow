import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useFullscreen, MAX_WARNINGS } from '@/hooks/useFullscreen';
import { Timer } from '@/components/Timer';
import MCQQuestion from '@/components/MCQQuestion';
import CodeEditor from '@/components/CodeEditor';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, MenuIcon, CheckCircle, HelpCircle, AlertTriangle, Loader2, CheckCircle2, AlertOctagon, Camera, GripVertical, Shield, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CodeQuestion, MCQQuestion as MCQQuestionType } from '@/contexts/AssessmentContext';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import ProctoringCamera from '@/components/ProctoringCamera';
import { cn } from '@/lib/utils';
import { useProctoringWarnings } from '@/hooks/useProctoringWarnings';
import { useAssessmentRecording } from '@/hooks/useAssessmentRecording';

function isMCQQuestion(question: any): question is MCQQuestionType {
  return question.type === 'mcq';
}

function isCodeQuestion(question: any): question is CodeQuestion {
  return question.type === 'code';
}

interface TestCaseStatus {
  [questionId: string]: { 
    totalTests: number;
    passedTests: number;
  }  
}

const AssessmentPage = () => {
  const { 
    assessment, 
    assessmentStarted,
    currentQuestionIndex, 
    setCurrentQuestionIndex,
    answerMCQ,
    updateCodeSolution,
    updateMarksObtained,
    endAssessment,
    totalMarksObtained,
    totalPossibleMarks
  } = useAssessment();

  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isEndingAssessment, setIsEndingAssessment] = useState(false);
  const [testCaseStatus, setTestCaseStatus] = useState<TestCaseStatus>({});
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [assessmentStartTime] = useState(Date.now()); // Track when assessment started
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [initialSubmissionId, setInitialSubmissionId] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { 
    enterFullscreen, 
    isFullscreen, 
    showExitWarning, 
    tabSwitchWarning,
    fullscreenWarnings,
    visibilityViolations,
    terminateAssessment
  } = useFullscreen();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Check if AI proctoring is enabled
  const isAiProctoringEnabled = assessment?.isAiProctored === true;
  
  // Initialize recording hook
  const { isRecording, isUploading, recordingUrl, startRecording, stopRecording, uploadRecording } = useAssessmentRecording({
    assessmentId: assessment?.id || '',
    submissionId: submissionId || undefined,
    userId: user?.id
  });
  
  useEffect(() => {
    if (!assessment || !assessmentStarted) {
      navigate('/student');
    }
  }, [assessment, assessmentStarted, navigate]);

  useEffect(() => {
    if (assessmentStarted && !isFullscreen) {
      console.log("Assessment started but not in fullscreen - entering fullscreen");
      enterFullscreen();
    }
  }, [assessmentStarted, isFullscreen, enterFullscreen]);

  useEffect(() => {
    const createSubmissionRecord = async () => {
      if (assessment && assessmentStarted && user) {
        try {
          const { data: existingSubmissions } = await supabase
            .from('submissions')
            .select('*')
            .eq('assessment_id', assessment.id)
            .eq('user_id', user.id)
            .is('completed_at', null);
            
          if (existingSubmissions && existingSubmissions.length > 0) {
            setSubmissionId(existingSubmissions[0].id);
            setInitialSubmissionId(existingSubmissions[0].id);
            return;
          }
          
          const { data, error } = await supabase
            .from('submissions')
            .insert({
              assessment_id: assessment.id,
              user_id: user.id,
              started_at: new Date().toISOString(),
              fullscreen_violations: 0
            })
            .select()
            .single();
            
          if (error) {
            console.error('Error creating submission record:', error);
          } else if (data) {
            setSubmissionId(data.id);
            setInitialSubmissionId(data.id);
          }
        } catch (error) {
          console.error('Error creating submission record:', error);
        }
      }
    };
    
    createSubmissionRecord();
  }, [assessment, assessmentStarted, user]);

  // Start recording when assessment begins with AI proctoring
  useEffect(() => {
    if (isAiProctoringEnabled && assessmentStarted && submissionId && user?.id && !isRecording) {
      console.log('Starting recording for AI-proctored assessment');
      startRecording();
    }
  }, [isAiProctoringEnabled, assessmentStarted, submissionId, user?.id, isRecording, startRecording]);

  const handleTestResultUpdate = (questionId: string, passedTests: number, totalTests: number) => {
    setTestCaseStatus(prev => ({
      ...prev,
      [questionId]: {
        totalTests,
        passedTests
      }
    }));
  };
  
  if (!assessment) {
    return null;
  }
  
  const currentQuestion = assessment.questions[currentQuestionIndex];
  
  const questionStatus = assessment.questions.map(q => {
    if (isMCQQuestion(q)) {
      return !!q.selectedOption;
    } else if (isCodeQuestion(q)) {
      return Object.values(q.userSolution).some(solution => solution && typeof solution === 'string' && solution.trim() !== '');
    }
    return false;
  });

  const getQuestionSubmissionStatus = (question: any) => {
    if (!isCodeQuestion(question)) return null;
    
    const status = testCaseStatus[question.id];
    if (!status) return 'Not Submitted';
    
    if (status.passedTests === status.totalTests && status.totalTests > 0) {
      return 'All Tests Passed';
    } else if (status.passedTests > 0) {
      return 'Partially Submitted';
    } else {
      return 'No Tests Passed';
    }
  };

  const getStatusBadgeColor = (status: string | null) => {
    if (!status) return 'status-not-submitted';
    
    switch (status) {
      case 'All Tests Passed':
        return 'status-submitted';
      case 'Partially Submitted':
        return 'status-partial';
      default:
        return 'status-not-submitted';
    }
  };

  const getStatusIcon = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case 'All Tests Passed':
        return <CheckCircle2 className="h-3 w-3 mr-1" />;
      case 'Partially Submitted':
        return <AlertOctagon className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };
  
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };
  
  const handleNextQuestion = () => {
    if (currentQuestionIndex < assessment.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };
  
  const handleEndAssessment = () => {
    setShowExitDialog(true);
  };
  
  const confirmEndAssessment = async () => {
    setIsEndingAssessment(true);
    
    try {
      let finalRecordingUrl = recordingUrl;

      // Stop recording if it's active and wait for upload
      if (isRecording) {
        console.log('Stopping recording before ending assessment');
        stopRecording();
        
        // Wait longer for the recording to finish uploading
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to upload any remaining recording data if no URL exists yet
        if (!recordingUrl) {
          console.log('Attempting to upload remaining recording data');
          finalRecordingUrl = await uploadRecording();
        }
      }

      // Get the initial submission data to copy violations and recording URL
      let initialSubmissionData = null;
      if (initialSubmissionId) {
        const { data: initialSubmission, error: fetchError } = await supabase
          .from('submissions')
          .select('face_violations, object_violations, recording_url')
          .eq('id', initialSubmissionId)
          .single();
        
        if (!fetchError && initialSubmission) {
          initialSubmissionData = initialSubmission;
          console.log('Retrieved initial submission data:', initialSubmissionData);
          
          // Use the recording URL from initial submission if we don't have a final one
          if (!finalRecordingUrl && initialSubmission.recording_url) {
            finalRecordingUrl = initialSubmission.recording_url;
            console.log('Using recording URL from initial submission:', finalRecordingUrl);
          }
        }
      }

      // Find or create final submission record
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment?.id || '')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (submissionError || !submissions || submissions.length === 0) {
        console.error('Error finding submission to update:', submissionError);
      } else {
        // Prepare update data
        const updateData: any = { 
          completed_at: new Date().toISOString()
        };

        // Copy violations and recording URL from initial submission if available
        if (initialSubmissionData) {
          if (initialSubmissionData.face_violations) {
            updateData.face_violations = initialSubmissionData.face_violations;
            console.log('Copying face violations:', initialSubmissionData.face_violations);
          }
          if (initialSubmissionData.object_violations) {
            updateData.object_violations = initialSubmissionData.object_violations;
            console.log('Copying object violations:', initialSubmissionData.object_violations);
          }
        }

        // Set recording URL (prefer finalRecordingUrl, then initial submission URL)
        if (finalRecordingUrl) {
          updateData.recording_url = finalRecordingUrl;
          console.log('Setting final recording URL:', finalRecordingUrl);
        }

        const { error: updateError } = await supabase
          .from('submissions')
          .update(updateData)
          .eq('id', submissions[0].id);
        
        if (updateError) {
          console.error('Error updating submission completion status:', updateError);
        } else {
          console.log('Successfully updated final submission with all data:', updateData);
        }
      }
      
      await endAssessment();
      
      const { error: resultError } = await supabase
        .from('results')
        .update({ 
          contest_name: assessment?.name 
        } as any)
        .eq('assessment_id', assessment?.id || '')
        .eq('user_id', user?.id || '');
      
      if (resultError) {
        console.error('Error updating contest name in results:', resultError);
      }
      
      toast({
        title: "Assessment Submitted",
        description: "Your answers have been submitted successfully!",
      });
      
      navigate('/summary');
    } catch (error) {
      console.error('Error ending assessment:', error);
      toast({
        title: "Error",
        description: "There was an error submitting your assessment. Please try again.",
        variant: "destructive",
      });
      setIsEndingAssessment(false);
    }
  };
  
  const handleUpdateMarks = (questionId: string, marks: number) => {
    updateMarksObtained(questionId, marks);
  };

  // Anti-cheating warning is active when either fullscreen or tab warnings are shown
  const isAntiCheatingWarningActive = showExitWarning || tabSwitchWarning;
  
  const { warning: proctoringWarning, showWarning: showProctoringWarning, dismissWarning: dismissProctoringWarning } = useProctoringWarnings();
  
  // Helper function to format assessment time
  const formatAssessmentTime = (timestamp: number) => {
    const elapsedMs = timestamp - assessmentStartTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hidden proctoring camera that runs continuously when AI proctoring is enabled */}
      {isAiProctoringEnabled && (
        <div className="hidden">
          <ProctoringCamera 
            showControls={false}
            showStatus={false}
            showWarnings={false}
            trackViolations={true}
            assessmentId={assessment.id}
            submissionId={submissionId || undefined}
            size="small"
            onWarning={showProctoringWarning}
          />
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="fixed top-2 right-2 z-50">
          <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>Recording</span>
          </div>
        </div>
      )}

      {/* Upload indicator */}
      {isUploading && (
        <div className="fixed top-2 right-2 z-50">
          <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </div>
        </div>
      )}

      <header className={`${isAntiCheatingWarningActive ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} border-b py-2 px-4 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300`}>
        <Sheet open={isSidePanelOpen} onOpenChange={setIsSidePanelOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="mr-4 hover:bg-gray-100 dark:hover:bg-gray-700">
              <MenuIcon className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-primary flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                Questions
              </SheetTitle>
            </SheetHeader>
            
            {/* AI Proctoring Camera Section in Side Panel */}
            {isAiProctoringEnabled && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Proctoring</span>
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                  <ProctoringCamera 
                    showControls={false}
                    showStatus={true}
                    showWarnings={false}
                    trackViolations={false}
                    assessmentId={assessment.id}
                    submissionId={submissionId || undefined}
                    size="default"
                  />
                </div>
              </div>
            )}

            <div className="py-4 space-y-6">
              <div className="grid grid-cols-5 gap-2">
                {assessment.questions.map((q, index) => {
                  const status = isCodeQuestion(q) ? getQuestionSubmissionStatus(q) : null;
                  return (
                    <Button
                      key={q.id}
                      variant="outline"
                      size="sm"
                      className={`relative hover:shadow-md transition-shadow ${
                        currentQuestionIndex === index ? 'border-primary bg-primary-50 dark:bg-primary-950/20' : ''
                      }`}
                      onClick={() => setCurrentQuestionIndex(index)}
                    >
                      {index + 1}
                      {questionStatus[index] && (
                        <span className="absolute -top-1 -right-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
              
              <div className="space-y-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Assessment Summary</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs bg-white dark:bg-gray-700 p-2 rounded-md">
                    <span className="text-gray-600 dark:text-gray-300">Total Questions:</span>
                    <span className="font-medium">{assessment.questions.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-white dark:bg-gray-700 p-2 rounded-md">
                    <span className="text-gray-600 dark:text-gray-300">Answered:</span>
                    <span className="font-medium">{questionStatus.filter(Boolean).length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-white dark:bg-gray-700 p-2 rounded-md">
                    <span className="text-gray-600 dark:text-gray-300">Not Answered:</span>
                    <span className="font-medium">{questionStatus.filter(status => !status).length}</span>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handleEndAssessment}
                className="w-full mt-4 bg-primary hover:bg-primary-600"
                variant="destructive"
              >
                End Assessment
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2">
          {isAntiCheatingWarningActive && (
            <div className="flex items-center mr-3 animate-pulse">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-1" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {showExitWarning ? `Fullscreen Warning: ${fullscreenWarnings}/${MAX_WARNINGS}` : 
                 tabSwitchWarning ? `Tab Switch Warning: ${visibilityViolations}/${MAX_WARNINGS}` : ''}
              </span>
            </div>
          )}
          <Timer variant="assessment" />
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto h-full">
          {isMCQQuestion(currentQuestion) ? (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-card animate-fade-in">
              <MCQQuestion 
                question={currentQuestion} 
                onAnswerSelect={answerMCQ}
                isWarningActive={isAntiCheatingWarningActive}
              />
            </div>
          ) : (
            <div className="h-[calc(100vh-180px)] animate-fade-in">
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={40} minSize={30} className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm ${isAntiCheatingWarningActive ? 'border border-red-300 dark:border-red-800' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">{currentQuestion.title}</h3>
                    
                    {isCodeQuestion(currentQuestion) && (
                      <div className={`${getStatusBadgeColor(getQuestionSubmissionStatus(currentQuestion))} flex items-center gap-1 px-2 py-1 text-xs rounded-full`}>
                        {getStatusIcon(getQuestionSubmissionStatus(currentQuestion))}
                        <span>{getQuestionSubmissionStatus(currentQuestion)}</span>
                      </div>
                    )}
                  </div>

                  {isAntiCheatingWarningActive && (
                    <div className="mb-3 bg-red-50 dark:bg-red-900/20 p-2 rounded-md flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <p className="text-sm text-red-700 dark:text-red-400">Anti-cheating warning active</p>
                    </div>
                  )}
                  
                  <ScrollArea className="h-[calc(100vh-280px)] pr-3">
                    <div className="prose dark:prose-invert max-w-none mb-4">
                      <p className="text-gray-700 dark:text-gray-200 whitespace-pre-line">{currentQuestion.description}</p>
                    </div>
                    
                    {isCodeQuestion(currentQuestion) && currentQuestion.examples.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">Examples:</h4>
                        <div className="space-y-3">
                          {currentQuestion.examples.map((example, index) => (
                            <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                              <div className="mb-1">
                                <span className="font-medium text-xs text-gray-700 dark:text-gray-300">Input:</span>
                                <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-x-auto">{example.input}</pre>
                              </div>
                              <div className="mb-1">
                                <span className="font-medium text-xs text-gray-700 dark:text-gray-300">Output:</span>
                                <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-x-auto">{example.output}</pre>
                              </div>
                              {example.explanation && (
                                <div>
                                  <span className="font-medium text-xs text-gray-700 dark:text-gray-300">Explanation:</span>
                                  <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">{example.explanation}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {isCodeQuestion(currentQuestion) && currentQuestion.constraints.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                        <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">Constraints:</h4>
                        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                          {currentQuestion.constraints.map((constraint, index) => (
                            <li key={index}>{constraint}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </ScrollArea>
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-gray-200 dark:bg-gray-700" />

                <ResizablePanel defaultSize={60} minSize={40} className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden ${isAntiCheatingWarningActive ? 'border border-red-300 dark:border-red-800' : ''}`}>
                  {isCodeQuestion(currentQuestion) && (
                    <CodeEditor 
                      question={currentQuestion}
                      onCodeChange={(language, code) => updateCodeSolution(currentQuestion.id, language, code)}
                      onMarksUpdate={handleUpdateMarks}
                      onTestResultsUpdate={(passed, total) => handleTestResultUpdate(currentQuestion.id, passed, total)}
                    />
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          )}
        </div>
      </div>
      
      <div className={`${isAntiCheatingWarningActive ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} border-t py-3 px-6 flex items-center justify-between sticky bottom-0 z-10 transition-colors duration-300`}>
        <Button
          variant="outline"
          onClick={handlePrevQuestion}
          disabled={currentQuestionIndex === 0 || isNavigating || isEndingAssessment}
          className="nav-button shadow-sm hover:shadow-md"
        >
          <ChevronLeft className="h-5 w-5 mr-1" /> Previous
        </Button>
        
        <div className="flex items-center gap-2">
          {assessment.questions.map((_, index) => (
            <div 
              key={index} 
              className={`h-2 w-2 rounded-full transition-all duration-200 ${
                index === currentQuestionIndex 
                  ? 'bg-primary scale-110'
                  : questionStatus[index]
                  ? 'bg-green-400 dark:bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
        
        <div className="flex gap-2">
          {currentQuestionIndex === assessment.questions.length - 1 ? (
            <Button
              className="bg-primary hover:bg-red-600 text-white nav-button shadow-sm hover:shadow-md"
              onClick={handleEndAssessment}
              disabled={isNavigating || isEndingAssessment}
            >
              {isEndingAssessment ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <>End Assessment</>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleNextQuestion}
              disabled={isNavigating || isEndingAssessment}
              className="nav-button shadow-sm hover:shadow-md"
            >
              Next <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-primary">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
              End Assessment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end the assessment? This action cannot be undone, and all your answers will be submitted.
              {questionStatus.some(status => !status) && (
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-amber-700 dark:text-amber-400 text-sm">
                  <HelpCircle className="h-4 w-4 inline mr-1" />
                  You have {questionStatus.filter(status => !status).length} unanswered question(s).
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEndingAssessment} className="dark:bg-gray-700 dark:hover:bg-gray-600">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmEndAssessment} 
              className="bg-primary hover:bg-red-600 text-white"
              disabled={isEndingAssessment}
            >
              {isEndingAssessment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Submitting...
                </>
              ) : (
                "End Assessment"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showExitWarning || tabSwitchWarning}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
              {showExitWarning ? 'Fullscreen Mode Required' : 'Assessment Tab Focus Required'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                {showExitWarning 
                  ? `You have exited fullscreen mode. This is violation ${fullscreenWarnings}/${MAX_WARNINGS}.
                     Please return to fullscreen immediately or your test will be terminated.`
                  : `You switched away from the assessment tab. This is violation ${visibilityViolations}/${MAX_WARNINGS}.
                     Please stay on this tab or your test will be terminated.`
                }
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={showExitWarning ? enterFullscreen : undefined}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {showExitWarning ? 'Return to Fullscreen' : 'Continue Assessment'}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={terminateAssessment}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              End Assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enhanced Proctoring Warning Dialog */}
      <AlertDialog open={!!proctoringWarning}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700 max-w-md mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-red-600 dark:text-red-400">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 mr-3">
                <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <div className="text-lg font-semibold">AI Proctoring Alert</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                  Violation Detected
                </div>
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                      {proctoringWarning?.message}
                    </p>
                    <div className="flex items-center justify-between text-xs text-red-600 dark:text-red-400">
                      <span className="flex items-center space-x-1">
                        <span>Assessment Time:</span>
                        <span className="font-mono font-semibold">
                          {proctoringWarning && formatAssessmentTime(proctoringWarning.timestamp)}
                        </span>
                      </span>
                      <span className="text-red-500 dark:text-red-400">
                        {new Date(proctoringWarning?.timestamp || 0).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    This violation has been recorded. Repeated violations may result in assessment termination.
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:space-x-2">
            <AlertDialogAction
              onClick={dismissProctoringWarning}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-500/25 transition-all duration-200"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Continue Assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssessmentPage;
