
import React, { useState, useEffect } from 'react';
import { Search, LogOut } from 'lucide-react';
import AssessmentCodeInput from '@/components/AssessmentCodeInput';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, Result } from '@/types/database';
import PracticeAssessmentCard from '@/components/PracticeAssessmentCard';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [practiceAssessments, setPracticeAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPracticeAssessments = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        // First, get user's assigned assessments
        const { data: authData, error: authError } = await supabase
          .from('auth')
          .select('assigned_assessments')
          .eq('id', user.id)
          .single();

        if (authError) {
          console.error('Error fetching user assignments:', authError);
          toast({
            title: 'Failed to load assignments',
            description: 'Please try refreshing the page',
            variant: 'destructive',
            duration: 1000,
          });
          return;
        }

        const assignedAssessmentCodes = authData?.assigned_assessments || [];

        if (assignedAssessmentCodes.length === 0) {
          setPracticeAssessments([]);
          return;
        }

        // Fetch practice assessments that are assigned to the user
        const { data: assessments, error: assessmentsError } = await supabase
          .from('assessments')
          .select('*')
          .eq('is_practice', true)
          .in('code', assignedAssessmentCodes)
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

        // Fetch user's results for these assessments
        const { data: userResults, error: resultsError } = await supabase
          .from('results')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (resultsError) throw resultsError;
        setResults(userResults || []);

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

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Student Dashboard</h1>
        <Button onClick={handleLogout} variant="outline" size="sm">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Enter Assessment Code</h2>
        <AssessmentCodeInput />
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Practice Assessments</h2>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search practice assessments..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : filteredAssessments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="text-center py-10 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              {searchQuery ? 'No matching assigned practice assessments found' : 'No practice assessments assigned to you'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
