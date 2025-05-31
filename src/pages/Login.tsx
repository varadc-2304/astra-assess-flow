
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { School, Lock, User } from 'lucide-react';

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 mb-4 transform hover:scale-105 transition-transform duration-300">
            <img 
              src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
              alt="Yudha Logo" 
              className="w-full h-full drop-shadow-md" 
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Yudha</h1>
          <p className="text-gray-600">Login to access your assessments</p>
        </div>
        
        <Card className="border-0 shadow-lg overflow-hidden animate-fade-in">
          <CardHeader className="bg-gradient-to-r from-astra-red to-red-600 text-white">
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              Student Login
            </CardTitle>
            <CardDescription className="text-white/80">
              Enter your credentials to access your assessments.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-email" className="text-gray-700">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <User className="h-4 w-4" />
                  </div>
                  <Input 
                    id="student-email" 
                    type="text" 
                    placeholder="Enter your username" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-gray-50 border-gray-200 focus:border-astra-red focus:ring focus:ring-red-100"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="student-password" className="text-gray-700">Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input 
                    id="student-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-gray-50 border-gray-200 focus:border-astra-red focus:ring focus:ring-red-100"
                    required
                  />
                </div>
              </div>
              
              {loginError && (
                <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-100">
                  {loginError}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-astra-red hover:bg-red-600 text-white shadow-md hover:shadow-lg transition-all" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex flex-col items-center justify-center py-4 bg-gray-50 text-sm text-gray-600">
            <p>Trouble logging in? Contact your administrator</p>
          </CardFooter>
        </Card>
        
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>© {new Date().getFullYear()} Yudha Assessments. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
