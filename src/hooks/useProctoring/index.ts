
import { useState, useCallback } from 'react';
import { useCameraSetup } from './useCameraSetup';
import { useFaceDetection, ProctoringStatus, ViolationType, DetectionOptions } from './useFaceDetection';
import { useObjectDetection, ObjectViolationType } from './useObjectDetection';

export type { ProctoringStatus, ViolationType, ObjectViolationType, DetectionOptions };

export interface UseProctoringOptions {
  autoStart?: boolean;
  trackViolations?: boolean;
  showDebugInfo?: boolean;
  drawLandmarks?: boolean;
  drawExpressions?: boolean;
  detectExpressions?: boolean;
  detectionOptions?: DetectionOptions;
}

export const useProctoring = ({
  autoStart = false,
  trackViolations = false,
  showDebugInfo = false,
  drawLandmarks = false,
  drawExpressions = false,
  detectExpressions = false,
  detectionOptions = {}
}: UseProctoringOptions = {}) => {
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  // Setup camera and base detection
  const {
    videoRef,
    canvasRef,
    isCameraReady,
    isModelLoaded,
    isInitializing,
    error,
    isRunningRef,
    initialize,
    switchCamera,
    stopDetection
  } = useCameraSetup({ autoStart });
  
  // Face detection
  const { status, violations } = useFaceDetection({
    videoRef,
    canvasRef,
    isRunningRef,
    isCameraReady,
    isModelLoaded,
    trackViolations,
    detectionOptions
  });
  
  // Object detection
  const { objectViolations, isPhoneDetected } = useObjectDetection({
    videoRef,
    canvasRef,
    isRunningRef,
    isCameraReady,
    isModelLoaded,
    trackViolations
  });
  
  // Re-initialize camera and detection
  const reinitialize = useCallback(async () => {
    setDebugInfo('Reinitializing...');
    await initialize();
  }, [initialize]);
  
  return {
    videoRef,
    canvasRef,
    status,
    violations,
    objectViolations,
    isCameraReady,
    isModelLoaded,
    isInitializing,
    isPhoneDetected,
    error,
    debugInfo,
    initialize,
    reinitialize,
    switchCamera,
    stopDetection
  };
};
