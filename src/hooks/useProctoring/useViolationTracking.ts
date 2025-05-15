
import { useState, useRef, useEffect } from 'react';
import { ProctoringStatus, ViolationType } from './index';

interface UseViolationTrackingProps {
  status: ProctoringStatus;
  trackViolations?: boolean;
}

export const useViolationTracking = ({
  status,
  trackViolations = false
}: UseViolationTrackingProps) => {
  const [violations, setViolations] = useState<Record<ViolationType, number>>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0,
    frequentDisappearance: 0,
    identityMismatch: 0,
  });
  
  // Track continuous time in each status
  const statusTimer = useRef<Record<ProctoringStatus, number>>({
    initializing: 0,
    faceDetected: 0,
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceCovered: 0,
    faceNotCentered: 0,
    rapidMovement: 0,
    error: 0,
  });
  
  // Face disappearance tracking
  const noFaceStartTime = useRef<number | null>(null);
  const disappearanceCount = useRef(0);
  const lastStatus = useRef<ProctoringStatus>(status);
  
  // Increment violation counters based on status
  useEffect(() => {
    if (!trackViolations) return;
    
    // Handle status change for violation tracking
    const handleStatusChange = () => {
      // Update the specific violation counter based on status
      if (status === 'noFaceDetected') {
        // Start timing if face just disappeared
        if (lastStatus.current !== 'noFaceDetected') {
          noFaceStartTime.current = Date.now();
        }
        // Check if face has been gone for over 3 seconds
        else if (noFaceStartTime.current && Date.now() - noFaceStartTime.current > 3000) {
          setViolations(prev => ({
            ...prev,
            noFaceDetected: prev.noFaceDetected + 1,
          }));
          noFaceStartTime.current = Date.now(); // Reset timer but keep tracking
        }
      } 
      else if (status === 'multipleFacesDetected') {
        setViolations(prev => ({
          ...prev,
          multipleFacesDetected: prev.multipleFacesDetected + 1,
        }));
      } 
      else if (status === 'faceNotCentered') {
        setViolations(prev => ({
          ...prev,
          faceNotCentered: prev.faceNotCentered + 1,
        }));
      } 
      else if (status === 'faceCovered') {
        setViolations(prev => ({
          ...prev,
          faceCovered: prev.faceCovered + 1,
        }));
      } 
      else if (status === 'rapidMovement') {
        setViolations(prev => ({
          ...prev,
          rapidMovement: prev.rapidMovement + 1,
        }));
      } 
      else if (status === 'faceDetected') {
        // If face reappeared after being gone
        if (lastStatus.current === 'noFaceDetected') {
          disappearanceCount.current += 1;
          // If face has disappeared and reappeared frequently
          if (disappearanceCount.current > 5) {
            setViolations(prev => ({
              ...prev,
              frequentDisappearance: prev.frequentDisappearance + 1,
            }));
            disappearanceCount.current = 0; // Reset counter after tracking violation
          }
        }
        noFaceStartTime.current = null;
      }
      
      // Update last status
      lastStatus.current = status;
    };
    
    // Call the handler to process the current status
    handleStatusChange();
    
    // Set an interval to continuously check status (for timing-based violations)
    const intervalId = setInterval(handleStatusChange, 1000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [status, trackViolations]);
  
  return { violations };
};
