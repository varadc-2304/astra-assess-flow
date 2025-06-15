
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AutoLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Crafting your experience...');

  useEffect(() => {
    const handleAutoLogin = async () => {
      const token = searchParams.get('token');

      if (!token) {
        console.log('No token provided, redirecting to external site');
        window.location.href = 'https://ikshvaku-innovations.in';
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
          window.location.href = 'https://ikshvaku-innovations.in';
          return;
        }

        console.log('Token data received:', tokenData);

        // Check if token is expired
        if (new Date(tokenData.expires_at) < new Date()) {
          console.log('Token expired');
          window.location.href = 'https://ikshvaku-innovations.in';
          return;
        }

        // Check if token was already used
        if (tokenData.used) {
          console.log('Token already used');
          window.location.href = 'https://ikshvaku-innovations.in';
          return;
        }

        // Mark token as used
        await supabase
          .from('auto_login_tokens')
          .update({ used: true })
          .eq('token', token);

        console.log('Looking for user with ID:', tokenData.user_id);

        // Get user data from auth table
        const { data: userData, error: userError } = await supabase
          .from('auth')
          .select('*')
          .eq('id', tokenData.user_id)
          .single();

        if (userError || !userData) {
          console.error('User data fetch failed:', userError);
          console.error('Failed to find user with ID:', tokenData.user_id);
          
          // Try to get user data from users table as fallback
          const { data: fallbackUserData, error: fallbackError } = await supabase
            .from('users')
            .select('*')
            .eq('id', tokenData.user_id)
            .single();
          
          if (fallbackError || !fallbackUserData) {
            console.error('Fallback user data fetch also failed:', fallbackError);
            window.location.href = 'https://ikshvaku-innovations.in';
            return;
          }
          
          console.log('Using fallback user data:', fallbackUserData);
          
          // Store fallback user data in localStorage
          const userDataObj = {
            id: fallbackUserData.id,
            name: fallbackUserData.username || fallbackUserData.email?.split('@')[0] || '',
            email: fallbackUserData.email,
            role: 'student' as const,
            prn: fallbackUserData.prn || undefined,
            year: undefined,
            department: fallbackUserData.department || undefined,
            division: undefined,
            batch: undefined,
            assignedAssessments: (fallbackUserData as any).assigned_assessments || [],
          };

          localStorage.setItem('user', JSON.stringify(userDataObj));
          navigate('/student', { replace: true });
          return;
        }

        console.log('Auto-login successful for user:', userData.email);

        // Store user data in localStorage
        const userDataObj = {
          id: userData.id,
          name: userData.name || userData.username || userData.email?.split('@')[0] || '',
          email: userData.email,
          role: 'student' as const,
          prn: userData.prn || undefined,
          year: userData.year || undefined,
          department: userData.department || undefined,
          division: userData.division || undefined,
          batch: userData.batch || undefined,
          assignedAssessments: userData.assigned_assessments || [],
        };

        localStorage.setItem('user', JSON.stringify(userDataObj));

        // Redirect to student dashboard
        navigate('/student', { replace: true });

      } catch (error) {
        console.error('Auto-login error:', error);
        window.location.href = 'https://ikshvaku-innovations.in';
      }
    };

    handleAutoLogin();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-lg text-gray-600 animate-pulse">{message}</p>
      </div>
    </div>
  );
};

export default AutoLogin;
