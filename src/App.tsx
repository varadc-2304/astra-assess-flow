import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AssessmentProvider } from "./contexts/AssessmentContext";
import Login from "./pages/Login";
import StudentDashboard from "./pages/student/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import InstructionsPage from "./pages/student/InstructionsPage";
import CameraVerificationPage from "./pages/student/CameraVerificationPage";
import AssessmentPage from "./pages/student/AssessmentPage";
import SummaryPage from "./pages/student/SummaryPage";
import NotFound from "./pages/NotFound";
import ResultsPage from "./pages/admin/ResultsPage";
import AssessmentForm from "@/components/admin/AssessmentForm";
import AssessmentDetail from "@/pages/admin/AssessmentDetail";
import QuestionForm from "@/components/admin/QuestionForm";
import { Toaster } from "@/components/ui/toaster";
import { useIsMobile } from "./hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

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

// Mobile access restriction component
const MobileRestriction = () => {
  const { screenWidth } = useIsMobile();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="mobile-restriction-card w-full max-w-md border-red-500 border glass-effect">
        <CardHeader className="text-center border-b border-gray-100 pb-4">
          <CardTitle className="text-2xl text-red-600 font-bold">Access Restricted</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-6 py-4">
            <div className="text-red-500 mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <p className="text-gray-800 font-medium text-lg">
              You cannot access this platform from a mobile device.
            </p>
            <p className="text-gray-600">
              Please use a laptop or desktop computer to continue.
            </p>
            <div className="text-gray-500 text-sm mt-4 pt-4 border-t border-gray-100">
              <p>Detected screen width: {screenWidth}px</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const AppRoutes = () => {
  const { isMobile } = useIsMobile();

  // If on mobile, show restriction message instead of routes
  if (isMobile) {
    return <MobileRestriction />;
  }

  return (
    <Routes>
      <Route path="/" element={<AuthRoute><Login /></AuthRoute>} />
      
      {/* Student Routes - strictly enforce student role */}
      <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/instructions" element={<ProtectedRoute requiredRole="student"><InstructionsPage /></ProtectedRoute>} />
      <Route path="/camera-verification" element={<ProtectedRoute requiredRole="student"><CameraVerificationPage /></ProtectedRoute>} />
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
};

function App() {
  const { isMobile } = useIsMobile();
  
  useEffect(() => {
    // Run database migrations on app load
    runMigrations().then(success => {
      if (success) {
        console.log('Database migrations completed successfully');
      } else {
        console.error('Database migrations failed');
      }
    });
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <AssessmentProvider>
              {isMobile ? (
                <MobileRestriction />
              ) : (
                <>
                  <AppRoutes />
                  <Toaster />
                </>
              )}
            </AssessmentProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
