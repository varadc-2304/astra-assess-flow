
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const AdminDashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-astra-red">AstraAssessments</h1>
            <p className="text-gray-600">Admin Panel</p>
          </div>
          <div className="flex items-center gap-4">
            <span>Welcome, {user?.name}</span>
            <Button variant="outline" onClick={logout}>Log out</Button>
          </div>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Active Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">1</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">24</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Completed Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">12</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">Programming Fundamentals Assessment</p>
                    <p className="text-sm text-gray-500">TEST123 • Active</p>
                  </div>
                  <Button variant="outline" size="sm">View</Button>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">Data Structures Quiz</p>
                    <p className="text-sm text-gray-500">DATA456 • Scheduled for Apr 15</p>
                  </div>
                  <Button variant="outline" size="sm">View</Button>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="font-medium">Algorithm Design Test</p>
                    <p className="text-sm text-gray-500">ALGO789 • Completed</p>
                  </div>
                  <Button variant="outline" size="sm">View Results</Button>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <Button className="w-full" variant="outline">Create New Assessment</Button>
              <Button className="w-full" variant="outline">View All Assessments</Button>
              <Button className="w-full" variant="outline">Manage Students</Button>
              <Button className="w-full bg-astra-red text-white hover:bg-red-600">Generate Reports</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
