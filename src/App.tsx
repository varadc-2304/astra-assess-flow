
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AssessmentProvider } from "./contexts/AssessmentContext";
import Login from "./pages/Login";
import StudentDashboard from "./pages/student/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import InstructionsPage from "./pages/student/InstructionsPage";
import AssessmentPage from "./pages/student/AssessmentPage";
import SummaryPage from "./pages/student/SummaryPage";
import NotFound from "./pages/NotFound";
import ResultsPage from "./pages/admin/ResultsPage";
import AssessmentForm from "@/components/admin/AssessmentForm";
import AssessmentDetail from "@/pages/admin/AssessmentDetail";
import QuestionForm from "@/components/admin/QuestionForm";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

// Enhanced protected route component with strict role checking
const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'student' | 'admin' }) => {
  const { user } = useAuth();

  // If no user, redirect to login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If role is required and doesn't match user's role, redirect to appropriate dashboard
  if (requiredRole && user.role !== requiredRole) {
    // Show unauthorized message and redirect to login page
    console.log(`Access denied: User role ${user.role} doesn't match required role ${requiredRole}`);
    return <Navigate to="/" replace />;
  }

  // User is authenticated and has the correct role
  return <>{children}</>;
};

// Auth route redirects logged in users to their dashboard
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<AuthRoute><Login /></AuthRoute>} />
    
    {/* Student Routes - strictly enforce student role */}
    <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
    <Route path="/instructions" element={<ProtectedRoute requiredRole="student"><InstructionsPage /></ProtectedRoute>} />
    <Route path="/assessment" element={<ProtectedRoute requiredRole="student"><AssessmentPage /></ProtectedRoute>} />
    <Route path="/summary" element={<ProtectedRoute requiredRole="student"><SummaryPage /></ProtectedRoute>} />
    
    {/* Admin Routes - strictly enforce admin role */}
    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
    <Route path="/admin/results" element={<ProtectedRoute requiredRole="admin"><ResultsPage /></ProtectedRoute>} />
    <Route path="/admin/assessments/:id" element={<ProtectedRoute requiredRole="admin"><AssessmentDetail /></ProtectedRoute>} />
    
    {/* 404 Route */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <AssessmentProvider>
            <AppRoutes />
            <Toaster />
          </AssessmentProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
