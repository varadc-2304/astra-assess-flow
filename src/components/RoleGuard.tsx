
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface RoleGuardProps {
  allowedRole: 'admin' | 'student';
  children: React.ReactNode;
  fallbackPath?: string;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ 
  allowedRole, 
  children, 
  fallbackPath = '/login' 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // If user is not logged in, redirect to login
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please login to access this page",
        variant: "destructive",
      });
      navigate(fallbackPath);
      return;
    }

    // If user doesn't have required role, redirect based on their role
    if (user.role !== allowedRole) {
      const redirectPath = user.role === 'admin' ? '/admin' : '/student';
      
      toast({
        title: "Access denied",
        description: `You don't have permission to access this page as ${user.role}`,
        variant: "destructive",
      });
      
      navigate(redirectPath);
    }
  }, [user, allowedRole, navigate, fallbackPath, toast]);

  // Only render children if user has the correct role
  if (user && user.role === allowedRole) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
};

export default RoleGuard;
