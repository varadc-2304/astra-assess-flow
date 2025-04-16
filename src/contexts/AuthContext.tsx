
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

type UserRole = 'student' | 'admin';

type UserData = {
  id: string;
  name: string;
  email: string;
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

  // Initialize auth state from supabase
  useEffect(() => {
    // First set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        
        // Map Supabase user to our UserData type
        if (currentSession?.user) {
          // For demo, we're mapping specific emails to roles
          // In production, this would come from a user_roles table
          const email = currentSession.user.email || '';
          const role: UserRole = email.includes('admin') ? 'admin' : 'student';
          
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            name: currentSession.user.user_metadata.name || email.split('@')[0],
            role: role
          });
        } else {
          setUser(null);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      
      // Map Supabase user to our UserData type
      if (currentSession?.user) {
        // For demo, we're mapping specific emails to roles
        // In production, this would come from a user_roles table
        const email = currentSession.user.email || '';
        const role: UserRole = email.includes('admin') ? 'admin' : 'student';
        
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email || '',
          name: currentSession.user.user_metadata.name || email.split('@')[0],
          role: role
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Login function - handles both demo login and regular login
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      console.log("Attempting login with:", email, password);
      
      // Handle demo credentials specifically
      if ((email === 'student@example.com' || email === 'admin@example.com') && password === 'password') {
        console.log("Demo credentials detected");
        
        // First try to sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        console.log("Sign in result:", { data, error });
        
        // If login fails for demo user, create the account first
        if (error) {
          console.log("Creating demo account");
          // Create the demo user
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name: email === 'admin@example.com' ? 'Admin User' : 'Student User',
              }
            }
          });
          
          console.log("Sign up result:", { signUpData, signUpError });
          
          if (signUpError) {
            throw signUpError;
          }
          
          // Try to login again after account creation
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          console.log("Second sign in result:", { loginData, loginError });
          
          if (loginError) {
            throw loginError;
          }
          
          toast({
            title: "Demo account created",
            description: "Successfully created demo account and logged you in",
          });
          
          return;
        }
        
        toast({
          title: "Demo login successful",
          description: `Welcome to AstraAssessments, ${email === 'admin@example.com' ? 'Admin' : 'Student'}!`,
        });
        
        return;
      }
      
      // Regular login for non-demo accounts
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user?.email}!`,
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
      await supabase.auth.signOut();
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
