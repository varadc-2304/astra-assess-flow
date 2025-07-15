
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, BookOpen, Trophy, LogOut } from 'lucide-react';
import { Assessment } from '@/types/database';
import PracticeAssessmentCard from '@/components/PracticeAssessmentCard';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [practiceAssessments, setPracticeAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      const { data: assessmentsData, error } = await supabase
        .from('assessments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching assessments:', error);
        return;
      }

      const practice = assessmentsData.filter(a => a.is_practice);
      const regular = assessmentsData.filter(a => !a.is_practice);

      setPracticeAssessments(practice);
      setAssessments(regular);
    } catch (error) {
      console.error('Error fetching assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img src="/Yudha.png" alt="Yudha" className="h-8 w-auto" />
              <h1 className="text-xl font-semibold text-gray-900">Student Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Profile Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{user?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Department</p>
                  <p className="font-medium">{user?.department || 'Not specified'}</p>
                </div>
                {user?.prn && (
                  <div>
                    <p className="text-sm text-gray-600">PRN</p>
                    <p className="font-medium">{user.prn}</p>
                  </div>
                )}
                {user?.year && (
                  <div>
                    <p className="text-sm text-gray-600">Year</p>
                    <p className="font-medium">{user.year}</p>
                  </div>
                )}
                {user?.division && (
                  <div>
                    <p className="text-sm text-gray-600">Division</p>
                    <p className="font-medium">{user.division}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Practice Assessments */}
        {practiceAssessments.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-6">
              <BookOpen className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Practice Assessments</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {practiceAssessments.map((assessment) => (
                <PracticeAssessmentCard
                  key={assessment.id}
                  assessment={assessment}
                  onStartAssessment={() => navigate('/instructions', { state: { assessmentId: assessment.id } })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular Assessments */}
        {assessments.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <Trophy className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-gray-900">Assessments</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {assessments.map((assessment) => (
                <Card key={assessment.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{assessment.name}</CardTitle>
                      <Badge variant={assessment.status === 'Active' ? 'default' : 'secondary'}>
                        {assessment.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{assessment.duration_minutes} minutes</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <BookOpen className="h-4 w-4 mr-2" />
                        <span>Code: {assessment.code}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2" />
                        <span>Start: {new Date(assessment.start_time).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button
                        className="w-full"
                        disabled={assessment.status !== 'Active'}
                        onClick={() => navigate('/instructions', { state: { assessmentId: assessment.id } })}
                      >
                        {assessment.status === 'Active' ? 'Start Assessment' : 'Not Available'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {assessments.length === 0 && practiceAssessments.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Assessments Available</h3>
              <p className="text-gray-600">Check back later for new assessments.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
