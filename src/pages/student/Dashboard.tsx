
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface RecentAssessment {
  id: string;
  name: string;
  code: string;
  completed_at: string;
  total_marks: number;
  total_score: number;
}

const StudentDashboard = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>([]);
  const { user, logout } = useAuth();
  const { setAssessmentCode, loadAssessment } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchRecentAssessments = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('results')
          .select(`
            id,
            total_marks,
            total_score,
            completed_at,
            assessment:assessments (
              name,
              code
            )
          `)
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        if (data) {
          const formatted = data.map(result => ({
            id: result.id,
            name: result.assessment.name,
            code: result.assessment.code,
            completed_at: result.completed_at,
            total_marks: result.total_marks,
            total_score: result.total_score
          }));
          setRecentAssessments(formatted);
        }
      } catch (error) {
        console.error('Error fetching recent assessments:', error);
      }
    };

    fetchRecentAssessments();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      toast({
        title: "Error",
        description: "Please enter an assessment code",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      console.log("Setting assessment code:", code);
      setAssessmentCode(code);
      
      console.log("Loading assessment...");
      const success = await loadAssessment(code);
      
      if (success) {
        console.log("Assessment loaded successfully. Navigating to instructions page");
        navigate('/instructions');
      } else {
        console.error("Failed to load assessment");
        // Error is already shown in toast by the loadAssessment function
      }
    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 animate-gradient py-12">
      <div className="max-w-xl mx-auto px-4">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="gradient-text text-4xl font-bold mb-1">Yudh</h1>
            <p className="text-gray-600">Welcome back, {user?.name}</p>
          </div>
          <Button 
            variant="outline" 
            onClick={logout}
            className="bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all duration-200"
          >
            Log out
          </Button>
        </header>
        
        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle>Enter Assessment Code</CardTitle>
            <CardDescription>
              Please enter the assessment code provided by your instructor to begin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input 
                placeholder="Assessment Code (e.g., DEMO123)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center font-mono text-lg uppercase bg-white/50 backdrop-blur-sm border-gray-200 focus:border-astra-red focus:ring-astra-red/10"
              />
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-astra-red to-red-500 hover:from-red-600 hover:to-red-700 text-white shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Assessments</h2>
          <Card className="glass-card">
            <CardContent className="p-0">
              {recentAssessments.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="divide-y">
                    {recentAssessments.map((assessment) => (
                      <div key={assessment.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{assessment.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                              <Clock className="h-4 w-4" />
                              {new Date(assessment.completed_at).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              Code: {assessment.code}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              {assessment.total_score >= (assessment.total_marks * 0.4) ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-medium">
                                {assessment.total_score}/{assessment.total_marks}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {Math.round((assessment.total_score / assessment.total_marks) * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-gray-500 text-sm text-center py-6">
                  No recent assessments found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
