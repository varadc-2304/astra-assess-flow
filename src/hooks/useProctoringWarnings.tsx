
import { useState, useCallback } from 'react';

export interface ProctoringWarningData {
  type: string;
  message: string;
  timestamp: number;
  isActive: boolean;
}

export function useProctoringWarnings() {
  const [warning, setWarning] = useState<ProctoringWarningData | null>(null);

  const showWarning = useCallback((type: string, message: string) => {
    setWarning({
      type,
      message,
      timestamp: Date.now(),
      isActive: true
    });
  }, []);

  const dismissWarning = useCallback(() => {
    setWarning(null);
  }, []);

  return {
    warning,
    showWarning,
    dismissWarning
  };
}
