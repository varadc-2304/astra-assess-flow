import React, { useState, useEffect } from 'react';
import { LogOut, Search } from 'lucide-react';
import AssessmentCodeInput from '@/components/AssessmentCodeInput';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, Result } from '@/types/database';
import PracticeAssessmentCard from '@/components/PracticeAssessmentCard';
import { useAssessmentAccess } from '@/hooks/useAssessmentAccess';

const StudentDashboard = () => {
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const { getAccessibleAssessmentCodes } = useAssessmentAccess();
  const [practiceAssessments, setPracticeAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPracticeAssessments = async () => {
      setIsLoading(true);
      try {
        console.log('Dashboard: User data:', user);
        console.log('Dashboard: User assigned assessments:', user?.assigned_assessments);
        
        const accessibleCodes = getAccessibleAssessmentCodes();
        console.log('Dashboard: Accessible assessment codes:', accessibleCodes);
        
        // If user has no assigned assessments, show empty state
        if (accessibleCodes.length === 0) {
          console.log('Dashboard: No accessible assessment codes found');
          setPracticeAssessments([]);
          setIsLoading(false);
          return;
        }

        console.log('Dashboard: Fetching practice assessments for codes:', accessibleCodes);

        // Fetch practice assessments that user has access to
        const { data: assessments, error: assessmentsError } = await supabase
          .from('assessments')
          .select('*')
          .eq('is_practice', true)
          .in('code', accessibleCodes)
          .order('created_at', { ascending: false });

        if (assessmentsError) {
          console.error('Dashboard: Error fetching assessments:', assessmentsError);
          throw assessmentsError;
        }

        console.log('Dashboard: Fetched assessments:', assessments);

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

        console.log('Dashboard: Processed assessments:', processedAssessments);
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
        
        // Handle network errors gracefully
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
          toast({
            title: 'Network Error',
            description: 'Unable to connect to the server. Please check your internet connection and try again.',
            variant: 'destructive',
            duration: 3000,
          });
        } else {
          toast({
            title: 'Failed to load practice assessments',
            description: 'Please try refreshing the page',
            variant: 'destructive',
            duration: 1000,
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if user is available
    if (user) {
      fetchPracticeAssessments();
    } else {
      console.log('Dashboard: No user available, skipping assessment fetch');
    }
  }, [user, toast, getAccessibleAssessmentCodes]);

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
    const result = results.find(result => result.assessment_id === assessmentId);
    return result ? result.total_score : 0;
  };

  const getTotalMarks = (assessmentId: string) => {
    const result = results.find(result => result.assessment_id === assessmentId);
    return result ? result.total_marks : 0;
  };

  return (
    <div className="container mx-auto py-8">
      
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
              {searchQuery ? 'No matching practice assessments found' : 'No practice assessments assigned to you'}
            </p>
            {user?.assigned_assessments && (
              <p className="text-sm text-gray-400 mt-2">
                Your assigned assessments: {user.assigned_assessments.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
