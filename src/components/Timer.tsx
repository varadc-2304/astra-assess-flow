
import React, { useState, useEffect } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';

interface TimerProps {
  variant: 'assessment' | 'countdown';
  startTime?: number;
}

export const Timer: React.FC<TimerProps> = ({ variant, startTime }) => {
  const { timeRemaining, setTimeRemaining, endAssessment, assessment } = useAssessment();
  const [duration, setDuration] = useState(startTime || 0);

  useEffect(() => {
    if (variant === 'countdown' && startTime) {
      setDuration(startTime);
      setTimeRemaining(startTime);
    }
  }, [variant, startTime, setTimeRemaining]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (variant === 'assessment' && assessment) {
      setTimeRemaining(assessment.durationMinutes * 60);
    }

    if (timeRemaining > 0) {
      intervalId = setInterval(() => {
        // Fix: Pass a number directly rather than using a callback function
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
    } else if (timeRemaining === 0 && variant === 'assessment') {
      // Ensure endAssessment is a function before calling it
      if (endAssessment && typeof endAssessment === 'function') {
        endAssessment();
      }
    }

    return () => clearInterval(intervalId);
  }, [timeRemaining, setTimeRemaining, endAssessment, variant, assessment]);

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <span>{formatTime(timeRemaining)}</span>
  );
};
