
import React, { createContext, useContext, useState } from 'react';

// Define the Assessment type to match what's being used in the project
export interface Assessment {
  id: string;
  name: string;
  durationMinutes: number;
  questions?: any[];
  code?: string;
}

// Define the context type to include the loading and error states
export interface AssessmentContextType {
  assessment: Assessment | null;
  loading: boolean;
  error: string | null;
  fetchAssessment: (code: string) => Promise<void>;
  // Add any other methods that might be needed
}

// Create the context with default values
const AssessmentContext = createContext<AssessmentContextType>({
  assessment: null,
  loading: false,
  error: null,
  fetchAssessment: async () => {},
});

// Provider component
export const AssessmentProvider = ({ children }: { children: React.ReactNode }) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch assessment data
  const fetchAssessment = async (code: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Mock API call - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock assessment data
      const mockAssessment: Assessment = {
        id: '1',
        name: 'JavaScript Fundamentals',
        durationMinutes: 60,
        questions: Array(10).fill({}),
        code: code
      };
      
      setAssessment(mockAssessment);
    } catch (err) {
      console.error('Error fetching assessment:', err);
      setError('Failed to load assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    assessment,
    loading,
    error,
    fetchAssessment
  };

  return (
    <AssessmentContext.Provider value={value}>
      {children}
    </AssessmentContext.Provider>
  );
};

// Custom hook for using the assessment context
export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};
