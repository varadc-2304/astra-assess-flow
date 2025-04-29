
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Auth } from '@/types/database';

type UserRole = 'student' | 'admin';

type UserData = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  prn?: string;
  year?: string;
  department?: string;
  division?: string;
  batch?: string;
};

interface AuthContextType {
  user: UserData | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  // Check for existing login on mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        // Check if we have user data in localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    
    try {
      // Check if user exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('auth')
        .select('*')
        .eq('email', email);
        
      if (checkError) throw checkError;
      
      let userId: string;
      
      if (!existingUsers || existingUsers.length === 0) {
        // Create new user if doesn't exist
        const { data: newUser, error: createError } = await supabase
          .from('auth')
          .insert({
            email,
            password,
            role,
            name: email.split('@')[0] // Simple name extraction from email
          })
          .select()
          .single();
          
        if (createError) throw createError;
        userId = newUser.id;
      } else {
        const user = existingUsers[0];
        
        // Verify password (simple comparison for demo)
        if (user.password !== password) {
          throw new Error('Invalid email or password');
        }
        
        // Check role - strict validation to ensure the role matches exactly
        if (user.role !== role) {
          throw new Error(`This account is not registered as a ${role}`);
        }
        
        userId = user.id;
      }
      
      // Get user data to set in state
      const { data: userData, error: fetchError } = await supabase
        .from('auth')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (fetchError) throw fetchError;
      
      const userDataObj: UserData = {
        id: userData.id,
        name: userData.name || '',
        email: userData.email,
        role: userData.role as UserRole,
        prn: userData.prn || undefined,
        year: userData.year || undefined,
        department: userData.department || undefined,
        division: userData.division || undefined,
        batch: userData.batch || undefined,
      };
      
      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(userDataObj));
      setUser(userDataObj);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.name || userData.email}!`,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
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
      // Clear localStorage
      localStorage.removeItem('user');
      setUser(null);
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
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
