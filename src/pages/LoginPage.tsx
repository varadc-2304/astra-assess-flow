
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  
  // Change password form state
  const [changeEmail, setChangeEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Call the authenticate edge function
      const { data, error } = await supabase.functions.invoke('authenticate', {
        body: { email, password }
      });

      if (error || !data.success) {
        toast({
          title: 'Login Failed',
          description: data?.error || 'Invalid email or password',
          variant: 'destructive',
        });
        return;
      }

      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));

      // Show success message
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });

      // Navigate immediately without delay for better mobile experience
      navigate('/student', { replace: true });

    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Login Failed',
        description: 'An error occurred during login',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);

    try {
      // First verify the current credentials
      const { data: authData, error: authError } = await supabase
        .from('auth')
        .select('*')
        .eq('email', changeEmail)
        .eq('password', currentPassword)
        .single();

      if (authError || !authData) {
        toast({
          title: 'Verification Failed',
          description: 'Invalid email or current password',
          variant: 'destructive',
        });
        return;
      }

      // Update the password
      const { error: updateError } = await supabase
        .from('auth')
        .update({ password: newPassword })
        .eq('email', changeEmail);

      if (updateError) {
        toast({
          title: 'Update Failed',
          description: 'Failed to update password',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully updated',
      });

      // Reset form and go back to login
      setChangeEmail('');
      setCurrentPassword('');
      setNewPassword('');
      setShowChangePassword(false);

    } catch (error) {
      console.error('Change password error:', error);
      toast({
        title: 'Update Failed',
        description: 'An error occurred while updating password',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (showChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="changeEmail">Email</Label>
                <Input
                  id="changeEmail"
                  type="email"
                  value={changeEmail}
                  onChange={(e) => setChangeEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Enter new password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isChangingPassword}>
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowChangePassword(false)}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={() => setShowChangePassword(true)}
            >
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
