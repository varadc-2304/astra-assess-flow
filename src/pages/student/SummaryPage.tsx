
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Trophy, User, FileText, Clock, Award } from 'lucide-react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/types/database';

const SummaryPage = () => {
  const { assessment, totalMarksObtained, totalPossibleMarks } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [faceViolations, setFaceViolations] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [timeTaken, setTimeTaken] = useState<string>('');

  // Effect to clean up camera when results page is shown
  useEffect(() => {
    // Find and stop any running camera streams
    const stopAllCameraStreams = () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.enumerateDevices()
          .then(() => {
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
              if (video.srcObject) {
                const stream = video.srcObject as MediaStream;
                if (stream) {
                  const tracks = stream.getTracks();
                  tracks.forEach(track => {
                    track.stop();
                  });
                }
                video.srcObject = null;
              }
            });
          })
          .catch(err => console.error("Error stopping camera streams:", err));
      }
    };
    
    // Stop all camera streams when this component mounts
    stopAllCameraStreams();
    
    // Get submission data for face violations and times
    async function getSubmissionData() {
      if (assessment && user) {
        try {
          const { data: submissions, error } = await supabase
            .from('submissions')
            .select('*')
            .eq('assessment_id', assessment.id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (error) {
            console.error("Error fetching submission data:", error);
          } else if (submissions && submissions.length > 0) {
            const submission = submissions[0];
            
            // Extract face violations
            if (submission.face_violations) {
              // Convert face_violations to string array
              if (Array.isArray(submission.face_violations)) {
                setFaceViolations(submission.face_violations.map((item: Json) => String(item)));
              }
            }
            
            // Set assessment times
            if (submission.started_at) {
              setStartTime(submission.started_at);
            }
            
            if (submission.completed_at) {
              setEndTime(submission.completed_at);
            }
            
            // Calculate time taken
            if (submission.started_at && submission.completed_at) {
              const start = new Date(submission.started_at);
              const end = new Date(submission.completed_at);
              const diffMs = end.getTime() - start.getTime();
              const diffMinutes = Math.floor(diffMs / 60000);
              const diffSeconds = Math.floor((diffMs % 60000) / 1000);
              setTimeTaken(`${diffMinutes} minutes, ${diffSeconds} seconds`);
            }
          }
        } catch (err) {
          console.error("Error processing submission data:", err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
    
    getSubmissionData();
    
    return () => {
      // Additional cleanup if needed when component unmounts
    };
  }, [assessment, user]);

  if (!assessment || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3">Loading results...</span>
      </div>
    );
  }

  const percentage = totalPossibleMarks > 0
    ? Math.round((totalMarksObtained / totalPossibleMarks) * 100)
    : 0;

  const getGrade = (percent: number) => {
    if (percent >= 90) return { grade: 'A+', color: 'text-green-600' };
    if (percent >= 80) return { grade: 'A', color: 'text-green-500' };
    if (percent >= 70) return { grade: 'B+', color: 'text-blue-600' };
    if (percent >= 60) return { grade: 'B', color: 'text-blue-500' };
    if (percent >= 50) return { grade: 'C', color: 'text-yellow-600' };
    if (percent >= 40) return { grade: 'D', color: 'text-orange-500' };
    return { grade: 'F', color: 'text-red-500' };
  };

  const { grade, color } = getGrade(percentage);
  
  // Format date and time
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 mb-4">
            <img src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" alt="Yudha Logo" className="w-full h-full" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Assessment Completed</h1>
          <p className="text-gray-600">Your results are summarized below</p>
        </div>
        
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-6">
            <Card className="shadow-lg border-0 mb-6">
              <CardHeader className="bg-gradient-to-r from-astra-red/10 to-astra-red/5">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-astra-red" />
                  Result Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                    <div className={`text-4xl font-bold ${color}`}>{grade}</div>
                    <div className="text-sm text-gray-500 mt-1">Grade</div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-4xl font-bold text-astra-red">{percentage}%</div>
                    <div className="text-sm text-gray-500 mt-1">Score</div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-4xl font-bold">{totalMarksObtained}/{totalPossibleMarks}</div>
                    <div className="text-sm text-gray-500 mt-1">Marks</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Assessment Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Start Time:</span>
                        <span className="font-medium">{formatDateTime(startTime)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">End Time:</span>
                        <span className="font-medium">{formatDateTime(endTime)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{assessment.durationMinutes} minutes</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Time Taken:</span>
                        <span className="font-medium">{timeTaken || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Student Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium">{user?.name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{user?.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">PRN:</span>
                        <span className="font-medium">{user?.prn || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Department:</span>
                        <span className="font-medium">{user?.department || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {faceViolations.length > 0 && (
              <Card className="shadow-lg border-0 overflow-hidden">
                <CardHeader className="bg-amber-50 dark:bg-amber-900/20">
                  <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Proctoring Violations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-lg max-h-40 overflow-y-auto">
                    <ul className="space-y-1 text-sm">
                      {faceViolations.map((violation, index) => (
                        <li key={index} className="text-amber-800 dark:text-amber-300">{violation}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          <div className="md:col-span-4 space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-700" />
                  Assessment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm text-gray-500">Assessment Name</h3>
                    <p className="font-medium">{assessment.name}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm text-gray-500">Code</h3>
                      <p className="font-medium">{assessment.code}</p>
                    </div>
                    <div>
                      <h3 className="text-sm text-gray-500">Duration</h3>
                      <p className="font-medium">{assessment.durationMinutes} minutes</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm text-gray-500">MCQ Questions</h3>
                      <p className="font-medium">{assessment.mcqCount}</p>
                    </div>
                    <div>
                      <h3 className="text-sm text-gray-500">Coding Questions</h3>
                      <p className="font-medium">{assessment.codingCount}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="bg-gray-50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-700" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Score Percentage</span>
                      <span className="text-sm font-medium">{percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-astra-red" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <Clock className="h-5 w-5 mx-auto mb-1 text-gray-500" />
                      <p className="text-xs text-gray-500">Time Taken</p>
                      <p className="font-medium">{timeTaken || 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 mx-auto mb-1 text-gray-500" />
                      <p className="text-xs text-gray-500">Violations</p>
                      <p className="font-medium">{faceViolations.length}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <div className="text-center mt-8">
          <Button 
            onClick={() => navigate('/student')}
            className="bg-astra-red hover:bg-red-600 text-white"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
