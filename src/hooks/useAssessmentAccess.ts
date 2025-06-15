
import { useAuth } from '@/contexts/AuthContext';

export const useAssessmentAccess = () => {
  const { user } = useAuth();

  const canAccessAssessment = (assessmentCode: string): boolean => {
    console.log('Checking access for assessment code:', assessmentCode);
    console.log('User assigned assessments:', user?.assigned_assessments);
    
    if (!user || !user.assigned_assessments) {
      console.log('No user or no assigned assessments');
      return false;
    }
    
    // Convert assessment code to uppercase for comparison
    const upperCode = assessmentCode.trim().toUpperCase();
    
    // Check if the assessment code is in the assigned assessments array
    // Handle both string arrays and potential case variations
    const hasAccess = user.assigned_assessments.some(code => 
      code.trim().toUpperCase() === upperCode
    );
    
    console.log('Access result:', hasAccess);
    return hasAccess;
  };

  const getAccessibleAssessmentCodes = (): string[] => {
    if (!user || !user.assigned_assessments) {
      return [];
    }
    
    return user.assigned_assessments;
  };

  return {
    canAccessAssessment,
    getAccessibleAssessmentCodes,
  };
};
