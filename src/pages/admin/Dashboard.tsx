import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FileSpreadsheet, Clock, Users, BarChart } from 'lucide-react';
import AssessmentList from '@/components/admin/AssessmentList';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    activeAssessments: 0,
    students: 0,
    completedAssessments: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: assessments, error: assessmentsError } = await supabase
          .from('assessments')
          .select('*');

        if (assessmentsError) throw assessmentsError;
        
        const now = new Date();
        const activeAssessments = assessments?.filter(assessment => {
          const startTime = new Date(assessment.start_time);
          const endTime = new Date(assessment.end_time);
          return now >= startTime && now <= endTime;
        }).length || 0;
        
        const completedAssessments = assessments?.filter(assessment => {
          const endTime = new Date(assessment.end_time);
          return now > endTime;
        }).length || 0;
        
        const students = 0;
        
        setStats({
          activeAssessments,
          students,
          completedAssessments
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-astra-red">Yudha</h1>
            <p className="text-sm text-gray-600">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, {user?.name}</span>
            <Button variant="outline" onClick={logout}>Log out</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="assessments">Assessments</TabsTrigger>
                <TabsTrigger value="results" onClick={() => navigate('/admin/results')}>Results</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-lg font-medium">Active Assessments</CardTitle>
                    <FileSpreadsheet className="h-5 w-5 text-astra-red" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.activeAssessments}</p>
                    <p className="text-xs text-gray-500">Currently active tests</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-lg font-medium">Students</CardTitle>
                    <Users className="h-5 w-5 text-astra-red" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.students}</p>
                    <p className="text-xs text-gray-500">Total registered students</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-lg font-medium">Completed Assessments</CardTitle>
                    <Clock className="h-5 w-5 text-astra-red" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.completedAssessments}</p>
                    <p className="text-xs text-gray-500">Tests completed by students</p>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Loading activity data...</p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No recent activity to display</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button 
                  onClick={() => navigate('/admin/results')}
                  className="bg-astra-red hover:bg-red-600 text-white"
                >
                  <BarChart className="h-4 w-4 mr-2" /> View All Results
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="assessments">
              <AssessmentList />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
