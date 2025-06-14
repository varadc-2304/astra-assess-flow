import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MCQQuestion, CodingQuestion, QuestionSubmission, TestResult } from '@/types/database';
import { MCQQuestionCard } from '@/components/MCQQuestionCard';
import { CodingQuestionCard } from '@/components/CodingQuestionCard';
import { Clock, AlertTriangle, CheckCircle, XCircle, ChevronLeft, ChevronRight, Save, Send, AlertCircle } from 'lucide-react';
import { AssessmentRecorder } from '@/components/AssessmentRecorder';

const AssessmentPage = () => {
  const { assessment, loading, error, assessmentCode, totalMarksObtained, totalPossibleMarks, setTotalMarksObtained, setTotalPossibleMarks } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('mcq');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isTimeWarningOpen, setIsTimeWarningOpen] = useState(false);
  const [isTimeUpDialogOpen, setIsTimeUpDialogOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenViolations, setFullscreenViolations] = useState(0);
  const [isFullscreenWarningOpen, setIsFullscreenWarningOpen] = useState(false);
  const [isFullscreenViolationDialogOpen, setIsFullscreenViolationDialogOpen] = useState(false);
  const [isSubmissionCreated, setIsSubmissionCreated] = useState(false);
  const [isSubmissionCreating, setIsSubmissionCreating] = useState(false);
  const [isSubmissionError, setIsSubmissionError] = useState(false);
  const [isSubmissionComplete, setIsSubmissionComplete] = useState(false);
  const [isSubmissionSaving, setIsSubmissionSaving] = useState(false);
  const [isSubmissionSaveError, setIsSubmissionSaveError] = useState(false);
  const [isSubmissionSaveSuccess, setIsSubmissionSaveSuccess] = useState(false);
  const [isSubmissionSaveDialogOpen, setIsSubmissionSaveDialogOpen] = useState(false);
  const [isSubmissionSaveConfirmDialogOpen, setIsSubmissionSaveConfirmDialogOpen] = useState(false);
  const [isSubmissionSaveConfirmed, setIsSubmissionSaveConfirmed] = useState(false);
  const [isSubmissionSaveConfirmError, setIsSubmissionSaveConfirmError] = useState(false);
  const [isSubmissionSaveConfirmSuccess, setIsSubmissionSaveConfirmSuccess] = useState(false);
  const [isSubmissionSaveConfirmDialogLoading, setIsSubmissionSaveConfirmDialogLoading] = useState(false);
  const [isSubmissionSaveConfirmDialogError, setIsSubmissionSaveConfirmDialogError] = useState(false);
  const [isSubmissionSaveConfirmDialogSuccess, setIsSubmissionSaveConfirmDialogSuccess] = useState(false);
  const [isSubmissionSaveConfirmDialogComplete, setIsSubmissionSaveConfirmDialogComplete] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitting, setIsSubmissionSaveConfirmDialogSubmitting] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitted, setIsSubmissionSaveConfirmDialogSubmitted] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitError, setIsSubmissionSaveConfirmDialogSubmitError] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitSuccess, setIsSubmissionSaveConfirmDialogSubmitSuccess] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitComplete, setIsSubmissionSaveConfirmDialogSubmitComplete] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmed, setIsSubmissionSaveConfirmDialogSubmitConfirmed] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmError, setIsSubmissionSaveConfirmDialogSubmitConfirmError] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmSuccess, setIsSubmissionSaveConfirmDialogSubmitConfirmSuccess] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmComplete, setIsSubmissionSaveConfirmDialogSubmitConfirmComplete] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmSubmitting, setIsSubmissionSaveConfirmDialogSubmitConfirmSubmitting] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmSubmitted, setIsSubmissionSaveConfirmDialogSubmitConfirmSubmitted] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmSubmitError, setIsSubmissionSaveConfirmDialogSubmitConfirmSubmitError] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmSubmitSuccess, setIsSubmissionSaveConfirmDialogSubmitConfirmSubmitSuccess] = useState(false);
  const [isSubmissionSaveConfirmDialogSubmitConfirmSubmitComplete, setIsSubmissionSaveConfirmDialogSubmitConfirmSubmitComplete] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fullscreenCheckRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get questions of the current type
  const mcqQuestions = assessment?.questions?.filter(q => 'type' in q && q.type === 'mcq') as MCQQuestion[] || [];
  const codingQuestions = assessment?.questions?.filter(q => 'type' in q && q.type === 'code') as CodingQuestion[] || [];
  
  // Get current question based on active tab
  const currentQuestions = activeTab === 'mcq' ? mcqQuestions : codingQuestions;
  const currentQuestion = currentQuestions[currentQuestionIndex];
  
  // Calculate progress
  const totalQuestions = (mcqQuestions?.length || 0) + (codingQuestions?.length || 0);
  const mcqProgress = mcqQuestions.length > 0 ? 
    mcqQuestions.filter(q => q.selectedOption !== undefined).length / mcqQuestions.length * 100 : 0;
  const codingProgress = codingQuestions.length > 0 ? 
    codingQuestions.filter(q => q.userSolution && Object.values(q.userSolution).some(sol => sol.trim() !== '')).length / codingQuestions.length * 100 : 0;
  
  // Format remaining time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Check if the user is in fullscreen mode
  const checkFullscreen = () => {
    const isCurrentlyFullscreen = document.fullscreenElement !== null;
    
    if (isFullscreen !== isCurrentlyFullscreen) {
      setIsFullscreen(isCurrentlyFullscreen);
      
      // If exiting fullscreen without permission, record violation
      if (!isCurrentlyFullscreen && submissionId) {
        const newViolationCount = fullscreenViolations + 1;
        setFullscreenViolations(newViolationCount);
        
        // Update violation count in database
        supabase
          .from('submissions')
          .update({ fullscreen_violations: newViolationCount })
          .eq('id', submissionId)
          .then(({ error }) => {
            if (error) {
              console.error('Error updating fullscreen violations:', error);
            }
          });
        
        // Show warning dialog for first few violations
        if (newViolationCount <= 3) {
          setIsFullscreenWarningOpen(true);
        } else {
          // Show serious violation dialog for repeated violations
          setIsFullscreenViolationDialogOpen(true);
        }
      }
    }
  };
  
  // Request fullscreen
  const requestFullscreen = () => {
    const docEl = document.documentElement;
    
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
          toast({
            title: "Fullscreen Error",
            description: "Unable to enter fullscreen mode. Please try again or use a different browser.",
            variant: "destructive",
          });
        });
    }
  };
  
  // Create submission record
  const createSubmission = async () => {
    if (!user || !assessment || isSubmissionCreated || isSubmissionCreating) return;
    
    setIsSubmissionCreating(true);
    
    try {
      // Check if there's an existing submission
      const { data: existingSubmissions, error: fetchError } = await supabase
        .from('submissions')
        .select('id, started_at')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (fetchError) {
        throw fetchError;
      }
      
      // If there's an existing submission, use that
      if (existingSubmissions && existingSubmissions.length > 0) {
        setSubmissionId(existingSubmissions[0].id);
        
        // Calculate remaining time based on existing submission
        if (assessment.durationMinutes) {
          const startedAt = new Date(existingSubmissions[0].started_at);
          const durationMs = assessment.durationMinutes * 60 * 1000;
          const endTime = new Date(startedAt.getTime() + durationMs);
          const now = new Date();
          const remainingMs = Math.max(0, endTime.getTime() - now.getTime());
          setRemainingTime(Math.floor(remainingMs / 1000));
        }
        
        setIsSubmissionCreated(true);
        return;
      }
      
      // Otherwise create a new submission
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          assessment_id: assessment.id,
          user_id: user.id,
          started_at: new Date().toISOString(),
          fullscreen_violations: 0
        })
        .select('id')
        .single();
      
      if (error) {
        throw error;
      }
      
      setSubmissionId(data.id);
      
      // Set initial remaining time
      if (assessment.durationMinutes) {
        setRemainingTime(assessment.durationMinutes * 60);
      }
      
      setIsSubmissionCreated(true);
    } catch (error) {
      console.error('Error creating submission:', error);
      setIsSubmissionError(true);
      toast({
        title: "Error",
        description: "Failed to start assessment. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setIsSubmissionCreating(false);
    }
  };
  
  // Save current progress
  const saveProgress = async () => {
    if (!submissionId || !assessment || !user) return;
    
    setIsSubmissionSaving(true);
    setIsSubmissionSaveError(false);
    setIsSubmissionSaveSuccess(false);
    
    try {
      // Prepare MCQ submissions
      const mcqSubmissions = mcqQuestions
        .filter(q => q.selectedOption !== undefined)
        .map(q => {
          const selectedOption = q.options?.find(opt => opt.id === q.selectedOption);
          return {
            submission_id: submissionId,
            question_type: 'mcq',
            question_id: q.id,
            mcq_option_id: q.selectedOption,
            marks_obtained: selectedOption?.isCorrect ? q.marks : 0,
            is_correct: selectedOption?.isCorrect || false
          } as QuestionSubmission;
        });
      
      // Prepare coding submissions
      const codingSubmissions = codingQuestions
        .filter(q => q.userSolution && Object.values(q.userSolution).some(sol => sol.trim() !== ''))
        .map(q => {
          // Get the first non-empty solution (assuming one language per question for simplicity)
          const language = Object.keys(q.userSolution || {})[0];
          const solution = q.userSolution ? q.userSolution[language] : '';
          
          return {
            submission_id: submissionId,
            question_type: 'code',
            question_id: q.id,
            code_solution: solution,
            language: language,
            marks_obtained: q.marksObtained || 0,
            is_correct: null,
            test_results: q.testResults || null
          } as QuestionSubmission;
        });
      
      // Combine all submissions
      const allSubmissions = [...mcqSubmissions, ...codingSubmissions];
      
      if (allSubmissions.length === 0) {
        setIsSubmissionSaving(false);
        setIsSubmissionSaveSuccess(true);
        return;
      }
      
      // Delete existing submissions first
      const { error: deleteError } = await supabase
        .from('question_submissions')
        .delete()
        .eq('submission_id', submissionId);
      
      if (deleteError) {
        throw deleteError;
      }
      
      // Insert new submissions
      const { error: insertError } = await supabase
        .from('question_submissions')
        .insert(allSubmissions);
      
      if (insertError) {
        throw insertError;
      }
      
      setIsSubmissionSaveSuccess(true);
      
      // Show success toast
      toast({
        title: "Progress Saved",
        description: "Your answers have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving progress:', error);
      setIsSubmissionSaveError(true);
      
      toast({
        title: "Save Error",
        description: "Failed to save your progress. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmissionSaving(false);
    }
  };
  
  // Submit assessment
  const submitAssessment = async () => {
    if (!submissionId || !assessment || !user) return;
    
    setIsSubmitting(true);
    
    try {
      // First save current progress
      await saveProgress();
      
      // Calculate total marks
      let totalMarks = 0;
      let totalObtained = 0;
      
      // Add MCQ marks
      mcqQuestions.forEach(q => {
        totalMarks += q.marks;
        const selectedOption = q.options?.find(opt => opt.id === q.selectedOption);
        if (selectedOption?.isCorrect) {
          totalObtained += q.marks;
        }
      });
      
      // Add coding marks
      codingQuestions.forEach(q => {
        totalMarks += q.marks;
        totalObtained += q.marksObtained || 0;
      });
      
      // Calculate percentage
      const percentage = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : 0;
      
      // Update submission as completed
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          completed_at: new Date().toISOString()
        })
        .eq('id', submissionId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Create result record
      const { error: resultError } = await supabase
        .from('results')
        .insert({
          user_id: user.id,
          assessment_id: assessment.id,
          submission_id: submissionId,
          total_score: totalObtained,
          total_marks: totalMarks,
          percentage: percentage,
          completed_at: new Date().toISOString(),
          contest_name: assessment.name
        });
      
      if (resultError) {
        throw resultError;
      }
      
      // Update context with marks
      setTotalMarksObtained(totalObtained);
      setTotalPossibleMarks(totalMarks);
      
      // Mark submission as complete
      setIsSubmissionComplete(true);
      
      // Navigate to results page
      navigate('/student/summary');
    } catch (error) {
      console.error('Error submitting assessment:', error);
      toast({
        title: "Submission Error",
        description: "Failed to submit your assessment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsSubmitDialogOpen(false);
    }
  };
  
  // Handle time up
  const handleTimeUp = () => {
    setIsTimeUpDialogOpen(true);
    submitAssessment();
  };
  
  // Navigate to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (activeTab === 'mcq' && codingQuestions.length > 0) {
      setActiveTab('coding');
      setCurrentQuestionIndex(0);
    }
  };
  
  // Navigate to previous question
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (activeTab === 'coding' && mcqQuestions.length > 0) {
      setActiveTab('mcq');
      setCurrentQuestionIndex(mcqQuestions.length - 1);
    }
  };
  
  // Initialize assessment
  useEffect(() => {
    if (!loading && assessment && user && !isSubmissionCreated && !isSubmissionCreating) {
      createSubmission();
    }
  }, [assessment, loading, user, isSubmissionCreated, isSubmissionCreating]);
  
  // Set up timer
  useEffect(() => {
    if (remainingTime !== null && remainingTime > 0) {
      timerRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev === null || prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleTimeUp();
            return 0;
          }
          
          // Show warning when 5 minutes remaining
          if (prev === 300) {
            setIsTimeWarningOpen(true);
          }
          
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [remainingTime]);
  
  // Set up fullscreen check
  useEffect(() => {
    if (assessment?.isAiProctored) {
      fullscreenCheckRef.current = setInterval(checkFullscreen, 1000);
      
      // Initial fullscreen request
      if (!isFullscreen) {
        requestFullscreen();
      }
      
      return () => {
        if (fullscreenCheckRef.current) clearInterval(fullscreenCheckRef.current);
      };
    }
  }, [assessment, isFullscreen]);
  
  // Set up auto-save
  useEffect(() => {
    if (submissionId) {
      saveTimeoutRef.current = setInterval(saveProgress, 60000); // Save every minute
      
      return () => {
        if (saveTimeoutRef.current) clearInterval(saveTimeoutRef.current);
      };
    }
  }, [submissionId]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (fullscreenCheckRef.current) clearInterval(fullscreenCheckRef.current);
      if (saveTimeoutRef.current) clearInterval(saveTimeoutRef.current);
    };
  }, []);
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setCurrentQuestionIndex(0);
  };
  
  // Show loading state
  if (loading || !assessment) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                <Skeleton className="h-40 w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error || isSubmissionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              There was a problem loading the assessment. Please try refreshing the page or contact support.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="w-full"
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Assessment Header */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Assessment Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{assessment.name}</h1>
              <p className="text-gray-500">{assessment.code}</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Timer */}
              <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                <span className="font-mono font-medium">
                  {remainingTime !== null ? formatTime(remainingTime) : '--:--:--'}
                </span>
              </div>
              
              {/* Save Button */}
              <Button 
                variant="outline" 
                onClick={saveProgress}
                disabled={isSubmissionSaving}
              >
                {isSubmissionSaving ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
              
              {/* Submit Button */}
              <Button 
                onClick={() => setIsSubmitDialogOpen(true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Progress Bars */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {mcqQuestions.length > 0 && (
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">MCQ Progress</span>
                  <span className="text-sm text-gray-500">
                    {mcqQuestions.filter(q => q.selectedOption !== undefined).length}/{mcqQuestions.length} Questions
                  </span>
                </div>
                <Progress value={mcqProgress} className="h-2" />
              </div>
            )}
            
            {codingQuestions.length > 0 && (
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Coding Progress</span>
                  <span className="text-sm text-gray-500">
                    {codingQuestions.filter(q => q.userSolution && Object.values(q.userSolution).some(sol => sol.trim() !== '')).length}/{codingQuestions.length} Questions
                  </span>
                </div>
                <Progress value={codingProgress} className="h-2" />
              </div>
            )}
          </div>
        </div>

        {/* Assessment Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigation */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Questions</CardTitle>
                <CardDescription>
                  {totalQuestions} questions ({mcqQuestions.length} MCQ, {codingQuestions.length} Coding)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <TabsList className="w-full mb-4">
                    {mcqQuestions.length > 0 && (
                      <TabsTrigger value="mcq" className="flex-1">
                        MCQ ({mcqQuestions.length})
                      </TabsTrigger>
                    )}
                    {codingQuestions.length > 0 && (
                      <TabsTrigger value="coding" className="flex-1">
                        Coding ({codingQuestions.length})
                      </TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="mcq" className="mt-0">
                    <div className="grid grid-cols-5 gap-2">
                      {mcqQuestions.map((q, index) => (
                        <Button
                          key={q.id}
                          variant={currentQuestionIndex === index && activeTab === 'mcq' ? 'default' : 'outline'}
                          className={`h-10 w-full ${q.selectedOption ? 'bg-green-50 border-green-200' : ''}`}
                          onClick={() => {
                            setActiveTab('mcq');
                            setCurrentQuestionIndex(index);
                          }}
                        >
                          {index + 1}
                          {q.selectedOption && (
                            <div className="absolute -top-1 -right-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          )}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="coding" className="mt-0">
                    <div className="grid grid-cols-5 gap-2">
                      {codingQuestions.map((q, index) => (
                        <Button
                          key={q.id}
                          variant={currentQuestionIndex === index && activeTab === 'coding' ? 'default' : 'outline'}
                          className={`h-10 w-full ${q.userSolution && Object.values(q.userSolution).some(sol => sol.trim() !== '') ? 'bg-blue-50 border-blue-200' : ''}`}
                          onClick={() => {
                            setActiveTab('coding');
                            setCurrentQuestionIndex(index);
                          }}
                        >
                          {index + 1}
                          {q.userSolution && Object.values(q.userSolution).some(sol => sol.trim() !== '') && (
                            <div className="absolute -top-1 -right-1">
                              <CheckCircle className="h-3 w-3 text-blue-500" />
                            </div>
                          )}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          {/* Question Display */}
          <div className="lg:col-span-3">
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="mb-2">
                    Question {currentQuestionIndex + 1} of {currentQuestions.length}
                  </Badge>
                  <Badge variant="secondary">
                    {currentQuestion?.marks} {currentQuestion?.marks === 1 ? 'Mark' : 'Marks'}
                  </Badge>
                </div>
                <CardTitle>{currentQuestion?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {activeTab === 'mcq' && currentQuestion && (
                  <MCQQuestionCard 
                    question={currentQuestion as MCQQuestion}
                    submissionId={submissionId}
                  />
                )}
                
                {activeTab === 'coding' && currentQuestion && (
                  <CodingQuestionCard 
                    question={currentQuestion as CodingQuestion}
                    submissionId={submissionId}
                  />
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={prevQuestion}
                  disabled={currentQuestionIndex === 0 && (activeTab === 'mcq' || codingQuestions.length === 0)}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                
                <Button
                  variant="outline"
                  onClick={nextQuestion}
                  disabled={
                    currentQuestionIndex === currentQuestions.length - 1 && 
                    (activeTab === 'coding' || codingQuestions.length === 0)
                  }
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Assessment Recorder */}
      <AssessmentRecorder 
        submissionId={submissionId}
        isAssessmentActive={true}
        onRecordingStatusChange={(isRecording) => {
          console.log('Recording status changed:', isRecording);
        }}
      />
      
      {/* Submit Confirmation Dialog */}
      <AlertDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Assessment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit your assessment? You won't be able to make any changes after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                submitAssessment();
              }}
              disabled={isSubmitting}
              className="bg-astra-red hover:bg-red-600"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Time Warning Dialog */}
      <AlertDialog open={isTimeWarningOpen} onOpenChange={setIsTimeWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Time Running Out
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have 5 minutes remaining to complete this assessment. Please finish and submit your answers soon.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Time Up Dialog */}
      <Dialog open={isTimeUpDialogOpen} onOpenChange={setIsTimeUpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Time's Up
            </DialogTitle>
            <DialogDescription>
              Your assessment time has ended. Your answers are being submitted automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin h-8 w-8 border-4 border-astra-red border-t-transparent rounded-full"></div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Fullscreen Warning Dialog */}
      <AlertDialog open={isFullscreenWarningOpen} onOpenChange={setIsFullscreenWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Fullscreen Mode Required
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please remain in fullscreen mode during the assessment. Exiting fullscreen mode may be considered a violation of assessment rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={requestFullscreen}>
              Return to Fullscreen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Fullscreen Violation Dialog */}
      <AlertDialog open={isFullscreenViolationDialogOpen} onOpenChange={setIsFullscreenViolationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Multiple Fullscreen Violations
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have exited fullscreen mode multiple times. This behavior may be flagged as suspicious and could affect your assessment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={requestFullscreen}>
              Return to Fullscreen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssessmentPage;
