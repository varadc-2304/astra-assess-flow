
import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Clock } from 'lucide-react';

import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFullscreen } from '@/hooks/useFullscreen';

import MCQQuestion from '@/components/MCQQuestion';
import { Timer } from '@/components/Timer';
import CodeEditor from '@/components/CodeEditor';
import { supabase } from '@/integrations/supabase/client'; 

const AssessmentPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    assessment,
    currentQuestionIndex, 
    setCurrentQuestionIndex,
    endAssessment,
    assessmentStarted,
    timeRemaining,
    setTimeRemaining,
    answerMCQ,
    updateCodeSolution,
    totalMarksObtained,
    totalPossibleMarks,
    updateMarksObtained
  } = useAssessment();
  
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isFullscreen, enterFullscreen, exitFullscreen, addFullscreenWarning, fullscreenWarnings } = useFullscreen();

  useEffect(() => {
    // Redirect if assessment is not started
    if (!assessmentStarted && assessment) {
      navigate('/instructions');
    }
    
    // Enter fullscreen when component mounts
    if (assessment && !isFullscreen) {
      enterFullscreen();
    }
    
    // Clean up
    return () => {
      if (isFullscreen) {
        exitFullscreen();
      }
    };
  }, [assessment, assessmentStarted, navigate, isFullscreen, enterFullscreen, exitFullscreen]);
  
  // Handle fullscreen violation
  useEffect(() => {
    if (assessment && assessmentStarted && !isFullscreen) {
      addFullscreenWarning();
      
      toast({
        title: "Warning: Fullscreen Mode Exited",
        description: `You have left fullscreen mode. This will be recorded. (Violation ${fullscreenWarnings + 1})`,
        variant: "destructive",
      });
      
      // Re-enter fullscreen after warning
      setTimeout(() => {
        enterFullscreen();
      }, 2000);
      
      // Record fullscreen violation
      if (user && assessment) {
        const recordViolation = async () => {
          const { data: submissions, error: fetchError } = await supabase
            .from('submissions')
            .select('id, fullscreen_violations')
            .eq('assessment_id', assessment.id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (fetchError) {
            console.error('Error fetching submission record:', fetchError);
            return;
          }
          
          if (submissions && submissions.length > 0) {
            const submission = submissions[0];
            const updatedViolations = (submission.fullscreen_violations || 0) + 1;
            
            const { error: updateError } = await supabase
              .from('submissions')
              .update({ 
                fullscreen_violations: updatedViolations,
                is_terminated: updatedViolations >= 3
              })
              .eq('id', submission.id);
            
            if (updateError) {
              console.error('Error updating fullscreen violations:', updateError);
            }
            
            if (updatedViolations >= 3) {
              toast({
                title: "Assessment Terminated",
                description: "You have exceeded the maximum number of fullscreen violations. Your assessment will be terminated.",
                variant: "destructive",
              });
              
              setTimeout(() => {
                endAssessment();
                navigate('/student');
              }, 3000);
            }
          }
        };
        
        recordViolation();
      }
    }
  }, [isFullscreen, assessment, assessmentStarted, user, fullscreenWarnings, toast, navigate, endAssessment, enterFullscreen, addFullscreenWarning]);
  
  // Set up timer completion handler
  const handleTimeUp = () => {
    toast({
      title: "Time's Up!",
      description: "Your time has ended. Your assessment will be submitted automatically.",
      variant: "destructive"
    });
    
    handleSubmitAssessment();
  };

  const handleSubmitAssessment = async () => {
    if (!user || !assessment) return;
    
    setIsSubmitting(true);
    
    try {
      // Get the current submission
      const { data: submissions, error: fetchError } = await supabase
        .from('submissions')
        .select('id')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError) {
        throw new Error(`Error fetching submission: ${fetchError.message}`);
      }
      
      if (!submissions || submissions.length === 0) {
        throw new Error('No active submission found');
      }
      
      const submissionId = submissions[0].id;
      
      // Update the submission as completed
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ completed_at: now })
        .eq('id', submissionId);
      
      if (updateError) {
        throw new Error(`Error updating submission: ${updateError.message}`);
      }
      
      // Create result record
      const percentage = totalPossibleMarks > 0 
        ? Math.round((totalMarksObtained / totalPossibleMarks) * 100)
        : 0;
      
      const { error: resultError } = await supabase
        .from('results')
        .insert({
          assessment_id: assessment.id,
          user_id: user.id,
          submission_id: submissionId,
          completed_at: now,
          total_marks: totalPossibleMarks,
          total_score: totalMarksObtained,
          percentage,
          is_cheated: fullscreenWarnings >= 3
        });
      
      if (resultError) {
        throw new Error(`Error creating result: ${resultError.message}`);
      }
      
      await endAssessment();
      
      // Navigate to summary page
      navigate('/summary');
    } catch (error) {
      console.error('Error submitting assessment:', error);
      toast({
        title: "Error",
        description: `Failed to submit assessment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!assessment || !assessmentStarted) {
    return <Navigate to="/instructions" />;
  }
  
  const currentQuestion = assessment.questions[currentQuestionIndex];
  const isMCQ = currentQuestion.type === 'mcq';
  const isPreviousEnabled = currentQuestionIndex > 0;
  const isNextEnabled = currentQuestionIndex < assessment.questions.length - 1;
  
  // Create pagination items
  const paginationItems = [];
  for (let i = 0; i < assessment.questions.length; i++) {
    const question = assessment.questions[i];
    // Check if the question is answered based on its type
    const isAnswered = question.type === 'mcq' ? 
      !!question.selectedOption : 
      !!(question.type === 'code' && Object.keys(question.userSolution || {}).length > 0);
    
    paginationItems.push(
      <PaginationItem key={i}>
        <PaginationLink 
          onClick={() => setCurrentQuestionIndex(i)}
          isActive={i === currentQuestionIndex}
          className={`w-10 h-10 rounded-full flex items-center justify-center
            ${isAnswered ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}
          `}
        >
          {i + 1}
        </PaginationLink>
      </PaginationItem>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white p-4 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">{assessment.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1 text-red-500" />
            <Timer 
              variant="assessment"
            />
          </div>
          <Button 
            onClick={handleSubmitAssessment} 
            disabled={isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 container mx-auto py-6 px-4 flex flex-col">
        <Card className="flex-1 mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">
                Question {currentQuestionIndex + 1} {isMCQ ? '(MCQ)' : '(Coding)'}
              </h2>
              <div className="text-sm text-gray-500">
                {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? 's' : ''}
              </div>
            </div>
            
            {isMCQ ? (
              <MCQQuestion 
                question={currentQuestion} 
                onAnswerSelect={(optionId) => answerMCQ(currentQuestion.id, optionId)}
              />
            ) : (
              <Tabs defaultValue="question" className="flex-1 flex flex-col">
                <TabsList className="mb-6">
                  <TabsTrigger value="question">Question</TabsTrigger>
                  <TabsTrigger value="solution">Solution</TabsTrigger>
                </TabsList>
                <div className="flex-1 flex">
                  <TabsContent value="question" className="flex-1 m-0">
                    <div className="prose max-w-none">
                      <h3>{currentQuestion.title}</h3>
                      <div dangerouslySetInnerHTML={{ __html: currentQuestion.description }} />
                      
                      {currentQuestion.type === 'code' && currentQuestion.examples && currentQuestion.examples.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-lg font-medium">Examples</h4>
                          {currentQuestion.examples.map((example, index) => (
                            <div key={index} className="mb-4 p-4 bg-gray-50 rounded-md">
                              <div className="mb-2">
                                <strong>Input:</strong> <pre className="inline">{example.input}</pre>
                              </div>
                              <div className="mb-2">
                                <strong>Output:</strong> <pre className="inline">{example.output}</pre>
                              </div>
                              {example.explanation && (
                                <div>
                                  <strong>Explanation:</strong> {example.explanation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="solution" className="flex-1 h-full m-0">
                    <CodeEditor 
                      question={currentQuestion}
                      onCodeChange={(language, code) => updateCodeSolution(currentQuestion.id, language, code)}
                      onMarksUpdate={(marks) => updateMarksObtained(currentQuestion.id, marks)}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </CardContent>
        </Card>
        
        <div className="flex justify-between items-center">
          <Button
            onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
            disabled={!isPreviousEnabled}
            variant="outline"
          >
            Previous
          </Button>
          
          <Pagination>
            <PaginationContent>
              {paginationItems.length <= 10 ? (
                paginationItems
              ) : (
                <>
                  {paginationItems.slice(0, 3)}
                  {currentQuestionIndex > 3 && <PaginationEllipsis />}
                  
                  {currentQuestionIndex > 3 && currentQuestionIndex < paginationItems.length - 3 && 
                    paginationItems.slice(
                      Math.max(3, currentQuestionIndex - 1),
                      Math.min(paginationItems.length - 3, currentQuestionIndex + 2)
                    )
                  }
                  
                  {currentQuestionIndex < paginationItems.length - 3 && <PaginationEllipsis />}
                  {paginationItems.slice(-3)}
                </>
              )}
            </PaginationContent>
          </Pagination>
          
          <Button
            onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
            disabled={!isNextEnabled}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentPage;
