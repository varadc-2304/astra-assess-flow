
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { School, Lock, User, Shield } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setLoginError('Please enter both username and password');
      return;
    }
    
    setIsSubmitting(true);
    setLoginError('');
    
    try {
      // Default to student role since admin tab is removed
      await login(email, password, 'student');
      navigate('/student');
    } catch (error: any) {
      // Show error message from Auth context
      setLoginError(error?.message || 'Login failed. Please check your credentials.');
      console.error('Login error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 mb-6 bg-gradient-to-br from-astra-red/10 to-astra-red/5 rounded-full flex items-center justify-center shadow-lg">
            <Shield className="h-10 w-10 text-astra-red" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Assessment Portal</h1>
          <p className="text-gray-600 text-lg">Secure Authentication System</p>
        </div>
        
        <Card className="border-0 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-astra-red to-red-600 text-white py-8">
            <CardTitle className="flex items-center gap-3 text-xl">
              <School className="h-6 w-6" />
              Student Access
            </CardTitle>
            <CardDescription className="text-white/90 text-base">
              Enter your credentials to access your assessments
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-8 pb-6 px-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="student-email" className="text-gray-700 font-medium">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
                    <User className="h-5 w-5" />
                  </div>
                  <Input 
                    id="student-email" 
                    type="text" 
                    placeholder="Enter your username" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 py-3 bg-gray-50 border-gray-200 focus:border-astra-red focus:ring focus:ring-red-100 text-base"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="student-password" className="text-gray-700 font-medium">Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input 
                    id="student-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 py-3 bg-gray-50 border-gray-200 focus:border-astra-red focus:ring focus:ring-red-100 text-base"
                    required
                  />
                </div>
              </div>
              
              {loginError && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                  {loginError}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-astra-red hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all py-3 text-base font-medium" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex flex-col items-center justify-center py-6 bg-gray-50 text-sm text-gray-600 border-t">
            <p className="text-center">Need assistance? Contact your system administrator</p>
          </CardFooter>
        </Card>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Assessment Management System. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
