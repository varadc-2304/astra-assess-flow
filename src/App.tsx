
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from "@/components/ui/tooltip"
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import StudentDashboard from '@/pages/student/StudentDashboard';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AssessmentDetail from '@/pages/admin/AssessmentDetail';
import ResultsPage from '@/pages/admin/ResultsPage';
import NotFound from '@/pages/NotFound';
import InstructionsPage from '@/pages/student/InstructionsPage';
import AssessmentPage from '@/pages/student/AssessmentPage';
import SummaryPage from '@/pages/student/SummaryPage';
import CameraVerificationPage from '@/pages/student/CameraVerificationPage';
import { AuthProvider } from '@/contexts/AuthContext';
import { AssessmentProvider } from '@/contexts/AssessmentContext';

import AutoLogin from '@/pages/AutoLogin';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <AssessmentProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auto-login" element={<AutoLogin />} />
                
                {/* Student routes */}
                <Route path="/student" element={<StudentDashboard />} />
                <Route path="/student/instructions/:assessmentId" element={<InstructionsPage />} />
                <Route path="/student/camera-verification/:assessmentId" element={<CameraVerificationPage />} />
                <Route path="/student/assessment/:assessmentId" element={<AssessmentPage />} />
                <Route path="/student/summary/:submissionId" element={<SummaryPage />} />
                
                {/* Admin routes */}
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/assessment/:assessmentId" element={<AssessmentDetail />} />
                <Route path="/admin/results/:assessmentId" element={<ResultsPage />} />
                
                {/* Catch all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AssessmentProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
