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
import { ChevronLeft, ChevronRight, MenuIcon, CheckCircle, HelpCircle, AlertTriangle, Loader2, CheckCircle2, AlertOctagon, GripVertical, Camera } from 'lucide-react';
import { CodeQuestion, MCQQuestion as MCQQuestionType } from '@/contexts/AssessmentContext';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import ProctoringCamera from '@/components/ProctoringCamera';
import { cn } from '@/lib/utils';

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
    totalPossibleMarks,
    submissionId,
    updateSubmissionViolations
  } = useAssessment();

  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isEndingAssessment, setIsEndingAssessment] = useState(false);
  const [testCaseStatus, setTestCaseStatus] = useState<TestCaseStatus>({});
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
  
  // Camera states - only used when AI proctoring is enabled
  const [cameraPosition, setCameraPosition] = useState('bottom-right');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const cameraRef = useRef<HTMLDivElement>(null);
  
  // Check if AI proctoring is enabled
  const isAiProctoringEnabled = assessment?.isAiProctored === true;
  
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

  // Update submission violations when fullscreen or tab violations occur
  useEffect(() => {
    if (submissionId && (fullscreenWarnings > 0 || visibilityViolations > 0)) {
      updateSubmissionViolations('fullscreen', fullscreenWarnings + visibilityViolations);
    }
  }, [submissionId, fullscreenWarnings, visibilityViolations, updateSubmissionViolations]);

  // Camera drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isAiProctoringEnabled) return;
    
    if (cameraRef.current) {
      setIsDragging(true);
      setIsAnimating(true);
      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY
      };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isAiProctoringEnabled || !isDragging) return;
    
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const x = e.clientX;
    const y = e.clientY;
    
    // Determine which corner is closest
    if (y < windowHeight / 2) {
      // Top half
      if (x < windowWidth / 2) {
        setCameraPosition('top-left');
      } else {
        setCameraPosition('top-right');
      }
    } else {
      // Bottom half
      if (x < windowWidth / 2) {
        setCameraPosition('bottom-left');
      } else {
        setCameraPosition('bottom-right');
      }
    }
  };

  const handleMouseUp = () => {
    if (!isAiProctoringEnabled) return;
    
    setIsDragging(false);
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isAiProctoringEnabled) return;
    
    if (cameraRef.current && e.touches.length === 1) {
      setIsDragging(true);
      setIsAnimating(true);
      const touch = e.touches[0];
      dragStartPos.current = {
        x: touch.clientX,
        y: touch.clientY
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAiProctoringEnabled || !isDragging || !e.touches[0]) return;
    
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    
    // Determine which corner is closest
    if (y < windowHeight / 2) {
      // Top half
      if (x < windowWidth / 2) {
        setCameraPosition('top-left');
      } else {
        setCameraPosition('top-right');
      }
    } else {
      // Bottom half
      if (x < windowWidth / 2) {
        setCameraPosition('bottom-left');
      } else {
        setCameraPosition('bottom-right');
      }
    }
    
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    if (!isAiProctoringEnabled) return;
    
    setIsDragging(false);
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  };

  // Only add event listeners if AI proctoring is enabled
  useEffect(() => {
    if (!isAiProctoringEnabled) return;
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove as unknown as EventListener);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove as unknown as EventListener, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove as unknown as EventListener);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove as unknown as EventListener);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, isAiProctoringEnabled]);

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
      await endAssessment();
      
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
  
  // Function to get camera position styles based on current position
  const getCameraPositionStyles = () => {
    switch (cameraPosition) {
      case 'top-left':
        return { top: '1rem', left: '1rem', bottom: 'auto', right: 'auto' };
      case 'top-right':
        return { top: '1rem', right: '1rem', bottom: 'auto', left: 'auto' };
      case 'bottom-left':
        return { bottom: '4rem', left: '1rem', top: 'auto', right: 'auto' };
      case 'bottom-right':
      default:
        return { bottom: '4rem', right: '1rem', top: 'auto', left: 'auto' };
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <header className={`${isAntiCheatingWarningActive ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} border-b py-2 px-4 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300`}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="mr-4 hover:bg-gray-100 dark:hover:bg-gray-700">
              <MenuIcon className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-primary flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                Questions
              </SheetTitle>
            </SheetHeader>
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
        
        {/* Conditionally render draggable proctoring camera overlay only if AI proctoring is enabled */}
        {isAiProctoringEnabled && (
          <div 
            ref={cameraRef}
            className={cn(
              "fixed z-20 transition-all duration-300 ease-in-out",
              isDragging ? "cursor-grabbing scale-105" : "cursor-grab hover:scale-102",
              isAnimating ? "animate-pulse" : ""
            )}
            style={{
              ...getCameraPositionStyles(),
              transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))'
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <Card className={cn(
              "w-[180px] overflow-hidden rounded-lg border-0",
              "bg-black/10 backdrop-blur-sm",
              "transform transition-transform duration-200",
              isDragging ? "scale-105" : "",
              isAnimating ? "ring-2 ring-primary ring-opacity-70" : ""
            )}>
              <div 
                className={cn(
                  "flex items-center justify-between px-3 py-1",
                  "bg-gradient-to-r from-gray-900/80 to-gray-800/80",
                  "border-b border-white/10",
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                <div className="flex items-center space-x-1">
                  <Camera className="h-3 w-3 text-white opacity-80" />
                  <span className="text-xs font-medium text-white opacity-90">Proctoring</span>
                </div>
                <div className="flex items-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse mr-1"></div>
                  <GripVertical className="h-3 w-3 text-white opacity-70" />
                </div>
              </div>
              <ProctoringCamera 
                showControls={false}
                showStatus={false}
                trackViolations={true}
                assessmentId={assessment.id}
                submissionId={submissionId || undefined}
                size="small"
              />
              <div className={cn(
                "text-[9px] text-center py-0.5 text-white/70 opacity-0",
                "bg-gradient-to-r from-gray-900/80 to-gray-800/80",
                "border-t border-white/10",
                "transition-opacity duration-200",
                isDragging ? "opacity-100" : "group-hover:opacity-100"
              )}>
                Drag to reposition
              </div>
            </Card>
          </div>
        )}
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
    </div>
  );
};

export default AssessmentPage;
