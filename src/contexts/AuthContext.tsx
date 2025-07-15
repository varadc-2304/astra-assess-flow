
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

type UserData = {
  id: string;
  name: string;
  email: string;
  role: 'student';
  prn?: string;
  year?: string;
  department?: string;
  division?: string;
  batch?: string;
};

interface AuthContextType {
  user: UserData | null;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check for existing login on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if we have user data in localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error("Auth check error:", error);
        // Clear invalid data
        localStorage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Logout function
  const logout = async () => {
    try {
      // Clear localStorage
      localStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, logout, isLoading }}>
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
