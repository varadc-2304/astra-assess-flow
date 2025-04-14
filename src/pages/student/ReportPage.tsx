
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/lib/utils';
import { Download, ChevronLeft, FileText, Code, CheckCircle, XCircle } from 'lucide-react';

const ReportPage = () => {
  const { assessment, assessmentEnded } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!assessment || !assessmentEnded) {
      navigate('/student');
    }
  }, [assessment, assessmentEnded, navigate]);
  
  if (!assessment) {
    return null;
  }

  // Filter questions by type
  const mcqQuestions = assessment.questions.filter(q => q.type === 'mcq');
  const codeQuestions = assessment.questions.filter(q => q.type === 'code');
  
  // Calculate results
  const attemptedMCQ = mcqQuestions.filter(q => q.selectedOption !== undefined).length;
  const attemptedCode = codeQuestions.filter(q => 
    Object.values(q.userSolution).some(solution => solution && solution.trim() !== '')
  ).length;
  
  // Calculate score (mock for now)
  const totalQuestions = assessment.questions.length;
  const score = Math.floor(Math.random() * 51) + 50; // Random score between 50 and 100
  
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
            <p><strong>Date:</strong> ${formatDateTime(new Date().toISOString())}</p>
          </div>
          
          <div class="summary">
            <h2>Performance Summary</h2>
            <div class="summary-item">
              <span>Score:</span>
              <span>${score}%</span>
            </div>
            <div class="summary-item">
              <span>Total Questions:</span>
              <span>${totalQuestions}</span>
            </div>
            <div class="summary-item">
              <span>MCQs Attempted:</span>
              <span>${attemptedMCQ}/${mcqQuestions.length}</span>
            </div>
            <div class="summary-item">
              <span>Coding Questions Attempted:</span>
              <span>${attemptedCode}/${codeQuestions.length}</span>
            </div>
          </div>
          
          <h2>Multiple Choice Questions</h2>
          ${mcqQuestions.map((q, i) => `
            <div class="question">
              <h3>Question ${i+1}: ${q.title}</h3>
              <p>${q.description}</p>
              ${q.imageUrl ? `<img src="${q.imageUrl}" alt="${q.title}" style="max-width: 100%; margin: 10px 0;">` : ''}
              <h4>Options:</h4>
              <ul>
                ${q.options.map(opt => `
                  <li>
                    ${opt.id === q.selectedOption ? '✓ ' : ''}
                    ${opt.text}
                    ${opt.id === q.selectedOption && opt.isCorrect ? ' <span class="correct">(Correct)</span>' : ''}
                    ${opt.id === q.selectedOption && !opt.isCorrect ? ' <span class="incorrect">(Incorrect)</span>' : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
          
          <h2>Coding Questions</h2>
          ${codeQuestions.map((q, i) => `
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
              <div class="code">
                ${Object.entries(q.userSolution)
                  .filter(([_, code]) => code && code.trim() !== '')
                  .map(([lang, code]) => `
                    <p><strong>Language: ${lang}</strong></p>
                    <pre>${code}</pre>
                  `).join('') || 'No solution submitted'}
              </div>
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
                    <p className="text-2xl font-bold text-astra-red">{score}%</p>
                    <p className="text-xs text-gray-500">Score</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-2xl font-bold">{totalQuestions}</p>
                    <p className="text-xs text-gray-500">Total Questions</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-2xl font-bold">{attemptedMCQ}/{mcqQuestions.length}</p>
                    <p className="text-xs text-gray-500">MCQs Attempted</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <p className="text-2xl font-bold">{attemptedCode}/{codeQuestions.length}</p>
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
                Multiple Choice ({mcqQuestions.length})
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Coding Questions ({codeQuestions.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="mcq">
              <div className="space-y-6">
                {mcqQuestions.map((question, index) => {
                  const selectedOption = question.options.find(opt => opt.id === question.selectedOption);
                  const isCorrect = selectedOption?.isCorrect;
                  
                  return (
                    <Card key={question.id} className="overflow-hidden">
                      <CardHeader className="bg-gray-50">
                        <CardTitle className="flex justify-between items-center">
                          <div>Question {index + 1}: {question.title}</div>
                          {question.selectedOption ? (
                            isCorrect ? (
                              <div className="flex items-center text-green-500">
                                <CheckCircle className="h-5 w-5 mr-2" />
                                Correct
                              </div>
                            ) : (
                              <div className="flex items-center text-red-500">
                                <XCircle className="h-5 w-5 mr-2" />
                                Incorrect
                              </div>
                            )
                          ) : (
                            <div className="text-gray-500">Not Attempted</div>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="mb-4 whitespace-pre-line">{question.description}</div>
                        
                        {question.imageUrl && (
                          <div className="mb-4">
                            <img 
                              src={question.imageUrl} 
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
                                option.id === question.selectedOption
                                  ? option.isCorrect
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-red-500 bg-red-50'
                                  : option.isCorrect
                                    ? 'border-green-500 bg-green-50' 
                                    : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-center">
                                {option.id === question.selectedOption && (
                                  <div className="mr-2">
                                    {option.isCorrect ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                  </div>
                                )}
                                <span>{option.text}</span>
                                {option.isCorrect && option.id !== question.selectedOption && (
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
                {codeQuestions.map((question, index) => {
                  const hasSubmission = Object.values(question.userSolution).some(sol => sol && sol.trim() !== '');
                  
                  return (
                    <Card key={question.id}>
                      <CardHeader className="bg-gray-50">
                        <CardTitle className="flex justify-between items-center">
                          <div>Question {index + 1}: {question.title}</div>
                          {hasSubmission ? (
                            <div className="text-blue-500">Submitted</div>
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
                            {Object.entries(question.userSolution)
                              .filter(([_, code]) => code && code.trim() !== '')
                              .map(([lang, code]) => (
                                <div key={lang} className="mb-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-medium">Language: {lang}</h5>
                                  </div>
                                  <pre className="bg-gray-100 p-3 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                                    {code}
                                  </pre>
                                </div>
                              ))}
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
