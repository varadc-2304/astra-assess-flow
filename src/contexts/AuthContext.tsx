
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

type UserRole = 'student' | 'admin';

type UserData = {
  id: string;
  name: string;
  email: string;
  prn: string | null;
  role: UserRole;
};

interface AuthContextType {
  user: UserData | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const fetchUserData = async (email: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  };

  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      // First check if user exists in our users table
      const userData = await fetchUserData(email);
      
      if (!userData) {
        throw new Error('User not found');
      }
      
      if (userData.password !== password) {
        throw new Error('Invalid password');
      }

      // Map the database role (user/admin) to our app roles (student/admin)
      const appRole: UserRole = userData.role === 'user' ? 'student' : 'admin';

      setUser({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        prn: userData.prn,
        role: appRole
      });

      // Create a mock session that matches the Session type
      const mockSession = {
        access_token: `mock_token_${userData.id}`,
        refresh_token: `mock_refresh_${userData.id}`,
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: userData.id,
          email: userData.email,
          user_metadata: {
            name: userData.name,
            role: appRole
          }
        }
      } as unknown as Session;
      
      setSession(mockSession);

      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.name}!`,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);
    try {
      setUser(null);
      setSession(null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error logging out",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
