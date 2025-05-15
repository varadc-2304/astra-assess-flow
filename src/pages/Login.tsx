
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { School, Loader2, Lock, User } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) return;
    
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto w-24 h-24 mb-4 relative">
            <AspectRatio ratio={1/1} className="overflow-hidden rounded-xl shadow-lg bg-white dark:bg-gray-800 p-2">
              <img 
                src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
                alt="Yudha Logo" 
                className="w-full h-full object-contain animate-scale" 
              />
            </AspectRatio>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Yudha Assessment</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Login to access your assessments</p>
        </div>
        
        <Card className="border-gray-200 dark:border-gray-700 shadow-xl animate-fade-in">
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
              <School className="h-5 w-5 text-blue-500" />
              Student Login
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your assessments
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-5">
              <div className="space-y-2">
                <Label htmlFor="student-email" className="text-gray-700 dark:text-gray-300">Username</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <User className="h-4 w-4" />
                  </div>
                  <Input 
                    id="student-email" 
                    type="text" 
                    placeholder="Enter your username" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-password" className="text-gray-700 dark:text-gray-300">Password</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input 
                    id="student-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                    required
                  />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex-col space-y-2 pt-0">
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all shadow hover:shadow-md"
                disabled={isSubmitting || !email || !password}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {isSubmitting ? "Logging in..." : "Login"}
              </Button>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                For technical support, please contact your administrator
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
