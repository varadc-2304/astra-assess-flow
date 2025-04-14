
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PlusCircle, FileSpreadsheet, Clock, Users } from 'lucide-react';
import AssessmentForm from '@/components/admin/AssessmentForm';
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

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // In a real app, these would be actual database queries
        // For demo purposes, we'll use fake stats
        setStats({
          activeAssessments: 3,
          students: 42,
          completedAssessments: 15
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-astra-red">AstraAssessments</h1>
            <p className="text-sm text-gray-600">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, {user?.name}</span>
            <Button variant="outline" onClick={logout}>Log out</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="assessments">Assessments</TabsTrigger>
                <TabsTrigger value="create">Create New</TabsTrigger>
              </TabsList>
              
              {activeTab === 'assessments' && (
                <Button 
                  onClick={() => setActiveTab('create')}
                  className="bg-astra-red hover:bg-red-600 text-white"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Create Assessment
                </Button>
              )}
            </div>

            {/* Dashboard Tab */}
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
                <CardContent className="space-y-4">
                  <div className="border-b pb-2">
                    <p className="font-medium">Programming Fundamentals Assessment</p>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Started by 12 students</span>
                      <span>2 hours ago</span>
                    </div>
                  </div>
                  
                  <div className="border-b pb-2">
                    <p className="font-medium">Data Structures Quiz</p>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Created and scheduled</span>
                      <span>Yesterday</span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-medium">Algorithm Design Test</p>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>All submissions graded</span>
                      <span>2 days ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Assessments Tab */}
            <TabsContent value="assessments">
              <AssessmentList />
            </TabsContent>

            {/* Create New Tab */}
            <TabsContent value="create">
              <AssessmentForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
