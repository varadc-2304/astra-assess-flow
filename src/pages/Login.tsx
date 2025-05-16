
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { School, Lock, User, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleLogin = async () => {
    setIsSubmitting(true);
    try {
      // Default to student role since admin tab is removed
      await login(email, password, 'student');
      navigate('/student');
    } catch (error) {
      // Error is already handled in the Auth context
      console.error('Login error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md p-4 animate-fade-in">
        <div className="text-center mb-8">
          <div className="relative mx-auto w-28 h-28 mb-6">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-red-600 rounded-full opacity-70 blur-sm animate-pulse"></div>
            <div className="relative flex items-center justify-center w-full h-full bg-white dark:bg-gray-900 rounded-full shadow-lg overflow-hidden p-2 border border-gray-100 dark:border-gray-800">
              <img 
                src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
                alt="Yudha Logo" 
                className="w-20 h-20 object-contain" 
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Yudha Assessment</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Enter your credentials to access your assessments and tests
          </p>
        </div>
        
        <Card className="overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white dark:bg-gray-900">
          <CardHeader className="bg-gradient-to-r from-astra-red to-red-600 text-white py-5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <School className="h-5 w-5" />
              Student Login
            </CardTitle>
            <CardDescription className="text-white/90">
              Enter your username and password to access your assessments.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-email" className="text-sm font-medium">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User className="h-4 w-4" />
                  </div>
                  <Input 
                    id="student-email" 
                    type="text" 
                    placeholder="Enter your username" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="student-password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input 
                    id="student-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className={cn(
                  "w-full mt-6 bg-astra-red hover:bg-red-600 text-white shadow-lg shadow-red-500/20",
                  "transition-all transform hover:translate-y-[-2px]",
                  "flex items-center justify-center gap-2"
                )}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </form>
            
            <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Having trouble logging in? Contact your administrator
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} Yudha Assessment Portal. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;
