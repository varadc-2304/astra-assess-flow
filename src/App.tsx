
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react"; 
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AssessmentProvider } from "./contexts/AssessmentContext";
import { runMigrations } from "./migrations/implementMigrations"; 
import StudentDashboard from "./pages/student/Dashboard";
import InstructionsPage from "./pages/student/InstructionsPage";
import CameraVerificationPage from "./pages/student/CameraVerificationPage";
import AssessmentPage from "./pages/student/AssessmentPage";
import SummaryPage from "./pages/student/SummaryPage";
import NotFound from "./pages/NotFound";
import AutoLogin from "./pages/AutoLogin";
import LoginPage from "./pages/LoginPage";
import { Toaster } from "@/components/ui/toaster";
import { useIsMobile } from "./hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { useToast } from "./hooks/use-toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10 * 1000, // 10 seconds
    },
    mutations: {
      retry: 1,
    }
  }
});

// Protected route component for student routes only
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  // If no user, redirect to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated
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
  return (
    <Routes>
      {/* Default route redirects to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auto-login" element={<AutoLogin />} />
      
      {/* Student Routes */}
      <Route path="/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
      <Route path="/instructions" element={<ProtectedRoute><InstructionsPage /></ProtectedRoute>} />
      <Route path="/camera-verification" element={<ProtectedRoute><CameraVerificationPage /></ProtectedRoute>} />
      <Route path="/assessment" element={<ProtectedRoute><AssessmentPage /></ProtectedRoute>} />
      <Route path="/summary" element={<ProtectedRoute><SummaryPage /></ProtectedRoute>} />
      
      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  const { toast } = useToast();
  
  useEffect(() => {
    // Run database migrations on app load
    runMigrations().then(success => {
      if (success) {
        console.log('Database migrations completed successfully');
      } else {
        console.error('Database migrations failed - face_violations column may not be properly set up');
      }
    }).catch(error => {
      console.error('Error running migrations:', error);
    });
  }, []);
  
  return (
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
}

export default App;
