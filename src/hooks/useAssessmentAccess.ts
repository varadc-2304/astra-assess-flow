
import { useAuth } from '@/contexts/AuthContext';

export const useAssessmentAccess = () => {
  const { user } = useAuth();

  const canAccessAssessment = (assessmentCode: string): boolean => {
    if (!user || !user.assigned_assessments) {
      return false;
    }
    
    return user.assigned_assessments.includes(assessmentCode);
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
