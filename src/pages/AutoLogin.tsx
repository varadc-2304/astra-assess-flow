
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const AutoLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing auto-login...');

  useEffect(() => {
    const handleAutoLogin = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid auto-login link - missing token');
        return;
      }

      try {
        console.log('Processing auto-login with token:', token);

        // Verify token and get user info
        const { data: tokenData, error: tokenError } = await supabase
          .from('auto_login_tokens')
          .select('user_id, expires_at, used')
          .eq('token', token)
          .single();

        if (tokenError || !tokenData) {
          console.error('Token verification failed:', tokenError);
          setStatus('error');
          setMessage('Invalid or expired auto-login token');
          return;
        }

        // Check if token is expired
        if (new Date(tokenData.expires_at) < new Date()) {
          console.log('Token expired');
          setStatus('error');
          setMessage('Auto-login token has expired');
          return;
        }

        // Check if token was already used
        if (tokenData.used) {
          console.log('Token already used');
          setStatus('error');
          setMessage('Auto-login token has already been used');
          return;
        }

        // Mark token as used
        await supabase
          .from('auto_login_tokens')
          .update({ used: true })
          .eq('token', token);

        // Get user data from auth table
        const { data: userData, error: userError } = await supabase
          .from('auth')
          .select('*')
          .eq('id', tokenData.user_id)
          .single();

        if (userError || !userData) {
          console.error('User data fetch failed:', userError);
          setStatus('error');
          setMessage('User not found');
          return;
        }

        console.log('Auto-login successful for user:', userData.email);

        // Store user data in localStorage (matching the login function format)
        const userDataObj = {
          id: userData.id,
          name: userData.name || '',
          email: userData.email,
          role: userData.role,
          prn: userData.prn || undefined,
          year: userData.year || undefined,
          department: userData.department || undefined,
          division: userData.division || undefined,
          batch: userData.batch || undefined,
        };

        localStorage.setItem('user', JSON.stringify(userDataObj));

        setStatus('success');
        setMessage('Auto-login successful! Redirecting...');

        // Redirect based on user role
        setTimeout(() => {
          if (userData.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/student');
          }
        }, 1500);

      } catch (error) {
        console.error('Auto-login error:', error);
        setStatus('error');
        setMessage('An error occurred during auto-login');
      }
    };

    // Don't redirect if user is already logged in - let auto-login process complete
    // This allows external clients to use auto-login even if there's an existing session
    handleAutoLogin();
  }, [searchParams, navigate]);

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-24 h-24 mb-4">
            <img 
              src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
              alt="Yudha Logo" 
              className="w-full h-full drop-shadow-md" 
            />
          </div>
          <CardTitle className={`text-xl ${getStatusColor()}`}>
            Auto Login
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="flex justify-center">
            {getIcon()}
          </div>
          <p className="text-gray-600">{message}</p>
          {status === 'error' && (
            <div className="pt-4">
              <button 
                onClick={() => navigate('/')}
                className="bg-astra-red hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
              >
                Go to Login Page
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoLogin;
