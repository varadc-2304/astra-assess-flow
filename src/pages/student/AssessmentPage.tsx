import React, { useEffect, useState } from 'react';
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, MenuIcon, CheckCircle, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CodeQuestion, MCQQuestion as MCQQuestionType } from '@/contexts/AssessmentContext';

function isMCQQuestion(question: any): question is MCQQuestionType {
  return question.type === 'mcq';
}

function isCodeQuestion(question: any): question is CodeQuestion {
  return question.type === 'code';
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
            return;
          }
          
          const { data, error } = await supabase
            .from('submissions')
            .insert({
              assessment_id: assessment.id,
              user_id: user.id,
              started_at: new Date().toISOString(),
              fullscreen_violations: 0
            });
            
          if (error) {
            console.error('Error creating submission record:', error);
          }
        } catch (error) {
          console.error('Error creating submission record:', error);
        }
      }
    };
    
    createSubmissionRecord();
  }, [assessment, assessmentStarted, user]);
  
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
        const { error: updateError } = await supabase
          .from('submissions')
          .update({ 
            completed_at: new Date().toISOString()
          })
          .eq('id', submissions[0].id);
        
        if (updateError) {
          console.error('Error updating submission completion status:', updateError);
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
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className={`${isAntiCheatingWarningActive ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'} border-b py-2 px-4 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300`}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="mr-4">
              <MenuIcon className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Questions</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {assessment.questions.map((q, index) => (
                  <Button
                    key={q.id}
                    variant="outline"
                    size="sm"
                    className={`relative ${
                      currentQuestionIndex === index ? 'border-astra-red' : ''
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
                ))}
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Assessment Summary</p>
                <div className="flex items-center justify-between text-xs">
                  <span>Total Questions:</span>
                  <span>{assessment.questions.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Answered:</span>
                  <span>{questionStatus.filter(Boolean).length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Not Answered:</span>
                  <span>{questionStatus.filter(status => !status).length}</span>
                </div>
              </div>
              
              <Button 
                onClick={handleEndAssessment}
                className="w-full mt-4"
                variant="destructive"
              >
                End Assessment
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2">
          {isAntiCheatingWarningActive && (
            <div className="flex items-center mr-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-1" />
              <span className="text-sm font-medium text-red-700">
                {showExitWarning ? `Fullscreen Warning: ${fullscreenWarnings}/${MAX_WARNINGS}` : 
                 tabSwitchWarning ? `Tab Switch Warning: ${visibilityViolations}/${MAX_WARNINGS}` : ''}
              </span>
            </div>
          )}
          <Timer variant="assessment" />
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden p-0">
        {isMCQQuestion(currentQuestion) ? (
          <div className="max-w-6xl mx-auto p-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <MCQQuestion 
                question={currentQuestion} 
                onAnswerSelect={answerMCQ}
                isWarningActive={isAntiCheatingWarningActive}
              />
            </div>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={40} minSize={30} className="overflow-auto">
              <div className={`bg-white h-full overflow-y-auto p-6 ${isAntiCheatingWarningActive ? 'border-r border-red-300' : 'border-r border-gray-200'}`}>
                {isAntiCheatingWarningActive && (
                  <div className="mb-3 bg-red-50 p-2 rounded-md flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <p className="text-sm text-red-700">Anti-cheating warning active</p>
                  </div>
                )}

                <h3 className="text-lg font-medium mb-3">{currentQuestion.title}</h3>
                <p className="text-gray-700 whitespace-pre-line mb-4">{currentQuestion.description}</p>
                
                {isCodeQuestion(currentQuestion) && currentQuestion.examples.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-sm mb-2">Examples:</h4>
                    <div className="space-y-3">
                      {currentQuestion.examples.map((example, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-md">
                          <div className="mb-1">
                            <span className="font-medium text-xs">Input:</span>
                            <pre className="text-xs bg-gray-100 p-1 rounded mt-1">{example.input}</pre>
                          </div>
                          <div className="mb-1">
                            <span className="font-medium text-xs">Output:</span>
                            <pre className="text-xs bg-gray-100 p-1 rounded mt-1">{example.output}</pre>
                          </div>
                          {example.explanation && (
                            <div>
                              <span className="font-medium text-xs">Explanation:</span>
                              <p className="text-xs mt-1">{example.explanation}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {isCodeQuestion(currentQuestion) && currentQuestion.constraints.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Constraints:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700">
                      {currentQuestion.constraints.map((constraint, index) => (
                        <li key={index}>{constraint}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={60} minSize={40} className="bg-white">
              {isCodeQuestion(currentQuestion) && (
                <div className="h-full">
                  <CodeEditor 
                    question={currentQuestion}
                    onCodeChange={(language, code) => updateCodeSolution(currentQuestion.id, language, code)}
                    onMarksUpdate={handleUpdateMarks}
                  />
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
      
      <div className={`${isAntiCheatingWarningActive ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'} border-t py-3 px-6 flex items-center justify-between sticky bottom-0 z-10 transition-colors duration-300`}>
        <Button
          variant="outline"
          onClick={handlePrevQuestion}
          disabled={currentQuestionIndex === 0 || isNavigating || isEndingAssessment}
        >
          <ChevronLeft className="h-5 w-5 mr-1" /> Previous
        </Button>
        
        <div className="flex items-center gap-1">
          {assessment.questions.map((_, index) => (
            <div 
              key={index} 
              className={`h-2 w-2 rounded-full ${
                index === currentQuestionIndex ? 'bg-astra-red' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        
        <div className="flex gap-2">
          {currentQuestionIndex === assessment.questions.length - 1 ? (
            <Button
              className="bg-astra-red hover:bg-red-600 text-white"
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
            >
              Next <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
              End Assessment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end the assessment? This action cannot be undone, and all your answers will be submitted.
              {questionStatus.some(status => !status) && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
                  <HelpCircle className="h-4 w-4 inline mr-1" />
                  You have {questionStatus.filter(status => !status).length} unanswered question(s).
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEndingAssessment}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmEndAssessment} 
              className="bg-astra-red hover:bg-red-600 text-white"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
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
