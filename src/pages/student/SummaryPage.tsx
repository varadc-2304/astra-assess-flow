
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, FileCheck, Award, CircleCheck, UserCheck, BookOpen, Clock, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const SummaryPage = () => {
  const { 
    assessment,
    totalMarksObtained,
    totalPossibleMarks,
    loading,
  } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [studentPrn, setStudentPrn] = useState<string | null>(null);
  const [violationSummary, setViolationSummary] = useState<string[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  
  const percentage = totalPossibleMarks > 0 
    ? Math.round((totalMarksObtained / totalPossibleMarks) * 100) 
    : 0;

  useEffect(() => {
    // When assessment loads, get the submission data from Supabase
    const fetchSubmissionData = async () => {
      if (assessment && user) {
        try {
          // Fetch user details
          const { data: userData, error: userError } = await supabase
            .from('auth')
            .select('name, prn')
            .eq('id', user.id)
            .single();
            
          if (userData) {
            setStudentName(userData.name);
            setStudentPrn(userData.prn);
          }
          
          // Fetch submission data
          const { data: submission, error: submissionError } = await supabase
            .from('submissions')
            .select('*')
            .eq('assessment_id', assessment.id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          if (submission) {
            setStartTime(submission.started_at);
            setEndTime(submission.completed_at || new Date().toISOString());
            setSubmissionId(submission.id);
            
            // Parse face violations if they exist
            if (submission.face_violations && Array.isArray(submission.face_violations)) {
              setViolationSummary(submission.face_violations.slice(0, 5)); // Show only first 5 violations
            } else if (typeof submission.face_violations === 'string') {
              try {
                const parsedViolations = JSON.parse(submission.face_violations);
                setViolationSummary(Array.isArray(parsedViolations) ? parsedViolations.slice(0, 5) : []);
              } catch (e) {
                console.error("Error parsing face violations:", e);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching submission data:", error);
        }
      }
    };
    
    fetchSubmissionData();
  }, [assessment, user]);

  const calculateTimeSpent = () => {
    if (!startTime || !endTime) return "N/A";
    
    const startTimeMs = new Date(startTime).getTime();
    const endTimeMs = new Date(endTime).getTime();
    const differenceInMinutes = Math.floor((endTimeMs - startTimeMs) / (1000 * 60));
    
    const hours = Math.floor(differenceInMinutes / 60);
    const minutes = differenceInMinutes % 60;
    
    return hours > 0 
      ? `${hours} hr ${minutes} min` 
      : `${minutes} min`;
  };

  const getGradeLabel = () => {
    if (percentage >= 90) return { label: 'Excellent', color: 'text-green-500' };
    if (percentage >= 75) return { label: 'Very Good', color: 'text-emerald-500' };
    if (percentage >= 60) return { label: 'Good', color: 'text-blue-500' };
    if (percentage >= 45) return { label: 'Fair', color: 'text-amber-500' };
    return { label: 'Needs Improvement', color: 'text-red-500' };
  };

  const getProgressColor = () => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 75) return 'bg-emerald-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 45) return 'bg-amber-500';
    return 'bg-red-500';
  };

  useEffect(() => {
    if (!assessment) {
      navigate('/student');
    }
    
    // Ensure any camera is turned off when viewing summary page
    return () => {
      const videoTracks = navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(() => {
          // Ignore errors - just making sure any active camera is stopped
        });
    };
  }, [assessment, navigate]);

  const handleGoToDashboard = () => {
    // Navigate back to dashboard
    navigate('/student');
  };

  if (!assessment) return null;
  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;

  const grade = getGradeLabel();
  const progressColor = getProgressColor();

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <header className="text-center mb-8">
          <div className="mx-auto w-16 h-16 mb-2">
            <img src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" alt="Yudha Logo" className="w-full h-full" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{assessment.name}</h1>
          <p className="text-gray-600 mt-1">Assessment Complete</p>
        </header>

        {/* Student Info Card */}
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Student Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Name</div>
                  <div className="font-semibold">{studentName || "Not available"}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Id className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">PRN</div>
                  <div className="font-semibold">{studentPrn || "Not available"}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-xl">Assessment Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">{percentage}%</div>
              <div className={`text-sm font-medium ${grade.color}`}>{grade.label}</div>
              <Progress className={`h-2 mt-2 ${progressColor}`} value={percentage} />
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Score</div>
                  <div className="font-semibold">{totalMarksObtained} / {totalPossibleMarks}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Completion</div>
                  <div className="font-semibold">100%</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <CircleCheck className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Test Duration</div>
                  <div className="font-semibold">{assessment.durationMinutes} min</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Time Spent</div>
                  <div className="font-semibold">{calculateTimeSpent()}</div>
                </div>
              </div>
            </div>
            
            {/* Violations Summary Card */}
            {violationSummary.length > 0 && (
              <>
                <Separator />
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                  <h3 className="font-medium text-amber-800 dark:text-amber-400 mb-2">Proctoring Violations:</h3>
                  <ul className="text-sm space-y-1 text-amber-700 dark:text-amber-300">
                    {violationSummary.map((violation, index) => (
                      <li key={index} className="flex gap-2">
                        <span>•</span>
                        <span>{violation}</span>
                      </li>
                    ))}
                    {violationSummary.length > 5 && (
                      <li className="text-xs italic text-amber-600 dark:text-amber-400">
                        + additional violations not shown
                      </li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-center pt-2 pb-6">
            <Button size="lg" onClick={handleGoToDashboard} className="bg-astra-red hover:bg-red-600 text-white">
              <BookOpen className="h-5 w-5 mr-2" />
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
        
        <div className="text-center text-sm text-gray-500">
          <p>Assessment completed on {new Date(endTime || '').toLocaleDateString()}</p>
          <p className="mt-1">Thank you for completing this assessment!</p>
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
