
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, Trophy, User, FileText, Clock, Award } from 'lucide-react';

const SummaryPage = () => {
  const { assessment, totalMarksObtained, totalPossibleMarks } = useAssessment();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!assessment) {
    return null;
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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Assessment Completed</h1>
          <p className="text-gray-600">Your results are summarized below</p>
        </div>
        
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
          </CardContent>
        </Card>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow border-0">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-gray-700" />
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-gray-500">Name</h3>
                  <p className="font-medium">{user?.name || 'N/A'}</p>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm text-gray-500">Email</h3>
                  <p className="font-medium">{user?.email || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow border-0">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-700" />
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
