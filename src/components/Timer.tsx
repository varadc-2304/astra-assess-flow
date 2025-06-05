
import React, { useEffect, useState } from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type TimerProps = {
  variant?: 'countdown' | 'assessment';
  targetTime?: string; // ISO date string for countdown to start time
  onCountdownEnd?: () => void;
  value?: number; // For manually controlled timers (fullscreen warning)
};

export const Timer: React.FC<TimerProps> = ({ 
  variant = 'assessment',
  targetTime,
  onCountdownEnd,
  value
}) => {
  const { timeRemaining, setTimeRemaining, endAssessment } = useAssessment();
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const navigate = useNavigate();
  
  // For countdown timer to assessment start
  useEffect(() => {
    if (variant === 'countdown' && targetTime) {
      const intervalId = setInterval(() => {
        const now = new Date().getTime();
        const target = new Date(targetTime).getTime();
        const distance = target - now;
        
        if (distance <= 0) {
          clearInterval(intervalId);
          setCountdownTime(0);
          if (onCountdownEnd) onCountdownEnd();
        } else {
          setCountdownTime(Math.floor(distance / 1000));
        }
      }, 1000);
      
      return () => clearInterval(intervalId);
    }
  }, [variant, targetTime, onCountdownEnd]);
  
  // For assessment timer countdown
  useEffect(() => {
    if (variant === 'assessment' && timeRemaining > 0) {
      const intervalId = setInterval(() => {
        setTimeRemaining(timeRemaining - 1);
        
        if (timeRemaining <= 1) {
          // End assessment when time runs out
          clearInterval(intervalId);
          endAssessment().then(() => {
            // Navigate to results page after assessment ends
            navigate('/summary');
          }).catch((error) => {
            console.error('Error ending assessment:', error);
          });
        }
      }, 1000);
      
      return () => clearInterval(intervalId);
    }
  }, [variant, timeRemaining, setTimeRemaining, endAssessment, navigate]);
  
  // Format seconds to hh:mm:ss
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };
  
  // Calculate warning thresholds
  const getColorClass = (): string => {
    if (variant === 'assessment') {
      if (timeRemaining <= 300) return 'text-red-500'; // Last 5 minutes
      if (timeRemaining <= 600) return 'text-orange-500'; // Last 10 minutes
    }
    return 'text-astra-darkGray';
  };
  
  // Determine what time to display
  const displayTime = variant === 'countdown' 
    ? (countdownTime !== null ? formatTime(countdownTime) : '--:--:--')
    : value !== undefined ? formatTime(value) : formatTime(timeRemaining);
  
  return (
    <div className={`flex items-center gap-2 font-mono text-lg font-bold ${getColorClass()}`}>
      <Clock className="h-5 w-5" />
      <span>{displayTime}</span>
    </div>
  );
};
