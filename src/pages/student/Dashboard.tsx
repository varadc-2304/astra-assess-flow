
import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Clock, Trophy, Star, CheckCircle2, PlayCircle, ArrowRight, Calendar } from 'lucide-react';
import AssessmentCodeInput from '@/components/AssessmentCodeInput';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, Result } from '@/types/database';
import PracticeAssessmentCard from '@/components/PracticeAssessmentCard';

const StudentDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [practiceAssessments, setPracticeAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPracticeAssessments = async () => {
      setIsLoading(true);
      try {
        const { data: assessments, error: assessmentsError } = await supabase
          .from('assessments')
          .select('*')
          .eq('is_practice', true)
          .order('created_at', { ascending: false });

        if (assessmentsError) throw assessmentsError;

        const processedAssessments = await Promise.all((assessments || []).map(async (assessment) => {
          const { count: mcqCount, error: mcqError } = await supabase
            .from('mcq_questions')
            .select('*', { count: 'exact' })
            .eq('assessment_id', assessment.id);
          
          if (mcqError) throw mcqError;
          
          const { count: codingCount, error: codingError } = await supabase
            .from('coding_questions')
            .select('*', { count: 'exact' })
            .eq('assessment_id', assessment.id);
          
          if (codingError) throw codingError;
          
          const { data: totalMarksData } = await supabase
            .rpc('calculate_assessment_total_marks', { assessment_id: assessment.id });

          return {
            ...assessment,
            mcqCount,
            codingCount,
            marks: totalMarksData || 0
          };
        }));

        setPracticeAssessments(processedAssessments);

        if (user) {
          const { data: userResults, error: resultsError } = await supabase
            .from('results')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          if (resultsError) throw resultsError;
          setResults(userResults || []);
        }
      } catch (error) {
        console.error('Error fetching practice assessments:', error);
        toast({
          title: 'Failed to load practice assessments',
          description: 'Please try refreshing the page',
          variant: 'destructive',
          duration: 1000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPracticeAssessments();
  }, [user, toast]);

  const filteredAssessments = practiceAssessments.filter(assessment => 
    assessment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assessment.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAssessmentSolved = (assessmentId: string) => {
    return results.some(result => result.assessment_id === assessmentId);
  };

  const getMarksObtained = (assessmentId: string) => {
    const result = results.find(result => result.assessment_id === assessmentId);
    return result ? result.total_score : 0;
  };

  const getTotalMarks = (assessmentId: string) => {
    const result = results.find(result => result.assessment_id === assessmentId);
    return result ? result.total_marks : 0;
  };

  const completedAssessments = results.length;
  const averageScore = results.length > 0 
    ? Math.round(results.reduce((sum, result) => sum + result.percentage, 0) / results.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  Welcome back, {user?.name || 'Student'}!
                </h1>
                <p className="text-xl text-gray-600">Ready to test your skills and knowledge?</p>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{completedAssessments}</p>
                    <p className="text-sm text-gray-600">Completed</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{averageScore}%</p>
                    <p className="text-sm text-gray-600">Avg Score</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Star className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{practiceAssessments.length}</p>
                    <p className="text-sm text-gray-600">Available</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Assessment Code Input Section */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <PlayCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Start Your Assessment</h2>
            <p className="text-gray-600 mb-8">Enter the assessment code provided by your instructor to begin</p>
            <AssessmentCodeInput />
          </div>
        </div>

        {/* Practice Assessments Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Practice Assessments</h2>
              <p className="text-gray-600">Sharpen your skills with our practice tests</p>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search assessments..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 w-full md:w-80 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl animate-pulse">
                  <div className="p-6 space-y-4">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                    <div className="space-y-2">
                      <div className="h-2 bg-gray-300 rounded"></div>
                      <div className="h-2 bg-gray-300 rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAssessments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssessments.map((assessment) => (
                <PracticeAssessmentCard 
                  key={assessment.id}
                  assessment={assessment}
                  isSolved={isAssessmentSolved(assessment.id)}
                  marksObtained={getMarksObtained(assessment.id)}
                  totalMarks={getTotalMarks(assessment.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl shadow-lg border border-gray-100">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <Search className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No matching assessments found' : 'No practice assessments available'}
              </h3>
              <p className="text-gray-600">
                {searchQuery ? 'Try adjusting your search terms' : 'Check back later for new practice tests'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
