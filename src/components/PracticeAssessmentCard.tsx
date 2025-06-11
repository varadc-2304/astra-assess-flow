
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Clock, BookOpen, Code, CheckCircle2, Trophy, ArrowRight, Star, Target } from 'lucide-react';
import { Assessment } from '@/types/database';

interface PracticeAssessmentCardProps {
  assessment: Assessment;
  isSolved: boolean;
  marksObtained: number;
  totalMarks: number;
}

const PracticeAssessmentCard: React.FC<PracticeAssessmentCardProps> = ({
  assessment,
  isSolved,
  marksObtained,
  totalMarks
}) => {
  const navigate = useNavigate();
  const { setAssessmentCode, setAssessment } = useAssessment();

  const handleStartPractice = () => {
    setAssessmentCode(assessment.code);
    setAssessment(assessment);
    navigate('/instructions');
  };

  const getScorePercentage = () => {
    if (totalMarks === 0) return 0;
    return Math.round((marksObtained / totalMarks) * 100);
  };

  const getScoreColor = () => {
    const percentage = getScorePercentage();
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeColor = () => {
    const percentage = getScorePercentage();
    if (percentage >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (percentage >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white rounded-3xl">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Solved Badge */}
      {isSolved && (
        <div className="absolute top-4 right-4 z-10">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle2 className="h-6 w-6 text-white" />
          </div>
        </div>
      )}
      
      <CardHeader className="relative z-10 p-8 pb-4">
        <div className="space-y-4">
          {/* Header with Icon */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-primary transition-colors duration-300">
                {assessment.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">Code: {assessment.code}</p>
            </div>
          </div>
          
          {/* Assessment Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">MCQ</p>
                <p className="font-semibold text-gray-900">{assessment.mcqCount || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <Code className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Coding</p>
                <p className="font-semibold text-gray-900">{assessment.codingCount || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 p-8 pt-4 space-y-6">
        {/* Description */}
        {assessment.instructions && (
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
            {assessment.instructions}
          </p>
        )}
        
        {/* Assessment Details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Duration</span>
            </div>
            <span className="font-semibold text-gray-900">{assessment.duration_minutes} min</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Target className="h-4 w-4" />
              <span>Total Marks</span>
            </div>
            <span className="font-semibold text-gray-900">{assessment.marks || 0}</span>
          </div>
        </div>

        {/* Score Display for Solved Assessments */}
        {isSolved && (
          <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                <span className="font-semibold text-gray-900">Your Score</span>
              </div>
              <Badge className={`${getScoreBadgeColor()} font-bold`}>
                {getScorePercentage()}%
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Marks Obtained</span>
              <span className={`font-bold ${getScoreColor()}`}>
                {marksObtained} / {totalMarks}
              </span>
            </div>
            
            {/* Score Progress Bar */}
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  getScorePercentage() >= 80 ? 'bg-green-500' :
                  getScorePercentage() >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${getScorePercentage()}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button 
          onClick={handleStartPractice}
          className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
            isSolved 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl' 
              : 'bg-gradient-to-r from-primary to-red-600 hover:from-primary/90 hover:to-red-600/90 text-white shadow-lg hover:shadow-xl'
          } group-hover:scale-[1.02] transform`}
        >
          <span className="flex items-center justify-center gap-2">
            {isSolved ? (
              <>
                <Star className="h-5 w-5" />
                Practice Again
              </>
            ) : (
              <>
                <BookOpen className="h-5 w-5" />
                Start Practice
              </>
            )}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </Button>
      </CardContent>
    </Card>
  );
};

export default PracticeAssessmentCard;
