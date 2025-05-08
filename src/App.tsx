
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { AssessmentProvider } from '@/contexts/AssessmentContext';

import LoginPage from '@/pages/Login';
import IndexPage from '@/pages/Index';
import NotFoundPage from '@/pages/NotFound';
import StudentDashboard from '@/pages/student/Dashboard';
import AdminDashboard from '@/pages/admin/Dashboard';
import AssessmentDetail from '@/pages/admin/AssessmentDetail';
import ResultsPage from '@/pages/admin/ResultsPage';
import AssessmentPage from '@/pages/student/AssessmentPage';
import InstructionsPage from '@/pages/student/InstructionsPage';
import SummaryPage from '@/pages/student/SummaryPage';
import ProctoringSplash from '@/components/ProctoringSplash';
import { useIsMobile, MOBILE_BREAKPOINT } from '@/hooks/use-mobile';
import { ShieldAlert } from 'lucide-react';
import { Button } from './components/ui/button';

function MobileRestriction() {
  const { isMobile, screenWidth } = useIsMobile();
  
  if (!isMobile) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-slate-800 p-6 text-center">
      <ShieldAlert className="h-16 w-16 text-amber-400 mb-4" />
      <h2 className="text-2xl font-bold text-white mb-4">Mobile Access Restricted</h2>
      <div className="max-w-md text-gray-300 mb-6">
        <p className="mb-4">
          This assessment platform is designed exclusively for desktop/laptop devices. 
          Mobile access is restricted to ensure testing integrity.
        </p>
        <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700">
          <p className="font-medium text-gray-200 mb-1">Device information:</p>
          <p className="text-sm text-gray-400">Screen width: {screenWidth}px</p>
          <p className="text-sm text-gray-400">(Minimum required: {MOBILE_BREAKPOINT}px)</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AssessmentProvider>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <MobileRestriction />
            <Routes>
              <Route path="/" element={<IndexPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/assessment/:id" element={<AssessmentDetail />} />
              <Route path="/admin/results" element={<ResultsPage />} />
              <Route path="/instructions" element={<InstructionsPage />} />
              <Route path="/proctoring-setup" element={<ProctoringSplash />} />
              <Route path="/assessment" element={<AssessmentPage />} />
              <Route path="/summary" element={<SummaryPage />} />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
            <Toaster />
          </ThemeProvider>
        </AssessmentProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
