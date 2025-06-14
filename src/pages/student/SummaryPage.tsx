
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, Trophy, User, FileText, Clock, Award, Star, TrendingUp, Home } from 'lucide-react';

const SummaryPage = () => {
  const { assessment, totalMarksObtained, totalPossibleMarks } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();

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
    
    return () => {
      // Additional cleanup if needed when component unmounts
    };
  }, []);

  if (!assessment) {
    return null;
  }

  const percentage = totalPossibleMarks > 0
    ? Math.round((totalMarksObtained / totalPossibleMarks) * 100)
    : 0;

  const getGrade = (percent: number) => {
    if (percent >= 90) return { grade: 'A+', color: 'from-emerald-500 to-green-600', bgColor: 'from-emerald-50 to-green-50' };
    if (percent >= 80) return { grade: 'A', color: 'from-emerald-400 to-emerald-600', bgColor: 'from-emerald-50 to-emerald-50' };
    if (percent >= 70) return { grade: 'B+', color: 'from-blue-500 to-blue-600', bgColor: 'from-blue-50 to-blue-50' };
    if (percent >= 60) return { grade: 'B', color: 'from-blue-400 to-blue-600', bgColor: 'from-blue-50 to-blue-50' };
    if (percent >= 50) return { grade: 'C', color: 'from-amber-500 to-yellow-600', bgColor: 'from-amber-50 to-yellow-50' };
    if (percent >= 40) return { grade: 'D', color: 'from-orange-500 to-orange-600', bgColor: 'from-orange-50 to-orange-50' };
    return { grade: 'F', color: 'from-red-500 to-red-600', bgColor: 'from-red-50 to-red-50' };
  };

  const { grade, color, bgColor } = getGrade(percentage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container-modern section-spacing">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-scale">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
            Assessment Completed!
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Congratulations! Your results are summarized below
          </p>
        </div>
        
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Results Summary */}
          <Card className="card-modern border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-astra-red/5 to-orange-500/5 p-1">
              <CardHeader className="bg-white/90 backdrop-blur-sm">
                <CardTitle className="text-3xl font-bold text-gray-900 flex items-center gap-4 justify-center">
                  <Trophy className="h-8 w-8 text-astra-red" />
                  Your Results
                </CardTitle>
              </CardHeader>
            </div>
            <CardContent className="p-12">
              <div className="grid md:grid-cols-3 gap-8 mb-8">
                <div className={`text-center p-8 bg-gradient-to-br ${bgColor} rounded-3xl border-2 border-white shadow-lg`}>
                  <div className={`w-20 h-20 bg-gradient-to-br ${color} rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl`}>
                    <Star className="h-10 w-10 text-white" />
                  </div>
                  <div className={`text-6xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent mb-2`}>
                    {grade}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Grade</div>
                </div>
                
                <div className="text-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-2 border-white shadow-lg">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                    <TrendingUp className="h-10 w-10 text-white" />
                  </div>
                  <div className="text-6xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent mb-2">
                    {percentage}%
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Score</div>
                </div>
                
                <div className="text-center p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-white shadow-lg">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                    <Award className="h-10 w-10 text-white" />
                  </div>
                  <div className="text-6xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent mb-2">
                    {totalMarksObtained}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">out of {totalPossibleMarks}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-1000 ease-out`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <p className="text-center text-gray-600">
                You scored {percentage}% on this assessment
              </p>
            </CardContent>
          </Card>
          
          {/* Detailed Information */}
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Student Information */}
            <Card className="card-modern border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-100/50 to-gray-200/50 p-1">
                <CardHeader className="bg-white/90 backdrop-blur-sm">
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                    <User className="h-6 w-6 text-gray-700" />
                    Student Information
                  </CardTitle>
                </CardHeader>
              </div>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</h3>
                    <p className="text-lg font-bold text-gray-900">{user?.name || 'N/A'}</p>
                  </div>
                  <Separator />
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</h3>
                    <p className="text-lg font-bold text-gray-900">{user?.email || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Assessment Information */}
            <Card className="card-modern border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-100/50 to-gray-200/50 p-1">
                <CardHeader className="bg-white/90 backdrop-blur-sm">
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                    <FileText className="h-6 w-6 text-gray-700" />
                    Assessment Information
                  </CardTitle>
                </CardHeader>
              </div>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Assessment Name</h3>
                    <p className="text-lg font-bold text-gray-900">{assessment.name}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Code</h3>
                      <p className="text-lg font-bold text-gray-900 font-mono">{assessment.code}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Duration</h3>
                      <p className="text-lg font-bold text-gray-900">{assessment.durationMinutes}m</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-50 rounded-xl border border-blue-100">
                      <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-1">MCQ Questions</h3>
                      <p className="text-2xl font-bold text-blue-700">{assessment.mcqCount}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-50 rounded-xl border border-purple-100">
                      <h3 className="text-sm font-semibold text-purple-600 uppercase tracking-wide mb-1">Coding Questions</h3>
                      <p className="text-2xl font-bold text-purple-700">{assessment.codingCount}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Back to Dashboard */}
          <div className="text-center pt-8">
            <Button 
              onClick={() => navigate('/student')}
              className="btn-modern h-16 px-12 text-lg font-bold bg-gradient-to-r from-astra-red to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl"
            >
              <Home className="mr-3 h-6 w-6" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
