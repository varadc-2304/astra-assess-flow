import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/lib/utils';
import { Download, ChevronLeft, FileText, Code, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  passed: boolean;
  actualOutput?: string;
}

interface AnswerResult {
  questionId: string;
  isCorrect: boolean;
  mcqOptionId?: string;
  codeSolution?: string;
  language?: string;
  marksObtained: number;
  testResults?: TestResult[];
}

interface ReportData {
  submissionId: string;
  completedAt: string;
  answers: AnswerResult[];
  mcqQuestions: any[];
  codeQuestions: any[];
  totalMarks: number;
  earnedMarks: number;
  percentage: number;
}

const ReportPage = () => {
  const { assessment, assessmentEnded } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  
  useEffect(() => {
    if (!assessment || !assessmentEnded) {
      navigate('/student');
      return;
    }
    
    const fetchReportData = async () => {
      if (!assessment || !user) return;
      
      try {
        const { data: submissions, error: submissionError } = await supabase
          .from('submissions')
          .select('*')
          .eq('assessment_id', assessment.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (submissionError || !submissions || submissions.length === 0) {
          throw new Error('No submission found');
        }
        
        const submission = submissions[0];
        
        const { data: answers, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .eq('submission_id', submission.id);
        
        if (answersError) {
          throw new Error('Failed to load answers');
        }
        
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('assessment_id', assessment.id)
          .order('order_index', { ascending: true });
        
        if (questionsError) {
          throw new Error('Failed to load questions');
        }
        
        const { data: mcqOptions, error: mcqOptionsError } = await supabase
          .from('mcq_options')
          .select('*')
          .in('question_id', questions.filter(q => q.type === 'mcq').map(q => q.id));
        
        if (mcqOptionsError) {
          throw new Error('Failed to load MCQ options');
        }
        
        const mcqQuestions = questions
          .filter(q => q.type === 'mcq')
          .map(q => ({
            ...q,
            options: mcqOptions.filter(o => o.question_id === q.id).sort((a, b) => a.order_index - b.order_index),
            answer: answers.find(a => a.question_id === q.id)
          }));
        
        const { data: codingDetails, error: codingError } = await supabase
          .from('coding_questions')
          .select('*')
          .in('question_id', questions.filter(q => q.type === 'code').map(q => q.id));
        
        if (codingError) {
          throw new Error('Failed to load coding details');
        }
        
        const { data: codingExamples, error: examplesError } = await supabase
          .from('coding_examples')
          .select('*')
          .in('question_id', questions.filter(q => q.type === 'code').map(q => q.id));
        
        if (examplesError) {
          throw new Error('Failed to load coding examples');
        }
        
        const codeQuestions = questions
          .filter(q => q.type === 'code')
          .map(q => {
            const details = codingDetails.find(c => c.question_id === q.id);
            return {
              ...q,
              constraints: details?.constraints || [],
              examples: codingExamples
                .filter(e => e.question_id === q.id)
                .sort((a, b) => a.order_index - b.order_index),
              answer: answers.find(a => a.question_id === q.id)
            };
          });
        
        const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
        const earnedMarks = answers.reduce((sum, a) => sum + (a.marks_obtained || 0), 0);
        const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
        
        const formattedAnswers: AnswerResult[] = answers.map(answer => {
          const answerData = answer as any;
          return {
            questionId: answer.question_id,
            isCorrect: answer.is_correct || false,
            mcqOptionId: answer.mcq_option_id,
            codeSolution: answer.code_solution,
            language: answer.language,
            marksObtained: answer.marks_obtained || 0,
            testResults: answerData.test_results ? 
              (typeof answerData.test_results === 'string' ? 
                JSON.parse(answerData.test_results) : answerData.test_results) : 
              undefined
          };
        });
        
        setReportData({
          submissionId: submission.id,
          completedAt: submission.completed_at || submission.created_at,
          answers: formattedAnswers,
          mcqQuestions,
          codeQuestions,
          totalMarks,
          earnedMarks,
          percentage
        });
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReportData();
  }, [assessment, assessmentEnded, navigate, user]);
  
  if (!assessment || loading || !reportData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-astra-red mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Generating your report...</h2>
          <p className="text-gray-600 mt-2">Please wait while we prepare your detailed assessment report.</p>
        </div>
      </div>
    );
  }
  
  const handleDownloadReport = () => {
    if (!reportRef.current) return;
    
    const reportContent = reportRef.current.innerHTML;
    const reportStyles = `
      body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
      .container { max-width: 800px; margin: 0 auto; padding: 20px; }
      h1 { color: #e11d48; text-align: center; margin-bottom: 30px; }
      h2 { color: #333; margin-top: 30px; }
      .header { margin-bottom: 30px; }
      .question { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
      .question h3 { margin-top: 0; }
      .summary { background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
      .summary-item { display: flex; justify-content: space-between; margin-bottom: 10px; }
      .correct { color: #10b981; }
      .incorrect { color: #ef4444; }
      .code { background-color: #f1f1f1; padding: 10px; border-radius: 5px; overflow-x: auto; font-family: monospace; }
      .footer { margin-top: 50px; text-align: center; font-size: 0.9em; color: #666; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
      th { background-color: #f1f1f1; }
    `;
    
    const reportHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Assessment Report - ${assessment.name}</title>
        <style>${reportStyles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Assessment Report</h1>
            <p><strong>Assessment:</strong> ${assessment.name}</p>
            <p><strong>Code:</strong> ${assessment.code}</p>
            <p><strong>Student:</strong> ${user?.name}</p>
            <p><strong>Date:</strong> ${formatDateTime(reportData.completedAt)}</p>
            <p><strong>Score:</strong> ${reportData.earnedMarks}/${reportData.totalMarks} (${reportData.percentage}%)</p>
          </div>
          
          <div class="summary">
            <h2>Performance Summary</h2>
            <div class="summary-item">
              <span>Score:</span>
              <span>${reportData.percentage}%</span>
            </div>
            <div class="summary-item">
              <span>Total Questions:</span>
              <span>${reportData.mcqQuestions.length + reportData.codeQuestions.length}</span>
            </div>
            <div class="summary-item">
              <span>MCQs Attempted:</span>
              <span>${reportData.mcqQuestions.filter(q => q.answer).length}/${reportData.mcqQuestions.length}</span>
            </div>
            <div class="summary-item">
              <span>Coding Questions Attempted:</span>
              <span>${reportData.codeQuestions.filter(q => q.answer).length}/${reportData.codeQuestions.length}</span>
            </div>
          </div>
          
          <h2>Multiple Choice Questions</h2>
          ${reportData.mcqQuestions.map((q, i) => `
            <div class="question">
              <h3>Question ${i+1}: ${q.title}</h3>
              <p>${q.description}</p>
              ${q.image_url ? `<img src="${q.image_url}" alt="${q.title}" style="max-width: 100%; margin: 10px 0;">` : ''}
              <h4>Options:</h4>
              <ul>
                ${q.options.map(opt => `
                  <li>
                    ${q.answer && opt.id === q.answer.mcq_option_id ? '✓ ' : ''}
                    ${opt.text}
                    ${q.answer && opt.id === q.answer.mcq_option_id && opt.is_correct ? ' <span class="correct">(Correct)</span>' : ''}
                    ${q.answer && opt.id === q.answer.mcq_option_id && !opt.is_correct ? ' <span class="incorrect">(Incorrect)</span>' : ''}
                    ${!q.answer && opt.is_correct ? ' <span class="correct">(Correct Answer)</span>' : ''}
                  </li>
                `).join('')}
              </ul>
              ${q.answer ? 
                q.answer.is_correct ?
                  `<p class="correct">You answered correctly and earned ${q.answer.marks_obtained} mark(s).</p>` :
                  `<p class="incorrect">You answered incorrectly and earned 0 mark(s).</p>` :
                `<p class="incorrect">Question not attempted.</p>`
              }
            </div>
          `).join('')}
          
          <h2>Coding Questions</h2>
          ${reportData.codeQuestions.map((q, i) => `
            <div class="question">
              <h3>Question ${i+1}: ${q.title}</h3>
              <p>${q.description}</p>
              <h4>Examples:</h4>
              ${q.examples.map((ex, j) => `
                <div>
                  <p><strong>Example ${j+1}:</strong></p>
                  <p>Input: <code>${ex.input}</code></p>
                  <p>Output: <code>${ex.output}</code></p>
                  ${ex.explanation ? `<p>Explanation: ${ex.explanation}</p>` : ''}
                </div>
              `).join('')}
              <h4>Your Solution:</h4>
              ${q.answer ? `
                <div class="code">
                  <p><strong>Language: ${q.answer.language}</strong></p>
                  <pre>${q.answer.code_solution}</pre>
                </div>
                <p>Test Results: ${q.answer.is_correct ? 
                  `<span class="correct">All tests passed!</span>` : 
                  `<span class="incorrect">Some tests failed.</span>`
                }</p>
                <p>Marks earned: ${q.answer.marks_obtained} out of ${q.marks || 1}</p>` : 
                `<p class="incorrect">No solution submitted.</p>`
              }
            </div>
          `).join('')}
          
          <div class="footer">
            <p>Report generated on ${new Date().toLocaleString()}</p>
            <p>© ${new Date().getFullYear()} Assessment Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assessment.code}_report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/student')}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button 
            onClick={handleDownloadReport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Report
          </Button>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Assessment Report</h1>
          <p className="text-gray-600">Detailed summary of your performance in {assessment.name}</p>
        </div>
        
        <div ref={reportRef}>
          <Card className="mb-8 shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Assessment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm text-gray-500">Assessment</h3>
                  <p className="font-medium">{assessment.name}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-500">Code</h3>
                  <p className="font-medium">{assessment.code}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-500">Student</h3>
                  <p className="font-medium">{user?.name}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-500">Email</h3>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium mb-3">Performance</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-2xl font-bold text-astra-red">{reportData.percentage}%</p>
                    <p className="text-xs text-gray-500">Score</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-2xl font-bold">{reportData.mcqQuestions.length + reportData.codeQuestions.length}</p>
                    <p className="text-xs text-gray-500">Total Questions</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-2xl font-bold">{reportData.mcqQuestions.filter(q => q.answer).length}/{reportData.mcqQuestions.length}</p>
                    <p className="text-xs text-gray-500">MCQs Attempted</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-2xl font-bold">{reportData.codeQuestions.filter(q => q.answer).length}/{reportData.codeQuestions.length}</p>
                    <p className="text-xs text-gray-500">Coding Questions</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="mcq" className="mb-6">
            <TabsList className="mb-4">
              <TabsTrigger value="mcq" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Multiple Choice ({reportData.mcqQuestions.length})
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Coding Questions ({reportData.codeQuestions.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="mcq">
              <div className="space-y-6">
                {reportData.mcqQuestions.map((question, index) => {
                  const answer = question.answer;
                  const selectedOption = question.options.find(opt => answer && opt.id === answer.mcq_option_id);
                  const correctOption = question.options.find(opt => opt.is_correct);
                  const isCorrect = answer && answer.is_correct;
                  
                  return (
                    <Card key={question.id} className="overflow-hidden">
                      <CardHeader className="bg-gray-50">
                        <CardTitle className="flex justify-between items-center">
                          <div>Question {index + 1}: {question.title}</div>
                          {answer ? (
                            isCorrect ? (
                              <div className="flex items-center text-green-500">
                                <CheckCircle className="h-5 w-5 mr-2" />
                                Correct ({answer.marks_obtained} mark{answer.marks_obtained !== 1 ? 's' : ''})
                              </div>
                            ) : (
                              <div className="flex items-center text-red-500">
                                <XCircle className="h-5 w-5 mr-2" />
                                Incorrect (0 marks)
                              </div>
                            )
                          ) : (
                            <div className="text-gray-500">Not Attempted</div>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="mb-4 whitespace-pre-line">{question.description}</div>
                        
                        {question.image_url && (
                          <div className="mb-4">
                            <img 
                              src={question.image_url} 
                              alt={question.title}
                              className="max-w-full h-auto rounded-md border border-gray-200"
                            />
                          </div>
                        )}
                        
                        <h4 className="font-medium mb-2">Options:</h4>
                        <ul className="space-y-2">
                          {question.options.map(option => (
                            <li 
                              key={option.id}
                              className={`p-3 rounded-md border ${
                                answer && option.id === answer.mcq_option_id
                                  ? option.is_correct
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-red-500 bg-red-50'
                                  : option.is_correct
                                    ? 'border-green-500 bg-green-50' 
                                    : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-center">
                                {answer && option.id === answer.mcq_option_id && (
                                  <div className="mr-2">
                                    {option.is_correct ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                  </div>
                                )}
                                <span>{option.text}</span>
                                {option.is_correct && (!answer || option.id !== answer.mcq_option_id) && (
                                  <span className="ml-2 text-sm text-green-600">(Correct Answer)</span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
            
            <TabsContent value="code">
              <div className="space-y-6">
                {reportData.codeQuestions.map((question, index) => {
                  const answer = question.answer;
                  const hasSubmission = answer && answer.code_solution;
                  const testResults = answer?.test_results || [];
                  const passedTests = testResults.filter(t => t.passed).length;
                  const totalTests = testResults.length;
                  
                  return (
                    <Card key={question.id}>
                      <CardHeader className="bg-gray-50">
                        <CardTitle className="flex justify-between items-center">
                          <div>Question {index + 1}: {question.title}</div>
                          {hasSubmission ? (
                            answer.is_correct ? (
                              <div className="flex items-center text-green-500">
                                <CheckCircle className="h-5 w-5 mr-2" />
                                Correct ({answer.marks_obtained} mark{answer.marks_obtained !== 1 ? 's' : ''})
                              </div>
                            ) : (
                              <div className="flex items-center text-orange-500">
                                <div>
                                  {passedTests}/{totalTests} Tests Passed ({answer.marks_obtained} mark{answer.marks_obtained !== 1 ? 's' : ''})
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="text-gray-500">Not Attempted</div>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="mb-4 whitespace-pre-line">{question.description}</div>
                        
                        <h4 className="font-medium mb-2">Examples:</h4>
                        <div className="space-y-3 mb-4">
                          {question.examples.map((example, idx) => (
                            <div key={idx} className="bg-gray-50 p-3 rounded-md">
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
                        
                        <h4 className="font-medium mb-2">Your Submission:</h4>
                        {hasSubmission ? (
                          <div>
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium">Language: {answer.language}</h5>
                              </div>
                              <pre className="bg-gray-100 p-3 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                                {answer.code_solution}
                              </pre>
                            </div>
                            
                            {testResults.length > 0 && (
                              <div>
                                <h5 className="font-medium mb-2">Test Results:</h5>
                                <div className="space-y-2">
                                  {testResults.map((test, idx) => (
                                    <div key={idx} className={`p-2 rounded-md ${test.passed ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                                      <div className="flex items-start gap-2">
                                        {test.passed ? (
                                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                        )}
                                        <div>
                                          <p className="text-sm font-medium">
                                            Test Case {idx + 1}: {test.passed ? 'Passed' : 'Failed'}
                                          </p>
                                          {!test.passed && test.actualOutput && (
                                            <p className="text-xs mt-1">Your Output: {test.actualOutput}</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">No submission</div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
