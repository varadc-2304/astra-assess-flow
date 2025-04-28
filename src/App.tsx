
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { AssessmentProvider } from '@/contexts/AssessmentContext';
import RoleGuard from '@/components/RoleGuard';

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard';
import AssessmentDetail from '@/pages/admin/AssessmentDetail';
import ResultsPage from '@/pages/admin/ResultsPage';

// Student pages
import StudentDashboard from '@/pages/student/Dashboard';
import InstructionsPage from '@/pages/student/InstructionsPage';
import AssessmentPage from '@/pages/student/AssessmentPage';
import SummaryPage from '@/pages/student/SummaryPage';

// Shared pages
import IndexPage from '@/pages/Index';
import LoginPage from '@/pages/Login';
import NotFound from '@/pages/NotFound';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <AssessmentProvider>
        <div className="container mx-auto flex flex-col min-h-screen">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<IndexPage />} />
            <Route path="/login" element={<LoginPage />} />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <RoleGuard allowedRole="admin">
                <AdminDashboard />
              </RoleGuard>
            } />
            <Route path="/admin/assessment/:id" element={
              <RoleGuard allowedRole="admin">
                <AssessmentDetail />
              </RoleGuard>
            } />
            <Route path="/admin/results" element={
              <RoleGuard allowedRole="admin">
                <ResultsPage />
              </RoleGuard>
            } />
            
            {/* Student routes */}
            <Route path="/student" element={
              <RoleGuard allowedRole="student">
                <StudentDashboard />
              </RoleGuard>
            } />
            <Route path="/instructions" element={
              <RoleGuard allowedRole="student">
                <InstructionsPage />
              </RoleGuard>
            } />
            <Route path="/assessment" element={
              <RoleGuard allowedRole="student">
                <AssessmentPage />
              </RoleGuard>
            } />
            <Route path="/summary" element={
              <RoleGuard allowedRole="student">
                <SummaryPage />
              </RoleGuard>
            } />
            
            {/* 404 route */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </div>
        
        <Toaster />
      </AssessmentProvider>
    </AuthProvider>
  );
}

export default App;
