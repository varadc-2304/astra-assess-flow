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
import { useFullscreen } from '@/hooks/useFullscreen';
import { Timer } from '@/components/Timer';
import MCQQuestion from '@/components/MCQQuestion';
import CodeEditor from '@/components/code/CodeEditor';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, MenuIcon, CheckCircle, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const { enterFullscreen, isFullscreen, ExitDialog } = useFullscreen();
  const { toast } = useToast();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!assessment || !assessmentStarted) {
      navigate('/student');
    }
  }, [assessment, assessmentStarted, navigate]);

  useEffect(() => {
    if (assessmentStarted && !isFullscreen) {
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
    if (q.type === 'mcq') {
      return !!q.selectedOption;
    } else if (q.type === 'code') {
      return Object.values(q.userSolution).some(solution => solution && solution.trim() !== '');
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
        .eq('assessment_id', assessment.id)
        .eq('user_id', user?.id)
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
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 py-2 px-4 flex items-center justify-between sticky top-0 z-10">
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
        
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">
            <span>Score: </span>
            <span className="text-astra-red">{totalMarksObtained}/{totalPossibleMarks}</span>
          </div>
          <Timer variant="assessment" />
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto">
          {currentQuestion.type === 'mcq' ? (
            <div className="bg-white p-6 rounded-lg shadow">
              <MCQQuestion 
                question={currentQuestion} 
                onAnswerSelect={answerMCQ}
              />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-4 h-full">
              <div className="md:w-1/2 bg-white p-6 rounded-lg shadow overflow-y-auto max-h-[calc(100vh-180px)]">
                <h3 className="text-lg font-medium mb-3">{currentQuestion.title}</h3>
                <p className="text-gray-700 whitespace-pre-line mb-4">{currentQuestion.description}</p>
                
                {currentQuestion.examples.length > 0 && (
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
                
                {currentQuestion.constraints.length > 0 && (
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
              
              <div className="md:w-1/2 bg-white rounded-lg shadow flex flex-col overflow-hidden">
                <div className="p-4 flex-1 overflow-hidden">
                  <CodeEditor 
                    question={currentQuestion}
                    onCodeChange={(language, code) => updateCodeSolution(currentQuestion.id, language, code)}
                    onMarksUpdate={handleUpdateMarks}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white border-t border-gray-200 py-3 px-6 flex items-center justify-between sticky bottom-0 z-10">
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
      
      <ExitDialog />
    </div>
  );
};

export default AssessmentPage;
