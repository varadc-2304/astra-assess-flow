
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const AutoLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing auto-login...');

  useEffect(() => {
    const processAutoLogin = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          setStatus('error');
          setMessage('Invalid auto-login link');
          return;
        }

        console.log('Processing auto-login with token:', token);

        // Verify and use the token
        const { data: tokenData, error: tokenError } = await supabase
          .from('auto_login_tokens')
          .select('user_id, expires_at, used')
          .eq('token', token)
          .single();

        if (tokenError || !tokenData) {
          console.error('Token verification error:', tokenError);
          setStatus('error');
          setMessage('Invalid or expired auto-login token');
          return;
        }

        // Check if token is already used
        if (tokenData.used) {
          setStatus('error');
          setMessage('Auto-login token has already been used');
          return;
        }

        // Check if token is expired
        if (new Date(tokenData.expires_at) < new Date()) {
          setStatus('error');
          setMessage('Auto-login token has expired');
          return;
        }

        // Get user data
        const { data: userData, error: userError } = await supabase
          .from('auth')
          .select('email, password, role')
          .eq('id', tokenData.user_id)
          .single();

        if (userError || !userData) {
          console.error('User data error:', userError);
          setStatus('error');
          setMessage('User not found');
          return;
        }

        // Mark token as used
        await supabase
          .from('auto_login_tokens')
          .update({ used: true })
          .eq('token', token);

        console.log('Auto-login successful, logging in user:', userData.email);

        // Login the user
        await login(userData.email, userData.password, userData.role as 'student' | 'admin');
        
        setStatus('success');
        setMessage('Auto-login successful! Redirecting...');
        
        // Redirect based on role
        setTimeout(() => {
          if (userData.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/student');
          }
        }, 2000);

      } catch (error) {
        console.error('Auto-login process error:', error);
        setStatus('error');
        setMessage('An error occurred during auto-login');
      }
    };

    processAutoLogin();
  }, [searchParams, login, navigate]);

  const getIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 mb-4">
            <img 
              src="/lovable-uploads/75631a95-2bc5-4c66-aa10-729af5a22292.png" 
              alt="Yudha Logo" 
              className="w-full h-full drop-shadow-md" 
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Yudha Auto-Login</h1>
        </div>
        
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {getIcon()}
              Auto-Login Process
            </CardTitle>
          </CardHeader>
          
          <CardContent className="text-center">
            <p className={`text-lg ${getStatusColor()}`}>
              {message}
            </p>
            
            {status === 'error' && (
              <div className="mt-4">
                <button
                  onClick={() => navigate('/login')}
                  className="bg-astra-red hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
                >
                  Go to Login Page
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AutoLogin;
