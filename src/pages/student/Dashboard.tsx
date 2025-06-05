
import React, { useState, useEffect } from 'react';
import { LogOut, Search, Shield, BookOpen } from 'lucide-react';
import AssessmentCodeInput from '@/components/AssessmentCodeInput';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, Result } from '@/types/database';
import PracticeAssessmentCard from '@/components/PracticeAssessmentCard';

const StudentDashboard = () => {
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const [practiceAssessments, setPracticeAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPracticeAssessments = async () => {
      setIsLoading(true);
      try {
        // Fetch practice assessments
        const { data: assessments, error: assessmentsError } = await supabase
          .from('assessments')
          .select('*')
          .eq('is_practice', true)
          .order('created_at', { ascending: false });

        if (assessmentsError) throw assessmentsError;

        // Process assessments
        const processedAssessments = await Promise.all((assessments || []).map(async (assessment) => {
          // Count MCQ questions
          const { count: mcqCount, error: mcqError } = await supabase
            .from('mcq_questions')
            .select('*', { count: 'exact' })
            .eq('assessment_id', assessment.id);
          
          if (mcqError) throw mcqError;
          
          // Count coding questions
          const { count: codingCount, error: codingError } = await supabase
            .from('coding_questions')
            .select('*', { count: 'exact' })
            .eq('assessment_id', assessment.id);
          
          if (codingError) throw codingError;
          
          // Get total marks
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

        // If user is logged in, fetch their results
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

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
        duration: 1000,
      });
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "An error occurred during logout",
        variant: "destructive",
        duration: 1000,
      });
    }
  };

  const filteredAssessments = practiceAssessments.filter(assessment => 
    assessment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assessment.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAssessmentSolved = (assessmentId: string) => {
    return results.some(result => result.assessment_id === assessmentId);
  };

  const getMarksObtained = (assessmentId: string) => {
    // Find the most recent result for this assessment
    const result = results.find(result => result.assessment_id === assessmentId);
    return result ? result.total_score : 0;
  };

  const getTotalMarks = (assessmentId: string) => {
    // Find the most recent result for this assessment and get total_marks
    const result = results.find(result => result.assessment_id === assessmentId);
    return result ? result.total_marks : 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-astra-red/10 to-astra-red/5 rounded-full flex items-center justify-center">
              <Shield className="h-6 w-6 text-astra-red" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Student Portal</h1>
              <p className="text-gray-600">Assessment Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
              <p className="text-xs text-gray-500">Student Account</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="flex items-center gap-2 border-gray-200 hover:bg-gray-50"
            >
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>
        </div>
        
        {/* Assessment Code Input Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Enter Assessment Code</h2>
            <p className="text-gray-600">Enter your unique assessment code to begin your examination</p>
          </div>
          <div className="flex justify-center">
            <AssessmentCodeInput />
          </div>
        </div>

        {/* Practice Assessments Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Practice Assessments</h2>
                <p className="text-gray-600">Enhance your skills with our practice examinations</p>
              </div>
            </div>
            <div className="relative w-80">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search practice assessments..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-100"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-white/50 rounded-xl animate-pulse shadow-sm"></div>
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
            <div className="text-center py-16 bg-white/50 rounded-xl shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg">
                {searchQuery ? 'No matching practice assessments found' : 'No practice assessments available'}
              </p>
              {searchQuery && (
                <p className="text-gray-400 text-sm mt-2">Try adjusting your search terms</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
