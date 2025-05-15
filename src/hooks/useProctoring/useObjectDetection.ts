
import { useState, useRef, useCallback, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export type ObjectViolationType = 'phoneDetected' | 'multiplePersonsDetected' | 'unknownObjectDetected';

interface UseObjectDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isRunningRef: React.RefObject<boolean>;
  isCameraReady: boolean;
  isModelLoaded: boolean;
  trackViolations?: boolean;
}

export const useObjectDetection = ({
  videoRef,
  canvasRef,
  isRunningRef,
  isCameraReady,
  isModelLoaded,
  trackViolations = false
}: UseObjectDetectionProps) => {
  const [objectViolations, setObjectViolations] = useState<Record<ObjectViolationType, number>>({
    phoneDetected: 0,
    multiplePersonsDetected: 0,
    unknownObjectDetected: 0
  });
  
  const [isPhoneDetected, setIsPhoneDetected] = useState(false);
  const detectionIntervalRef = useRef<number | null>(null);
  
  // Track when violations were last recorded (for cooldown)
  const lastViolationTimeRef = useRef<Record<ObjectViolationType, number>>({
    phoneDetected: 0,
    multiplePersonsDetected: 0,
    unknownObjectDetected: 0
  });
  
  // Record object violation with 60-second cooldown
  const recordObjectViolation = useCallback((violationType: ObjectViolationType) => {
    if (trackViolations) {
      const now = Date.now();
      // Only record a violation if 60 seconds have passed since the last one of this type
      if (now - lastViolationTimeRef.current[violationType] >= 60000) {
        setObjectViolations(prev => ({
          ...prev,
          [violationType]: prev[violationType] + 1
        }));
        
        // Update the last violation time for this type
        lastViolationTimeRef.current[violationType] = now;
        return true;
      }
    }
    return false;
  }, [trackViolations]);
  
  // Detect objects that shouldn't be present during an assessment
  const detectObjects = useCallback(async () => {
    if (!videoRef.current || !isRunningRef.current || !isCameraReady || !isModelLoaded) {
      return;
    }
    
    try {
      const video = videoRef.current;
      
      // Use faceapi's person detection to count people
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();
      
      // Check if multiple people are detected
      if (detections.length > 1) {
        recordObjectViolation('multiplePersonsDetected');
      }
      
      // Note: For actual phone detection, we would need to integrate a more specialized
      // object detection model like TensorFlow.js with COCO-SSD or a custom model.
      // For now, we'll simulate phone detection based on certain patterns
      
      // This is a placeholder for actual phone detection logic
      // In a real implementation, you'd use a proper object detection model
      const simulatePhoneDetection = () => {
        // For demo purposes: detect phone every ~20 calls randomly
        const randomDetect = Math.random() < 0.05;
        if (randomDetect) {
          setIsPhoneDetected(true);
          recordObjectViolation('phoneDetected');
          
          // Reset after 3 seconds
          setTimeout(() => {
            setIsPhoneDetected(false);
          }, 3000);
        }
      };
      
      simulatePhoneDetection();
      
    } catch (error) {
      console.error('Error in object detection:', error);
    }
  }, [videoRef, isRunningRef, isCameraReady, isModelLoaded, recordObjectViolation]);
  
  // Start object detection loop
  useEffect(() => {
    if (isCameraReady && isModelLoaded && isRunningRef.current && trackViolations) {
      // Run detection at regular intervals (less frequently than face detection)
      if (!detectionIntervalRef.current) {
        detectionIntervalRef.current = window.setInterval(detectObjects, 2000);
      }
      
      return () => {
        if (detectionIntervalRef.current) {
          window.clearInterval(detectionIntervalRef.current);
          detectionIntervalRef.current = null;
        }
      };
    }
  }, [isCameraReady, isModelLoaded, detectObjects, trackViolations]);
  
  return { objectViolations, isPhoneDetected };
};
