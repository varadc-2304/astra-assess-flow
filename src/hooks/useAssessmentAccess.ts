
import { useAuth } from '@/contexts/AuthContext';

export const useAssessmentAccess = () => {
  const { user } = useAuth();

  const canAccessAssessment = (assessmentCode: string): boolean => {
    if (!user || !user.assignedAssessments) {
      return false;
    }
    
    return user.assignedAssessments.includes(assessmentCode);
  };

  const getAccessibleAssessments = (): string[] => {
    return user?.assignedAssessments || [];
  };

  return {
    canAccessAssessment,
    getAccessibleAssessments,
    assignedAssessments: user?.assignedAssessments || []
  };
};
