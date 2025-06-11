import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, MCQQuestion, CodingQuestion, QuestionSubmission } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import QuestionCard from '@/components/QuestionCard';
import Editor from "@monaco-editor/react";
import { useFaceDetection } from '@/hooks/use-face-detection';
import { Fullscreen } from 'lucide-react';

const AssessmentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { assessment: contextAssessment } = useAssessment();
  const [searchParams] = useSearchParams();
  const assessmentCode = searchParams.get('assessmentCode');

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Array<MCQQuestion | CodingQuestion>>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [codeSolution, setCodeSolution] = useState<string>("");
  const [marksObtained, setMarksObtained] = useState(0);
  const [totalMarks, setTotalMarks] = useState(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isAssessmentEnded, setIsAssessmentEnded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [language, setLanguage] = useState("python");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);
  const [isTimeUp, setIsTimeUp] = useState(false);

  const {
    startDetection,
    stopDetection,
    faceDetected,
    isFullScreenMode,
    enterFullScreen,
    exitFullScreen,
    violations,
    setViolations,
    faceViolations,
    setFaceViolations,
  } = useFaceDetection();

  const currentQuestion = questions[currentQuestionIndex];
  const editorRef = useRef<any>(null);

  const handleEditorWillMount = (monaco: any) => {
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      jsx: "react",
    });
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
  }

  const handleFullScreen = () => {
    if (!isFullScreenMode) {
      enterFullScreen();
      setIsFullScreen(true);
    } else {
      exitFullScreen();
      setIsFullScreen(false);
    }
  };

  const fetchAssessment = useCallback(async () => {
    if (!assessmentCode) {
      toast({
        title: "Error",
        description: "Assessment code is missing",
        variant: "destructive",
      });
      navigate('/student');
      return;
    }

    try {
      // Fetch assessment details
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', assessmentCode)
        .single();

      if (assessmentError || !assessmentData) {
        console.error('Error fetching assessment:', assessmentError);
        toast({
          title: "Error",
          description: "Failed to fetch assessment details",
          variant: "destructive",
        });
        navigate('/student');
        return;
      }

      setAssessment(assessmentData);

      // Fetch questions
      const { data: mcqQuestions, error: mcqError } = await supabase
        .from('mcq_questions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });

      const { data: codingQuestions, error: codingError } = await supabase
        .from('coding_questions')
        .select('*')
        .eq('assessment_id', assessmentData.id)
        .order('order_index', { ascending: true });

      if (mcqError || codingError) {
        console.error('Error fetching questions:', mcqError || codingError);
        toast({
          title: "Error",
          description: "Failed to fetch assessment questions",
          variant: "destructive",
        });
        navigate('/student');
        return;
      }

      // Add type and options to mcq questions
      const mcqQuestionsWithType = (mcqQuestions || []).map(question => ({
        ...question,
        type: 'mcq' as const,
      }));

      // Add type to coding questions
      const codingQuestionsWithType = (codingQuestions || []).map(question => ({
        ...question,
        type: 'code' as const,
      }));

      const allQuestions = [...mcqQuestionsWithType, ...codingQuestionsWithType].sort((a, b) => {
        return (a.order_index || 0) - (b.order_index || 0);
      });

      setQuestions(allQuestions);

      // Calculate total marks
      const totalMarksValue = allQuestions.reduce((acc, question) => acc + question.marks, 0);
      setTotalMarks(totalMarksValue);

      // Set initial code solution if it's a coding question
      if (allQuestions.length > 0 && allQuestions[0].type === 'code') {
        const codingQuestion = allQuestions[0] as CodingQuestion;
        setCodeSolution(codingQuestion.solutionTemplate?.[language] || '');
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      navigate('/student');
    }
  }, [assessmentCode, navigate, toast]);

  const startAssessment = useCallback(async () => {
    if (!user || !assessment) return;

    try {
      // Create a new submission
      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          user_id: user.id,
          assessment_id: assessment.id,
          started_at: new Date().toISOString(),
          is_terminated: false,
          fullscreen_violations: 0,
          face_violations: 0,
        })
        .select()
        .single();

      if (submissionError) {
        console.error('Error creating submission:', submissionError);
        toast({
          title: "Error",
          description: "Failed to start assessment",
          variant: "destructive",
        });
        navigate('/student');
        return;
      }

      setSubmissionId(submissionData.id);
      setStartTime(new Date());

      // Start face detection
      if (assessment.isAiProctored) {
        startDetection();
      }

      toast({
        title: "Assessment Started",
        description: "The assessment has started",
      });
    } catch (error) {
      console.error('Error starting assessment:', error);
      toast({
        title: "Error",
        description: "Failed to start assessment",
        variant: "destructive",
      });
      navigate('/student');
    }
  }, [assessment, navigate, startDetection, toast, user]);

  useEffect(() => {
    const setupAssessment = async () => {
      await fetchAssessment();
    };

    setupAssessment();
  }, [fetchAssessment]);

  useEffect(() => {
    if (assessment && questions.length > 0 && user) {
      startAssessment();
    }
  }, [assessment, questions, user, startAssessment]);

  useEffect(() => {
    if (assessment && startTime) {
      const durationInSeconds = assessment.duration_minutes * 60;
      const endTime = new Date(startTime.getTime() + durationInSeconds * 1000);

      const calculateTimeRemaining = () => {
        const now = new Date();
        const difference = endTime.getTime() - now.getTime();

        if (difference <= 0) {
          setTimeRemaining(0);
          setIsTimeUp(true);
          setIsAlertOpen(true);
          clearInterval(timerIdRef.current as NodeJS.Timeout);
        } else {
          setTimeRemaining(Math.round(difference / 1000));
        }
      };

      calculateTimeRemaining();
      timerIdRef.current = setInterval(calculateTimeRemaining, 1000);

      return () => clearInterval(timerIdRef.current as NodeJS.Timeout);
    }
  }, [assessment, startTime]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
  };

  const handleOptionChange = (optionId: string) => {
    setSelectedOption(optionId);
  };

  const handleCodeChange = (value: string) => {
    setCodeSolution(value);
  };

  const submitAnswer = async () => {
    if (!user || !currentQuestion || !submissionId) return;

    setIsSubmitting(true);

    try {
      let isCorrect = null;
      let marks = 0;
      let testResults = null;
      let mcq_option_id = null;
      let code_solution = null;

      if (currentQuestion.type === 'mcq') {
        // For MCQ questions
        mcq_option_id = selectedOption || null;

        // Fetch the correct option for the question
        const { data: correctOption, error: correctOptionError } = await supabase
          .from('mcq_options')
          .select('is_correct')
          .eq('id', mcq_option_id)
          .single();

        if (correctOptionError) {
          console.error('Error fetching correct option:', correctOptionError);
          toast({
            title: "Error",
            description: "Failed to verify answer",
            variant: "destructive",
          });
          return;
        }

        isCorrect = correctOption?.is_correct || false;
        marks = isCorrect ? currentQuestion.marks : 0;

      } else if (currentQuestion.type === 'code') {
        // For coding questions
        code_solution = codeSolution;

        // Run test cases and evaluate the solution
        const { data, error } = await supabase.functions.invoke('run-tests', {
          body: {
            code: codeSolution,
            language: language,
            questionId: currentQuestion.id,
            testCases: (currentQuestion as CodingQuestion).testCases,
          },
        });

        if (error) {
          console.error('Function invocation error:', error);
          toast({
            title: "Error",
            description: "Failed to run code",
            variant: "destructive",
          });
          return;
        }

        testResults = data;

        // Calculate marks based on passed test cases
        marks = (testResults as any[]).reduce((acc, test) => acc + (test.passed ? test.marks : 0), 0);
        isCorrect = marks === currentQuestion.marks;
      }

      // Insert the question submission
      const { error: submissionError } = await supabase
        .from('question_submissions')
        .insert({
          submission_id: submissionId,
          question_type: currentQuestion.type,
          question_id: currentQuestion.id,
          mcq_option_id: mcq_option_id,
          code_solution: code_solution,
          language: language,
          marks_obtained: marks,
          is_correct: isCorrect,
          test_results: testResults,
        });

      if (submissionError) {
        console.error('Error inserting submission:', submissionError);
        toast({
          title: "Error",
          description: "Failed to save answer",
          variant: "destructive",
        });
        return;
      }

      // Update total marks obtained
      setMarksObtained(prevMarks => prevMarks + marks);

      toast({
        title: "Answer Submitted",
        description: "Your answer has been saved",
      });

      // Move to the next question
      goToNextQuestion();

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);

      // If the next question is a coding question, set the initial code solution
      if (questions[currentQuestionIndex + 1].type === 'code') {
        const codingQuestion = questions[currentQuestionIndex + 1] as CodingQuestion;
        setCodeSolution(codingQuestion.solutionTemplate?.[language] || '');
      }
    } else {
      setIsAlertOpen(true);
    }
  };

  const confirmEndAssessment = async () => {
    console.log('Assessment ended successfully');
    console.log(`Total marks obtained: ${marksObtained}/${totalMarks}`);
    
    try {
      // Complete the submission
      const { error: submissionError } = await supabase
        .from('submissions')
        .update({ 
          completed_at: new Date().toISOString(),
          is_terminated: false
        })
        .eq('id', submissionId);

      if (submissionError) {
        console.error('Error completing submission:', submissionError);
        toast({
          title: "Error",
          description: "Failed to complete submission",
          variant: "destructive",
        });
        return;
      }

      // Create result record
      const { data: resultData, error: resultError } = await supabase
        .from('results')
        .insert({
          user_id: user.id,
          assessment_id: assessment.id,
          submission_id: submissionId,
          total_score: marksObtained,
          total_marks: totalMarks,
          percentage: totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0,
          is_cheated: false,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (resultError) {
        console.error('Error creating result:', resultError);
        toast({
          title: "Error",
          description: "Failed to save results",
          variant: "destructive",
        });
        return;
      }

      // Navigate to summary page
      navigate('/summary', { 
        state: { 
          result: resultData,
          assessment: assessment,
          submissionId: submissionId
        } 
      });

    } catch (error) {
      console.error('Error in confirmEndAssessment:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      stopDetection();
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (currentQuestion?.type === 'code') {
      const codingQuestion = currentQuestion as CodingQuestion;
      setCodeSolution(codingQuestion.solutionTemplate?.[newLanguage] || '');
    }
  };

  useEffect(() => {
    if (violations > 5) {
      toast({
        title: "Warning",
        description: "Too many violations detected. Assessment will be terminated.",
        variant: "destructive",
      });
      setIsAlertOpen(true);
    }
  }, [toast, violations]);

  useEffect(() => {
    if (faceViolations > 5) {
      toast({
        title: "Warning",
        description: "Too many face violations detected. Assessment will be terminated.",
        variant: "destructive",
      });
      setIsAlertOpen(true);
    }
  }, [toast, faceViolations]);

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      {assessment ? (
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-800">{assessment.name}</h1>
                <p className="text-gray-500">Time Remaining: {formatTime(timeRemaining)}</p>
              </div>
              <Button variant="outline" size="icon" onClick={handleFullScreen}>
                {isFullScreenMode ? <FullscreenExit className="h-4 w-4" /> : <Fullscreen className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-gray-600">{assessment.instructions}</p>
          </div>

          {currentQuestion ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <QuestionCard
                question={currentQuestion}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={questions.length}
              />

              {currentQuestion.type === 'mcq' && (
                <div className="mt-4">
                  <ul>
                    {(currentQuestion as MCQQuestion).options?.map((option) => (
                      <li key={option.id} className="mb-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="mr-2 h-5 w-5 text-blue-600 focus:ring-blue-500"
                            value={option.id}
                            checked={selectedOption === option.id}
                            onChange={() => handleOptionChange(option.id)}
                          />
                          {option.text}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {currentQuestion.type === 'code' && (
                <div className="mt-4">
                  <div className="flex items-center mb-2">
                    <label htmlFor="language" className="mr-2 text-sm font-medium text-gray-700">
                      Language:
                    </label>
                    <select
                      id="language"
                      className="shadow-sm bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-auto p-2.5"
                      value={language}
                      onChange={handleLanguageChange}
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="java">Java</option>
                    </select>
                  </div>
                  <Editor
                    theme="vs-dark"
                    height="400px"
                    language={language}
                    value={codeSolution}
                    onChange={handleCodeChange}
                    beforeMount={handleEditorWillMount}
                    onMount={handleEditorDidMount}
                    options={{
                      "acceptSuggestionOnCommitCharacter": true,
                      "acceptSuggestionOnEnter": "on",
                      "accessibilitySupport": "auto",
                      "autoClosingBrackets": "always",
                      "autoClosingQuotes": "always",
                      "autoIndent": false,
                      "automaticLayout": true,
                      "codeLens": true,
                      "colorDecorators": true,
                      "contextmenu": true,
                      "cursorBlinking": "blink",
                      "cursorSmoothCaretAnimation": true,
                      "cursorStyle": "line",
                      "detectIndentation": true,
                      "dragAndDrop": true,
                      "emptySelectionClipboard": true,
                      "extraEditorClassName": "mt-2",
                      "fixedOverflowWidgets": false,
                      "folding": true,
                      "foldingStrategy": "auto",
                      "fontLigatures": false,
                      "formatOnPaste": true,
                      "formatOnType": true,
                      "glyphMargin": true,
                      "gotoLocation": {
                        "multipleDefinitions": "show",
                        "multipleReferences": "show",
                        "peekDefinitions": true,
                        "peekReferences": true
                      },
                      "hideCursorInOverviewRuler": false,
                      "highlightActiveIndentGuide": true,
                      "links": true,
                      "mouseWheelZoom": false,
                      "multiCursorMergeOverlapping": true,
                      "multiCursorModifier": "alt",
                      "occurrencesHighlight": true,
                      "overviewRulerBorder": true,
                      "overviewRulerLanes": 2,
                      "parameterHints": {
                        "cycle": true,
                        "enabled": true
                      },
                      "quickSuggestions": {
                        "comments": "on",
                        "other": "on",
                        "strings": "on"
                      },
                      "readOnly": false,
                      "renameOnType": false,
                      "roundedSelection": true,
                      "rulers": [],
                      "scrollBeyondLastColumn": 5,
                      "scrollBeyondLastLine": true,
                      "selectOnLineNumbers": true,
                      "selectionClipboard": true,
                      "selectionHighlight": true,
                      "showFoldingControls": "mouseover",
                      "showUnused": true,
                      "snippetSuggestions": "inline",
                      "smoothScrolling": true,
                      "suggest": {
                        "filterGraceful": true,
                        "insertMode": "insert",
                        "localityBonus": true,
                        "shareSuggestSelections": false,
                        "snippetsPreventQuickSuggestions": true
                      },
                      "suggestOnTriggerCharacters": true,
                      "suggestSelection": "first",
                      "tabCompletion": "on",
                      "unicodeHighlight": {
                        "ambiguousCharacters": true,
                        "invisibleCharacters": true
                      },
                      "unusualLineTerminators": "auto",
                      "useTabStops": true,
                      "wordBasedSuggestions": true,
                      "wordSeparators": null,
                      "wordWrap": "off",
                      "wrappingIndent": "same"
                    }}
                  />
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <Button
                  onClick={submitAnswer}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Loading assessment questions...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10">
          <p>Loading assessment...</p>
        </div>
      )}

      <AlertDialog open={isAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Assessment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end the assessment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsAlertOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEndAssessment}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssessmentPage;
