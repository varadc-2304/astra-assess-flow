
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Assessment Completed</h1>
        </div>
        
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Assessment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Information */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-sm text-gray-500">Student Name</h3>
                <p className="font-medium">{user?.name}</p>
              </div>
              <div>
                <h3 className="text-sm text-gray-500">Email</h3>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>

            <Separator />

            {/* Assessment Information */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-sm text-gray-500">Assessment Name</h3>
                <p className="font-medium">{assessment.name}</p>
              </div>
              <div>
                <h3 className="text-sm text-gray-500">Assessment Code</h3>
                <p className="font-medium">{assessment.code}</p>
              </div>
            </div>

            <Separator />

            {/* Performance */}
            <div>
              <h3 className="text-lg font-medium mb-3">Performance</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold text-astra-red">{percentage}%</p>
                  <p className="text-xs text-gray-500">Score</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold">{totalMarksObtained}/{totalPossibleMarks}</p>
                  <p className="text-xs text-gray-500">Marks</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-2xl font-bold">N/A</p>
                  <p className="text-xs text-gray-500">Rank</p>
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <Button 
                onClick={() => navigate('/student')}
                className="bg-astra-red hover:bg-red-600 text-white"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SummaryPage;
