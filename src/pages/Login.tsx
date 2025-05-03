
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { School, Briefcase } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleLogin = async (role: 'student' | 'admin') => {
    setIsSubmitting(true);
    try {
      await login(email, password, role);
      navigate(role === 'admin' ? '/admin' : '/student');
    } catch (error) {
      // Error is already handled in the Auth context
      console.error('Login error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2 text-astra-red">Yudha</h1>
          <p className="text-gray-500">Login to access your assessments</p>
        </div>
        
        <Tabs defaultValue="student" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="student" className="flex items-center gap-2">
              <School className="h-4 w-4" />
              Student
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Admin
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="student">
            <Card>
              <CardHeader>
                <CardTitle>Student Login</CardTitle>
                <CardDescription>
                  Enter your username and password to access your assessments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); handleLogin('student'); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-email">Username</Label>
                    <Input 
                      id="student-email" 
                      type="text" 
                      placeholder="Username" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-password">Password</Label>
                    <Input 
                      id="student-password" 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Logging in...' : 'Login as Student'}
                  </Button>
                  
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="admin">
            <Card>
              <CardHeader>
                <CardTitle>Admin Login</CardTitle>
                <CardDescription>
                  Enter your admin credentials to manage assessments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); handleLogin('admin'); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">username</Label>
                    <Input 
                      id="admin-email" 
                      type="text" 
                      placeholder="Username" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input 
                      id="admin-password" 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Logging in...' : 'Login as Admin'}
                  </Button>
                  
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Login;
