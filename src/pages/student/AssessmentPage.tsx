import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Camera, Clock, FileText, User, CheckCircle2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MCQQuestion from '@/components/MCQQuestion';
import CodeEditor from '@/components/CodeEditor';
import { Timer } from '@/components/Timer';
import ProctoringCamera from '@/components/ProctoringCamera';
import { useFullscreen } from '@/hooks/useFullscreen';

interface Question {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'coding';
  options?: string[];
  correct_answer?: string;
  points: number;
  time_limit?: number;
  code_template?: string;
  language?: string;
}

interface CodingQuestion {
  id: string;
  question_text: string;
  question_type: 'coding';
  points: number;
  time_limit?: number;
  code_template?: string;
  language?: string;
  assessment_id: string;
  image_url?: string;
  order_index: number;
  created_at: string;
}

interface Assessment {
  id: string;
  title: string;
  description?: string;
  duration: number;
  total_questions: number;
  passing_score: number;
  instructions?: string;
  is_proctored: boolean;
  camera_required: boolean;
  questions: Question[];
}

interface Answer {
  questionId: string;
  answer: string;
  isCorrect?: boolean;
  points?: number;
}

const AssessmentPage: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraVerified, setCameraVerified] = useState(false);

  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen();

  useEffect(() => {
    if (assessmentId) {
      fetchAssessment();
    }
  }, [assessmentId]);

  useEffect(() => {
    if (assessment && !timeRemaining) {
      setTimeRemaining(assessment.duration * 60);
    }
  }, [assessment]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && assessment && submissionId) {
        recordViolation('Tab switched or window minimized');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'J') ||
          (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        if (assessment && submissionId) {
          recordViolation('Attempted to open developer tools');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [assessment, submissionId]);

  const fetchAssessment = async () => {
    if (!assessmentId) return;

    try {
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (assessmentError) throw assessmentError;

      // Fetch MCQ questions
      const { data: mcqQuestions, error: mcqError } = await supabase
        .from('mcq_questions')
        .select(`
          *,
          mcq_options (*)
        `)
        .eq('assessment_id', assessmentId)
        .order('order_index');

      if (mcqError) throw mcqError;

      // Fetch coding questions
      const { data: codingQuestions, error: codingError } = await supabase
        .from('coding_questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index');

      if (codingError) throw codingError;

      // Transform and combine questions
      const transformedMcqQuestions: Question[] = (mcqQuestions || []).map(q => ({
        id: q.id,
        question_text: q.title,
        question_type: 'mcq' as const,
        points: q.marks,
        options: q.mcq_options?.map(opt => opt.text) || [],
        correct_answer: q.mcq_options?.find(opt => opt.is_correct)?.text
      }));

      const transformedCodingQuestions: Question[] = (codingQuestions || []).map(q => ({
        id: q.id,
        question_text: q.title,
        question_type: 'coding' as const,
        points: q.marks
      }));

      const allQuestions = [...transformedMcqQuestions, ...transformedCodingQuestions]
        .sort((a, b) => {
          const aOrder = mcqQuestions?.find(q => q.id === a.id)?.order_index || 
                        codingQuestions?.find(q => q.id === a.id)?.order_index || 0;
          const bOrder = mcqQuestions?.find(q => q.id === b.id)?.order_index || 
                        codingQuestions?.find(q => q.id === b.id)?.order_index || 0;
          return aOrder - bOrder;
        });

      setAssessment({
        id: assessmentData.id,
        title: assessmentData.name,
        description: assessmentData.instructions,
        duration: assessmentData.duration_minutes,
        total_questions: allQuestions.length,
        passing_score: 70, // Default passing score
        instructions: assessmentData.instructions,
        is_proctored: assessmentData.is_ai_proctored,
        camera_required: assessmentData.is_ai_proctored,
        questions: allQuestions
      });

      if (assessmentData.is_ai_proctored) {
        setShowCamera(true);
      }

    } catch (error) {
      console.error('Error fetching assessment:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assessment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const recordViolation = async (violationType: string) => {
    if (!submissionId) return;

    try {
      const { data: submission, error: fetchError } = await supabase
        .from('submissions')
        .select('fullscreen_violations')
        .eq('id', submissionId)
        .single();

      if (fetchError) {
        console.error('Error fetching submission:', fetchError);
        return;
      }

      const currentViolations = submission.fullscreen_violations || 0;

      const { error: updateError } = await supabase
        .from('submissions')
        .update({ 
          fullscreen_violations: currentViolations + 1
        })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Error updating violations:', updateError);
      }

      toast({
        title: 'Violation Recorded',
        description: violationType,
        variant: 'destructive',
      });

    } catch (error) {
      console.error('Error recording violation:', error);
    }
  };

  const startAssessment = async () => {
    if (!assessment || !user) return;

    try {
      const { data: submission, error } = await supabase
        .from('submissions')
        .insert({
          assessment_id: assessment.id,
          user_id: user.id,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setSubmissionId(submission.id);
      
      if (assessment.is_proctored) {
        await enterFullscreen();
      }

    } catch (error) {
      console.error('Error starting assessment:', error);
      toast({
        title: 'Error',
        description: 'Failed to start assessment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => {
      const existingIndex = prev.findIndex(a => a.questionId === questionId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], answer };
        return updated;
      } else {
        return [...prev, { questionId, answer }];
      }
    });
  };

  const handleCodeSubmit = (questionId: string, marks: number) => {
    setAnswers(prev => {
      const existingIndex = prev.findIndex(a => a.questionId === questionId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], points: marks };
        return updated;
      } else {
        return [...prev, { questionId, answer: '', points: marks }];
      }
    });
  };

  const submitAssessment = async () => {
    if (!assessment || !submissionId) return;

    setIsSubmitting(true);

    try {
      let totalScore = 0;
      const submissionAnswers = answers.map(answer => {
        const question = assessment.questions.find(q => q.id === answer.questionId);
        if (!question) return answer;

        let isCorrect = false;
        let points = 0;

        if (question.question_type === 'mcq') {
          isCorrect = answer.answer === question.correct_answer;
          points = isCorrect ? question.points : 0;
        } else if (question.question_type === 'coding') {
          points = answer.points || 0;
        }

        totalScore += points;

        return {
          ...answer,
          isCorrect,
          points
        };
      });

      const { error } = await supabase
        .from('submissions')
        .update({
          completed_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) throw error;

      if (assessment.is_proctored) {
        exitFullscreen();
      }

      navigate(`/student/summary/${submissionId}`, { 
        state: { 
          assessment,
          answers: submissionAnswers,
          totalScore 
        } 
      });

    } catch (error) {
      console.error('Error submitting assessment:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit assessment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimeUp = () => {
    toast({
      title: 'Time\'s Up!',
      description: 'Your assessment time has expired. Submitting automatically.',
      variant: 'destructive',
    });
    submitAssessment();
  };

  const handleCameraVerification = (success: boolean) => {
    if (success) {
      setCameraVerified(true);
      setShowCamera(false);
      startAssessment();
    } else {
      toast({
        title: 'Camera Verification Failed',
        description: 'Please ensure your camera is working and your face is clearly visible.',
        variant: 'destructive',
      });
    }
  };

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (showCamera && !cameraVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Verification Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              This assessment requires camera verification. Please ensure your face is clearly visible.
            </p>
            <ProctoringCamera 
              onVerificationComplete={handleCameraVerification}
              showControls={true}
              showStatus={true}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!submissionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {assessment.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {assessment.description && (
              <p className="text-gray-600">{assessment.description}</p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Duration: {assessment.duration} minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm">Questions: {assessment.total_questions}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-purple-600" />
                <span className="text-sm">Passing: {assessment.passing_score}%</span>
              </div>
            </div>

            {assessment.is_proctored && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-800">Proctored Assessment</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      This assessment is proctored. Your screen will be locked in fullscreen mode,
                      and your camera will monitor for any violations during the exam.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {assessment.instructions && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Instructions</h3>
                <div className="text-sm text-blue-700 whitespace-pre-wrap">
                  {assessment.instructions}
                </div>
              </div>
            )}

            <Button 
              onClick={assessment.camera_required ? () => setShowCamera(true) : startAssessment}
              className="w-full"
              size="lg"
            >
              Start Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = assessment.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / assessment.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Assessment Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-gray-900">{assessment.title}</h1>
              <span className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {assessment.questions.length}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <Timer 
                value={timeRemaining}
              />
              <Button
                onClick={submitAssessment}
                disabled={isSubmitting}
                variant="outline"
                size="sm"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </div>
          
          <Progress value={progress} className="h-1" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                {currentQuestion.question_type === 'mcq' ? (
                  <MCQQuestion
                    question={{
                      id: currentQuestion.id,
                      title: currentQuestion.question_text,
                      description: currentQuestion.question_text,
                      type: 'mcq',
                      options: currentQuestion.options?.map((opt, index) => ({
                        id: `${currentQuestion.id}_${index}`,
                        text: opt,
                        isCorrect: opt === currentQuestion.correct_answer
                      })) || [],
                      selectedOption: answers.find(a => a.questionId === currentQuestion.id)?.answer
                    }}
                    onAnswerSelect={(answer) => handleAnswerChange(currentQuestion.id, answer)}
                  />
                ) : (
                  <CodeEditor
                    question={{
                      id: currentQuestion.id,
                      title: currentQuestion.question_text,
                      description: currentQuestion.question_text,
                      assessmentId: assessment.id,
                      orderIndex: currentQuestionIndex,
                      createdAt: new Date().toISOString(),
                      type: 'code',
                      examples: [],
                      constraints: [],
                      solutionTemplate: {},
                      userSolution: {},
                      testCases: [],
                      marksObtained: 0
                    }}
                    onTestResults={(results) => handleCodeSubmit(currentQuestion.id, results.marksObtained || 0)}
                  />
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                variant="outline"
              >
                Previous
              </Button>
              
              <Button
                onClick={() => setCurrentQuestionIndex(prev => Math.min(assessment.questions.length - 1, prev + 1))}
                disabled={currentQuestionIndex === assessment.questions.length - 1}
              >
                Next
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Question Navigator */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2">
                    {assessment.questions.map((question, index) => {
                      const hasAnswer = answers.some(a => a.questionId === question.id);
                      const isCurrent = index === currentQuestionIndex;
                      
                      return (
                        <Button
                          key={question.id}
                          variant={isCurrent ? "default" : "outline"}
                          size="sm"
                          className={`h-8 w-8 p-0 ${hasAnswer && !isCurrent ? 'bg-green-100 border-green-300' : ''}`}
                          onClick={() => setCurrentQuestionIndex(index)}
                        >
                          {hasAnswer && !isCurrent && (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          )}
                          {!hasAnswer && (
                            <span className="text-xs">{index + 1}</span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Camera Feed */}
              {assessment.is_proctored && cameraVerified && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Proctoring
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProctoringCamera 
                      showControls={false}
                      showStatus={true}
                      trackViolations={true}
                      assessmentId={assessment.id}
                      submissionId={submissionId}
                      size="small"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentPage;
