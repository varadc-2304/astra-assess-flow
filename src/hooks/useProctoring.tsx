
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCameraSetup } from './useProctoring/useCameraSetup';
import { useFaceDetection } from './useProctoring/useFaceDetection';
import { useObjectDetection } from './useProctoring/useObjectDetection';

export type ViolationType = 
  | 'noFaceDetected'
  | 'multipleFacesDetected'
  | 'faceNotCentered'
  | 'faceCovered'
  | 'rapidMovement'
  | 'frequentDisappearance'
  | 'identityMismatch';

export type ObjectViolationType =
  | 'phoneDetected'
  | 'multiplePersonsDetected'
  | 'unknownObjectDetected';

export type ProctoringStatus =
  | 'initializing'
  | 'noFaceDetected'
  | 'faceDetected'
  | 'multipleFacesDetected'
  | 'faceCovered'
  | 'faceNotCentered'
  | 'rapidMovement'
  | 'error';

export type ProctoringOptions = {
  showDebugInfo?: boolean;
  drawLandmarks?: boolean;
  drawExpressions?: boolean;
  detectExpressions?: boolean;
  trackViolations?: boolean;
  detectionOptions?: {
    faceDetectionThreshold?: number;
    faceCenteredTolerance?: number;
    rapidMovementThreshold?: number;
  };
  autoStart?: boolean; // Added this option
};

export const useProctoring = ({
  showDebugInfo = false,
  drawLandmarks = false,
  drawExpressions = false,
  detectExpressions = false,
  trackViolations = false,
  detectionOptions = {},
  autoStart = true, // Default to true for backward compatibility
}: ProctoringOptions = {}) => {
  // Setup camera
  const {
    videoRef,
    canvasRef,
    isCameraReady,
    error: cameraError,
    switchCamera,
    startCamera,
    stopCamera,
  } = useCameraSetup();

  // Face detection
  const {
    isModelLoaded: isFaceModelLoaded,
    isInitializing: isFaceInitializing,
    status,
    violations,
    startFaceDetection,
    stopFaceDetection,
    error: faceDetectionError,
  } = useFaceDetection({
    videoRef,
    canvasRef,
    showDebugInfo,
    drawLandmarks,
    drawExpressions,
    detectExpressions,
    trackViolations,
    ...detectionOptions
  });

  // Object detection
  const {
    isModelLoaded: isObjectModelLoaded,
    isInitializing: isObjectInitializing,
    objectViolations,
    isPhoneDetected,
    startObjectDetection,
    stopObjectDetection,
    error: objectDetectionError,
  } = useObjectDetection({
    videoRef,
    canvasRef,
    trackViolations,
  });

  // Combined state
  const [isInitializing, setIsInitializing] = useState(true);
  const hasInitialized = useRef(false);

  // Initialize detection if autoStart is true
  useEffect(() => {
    if (autoStart && !hasInitialized.current) {
      initialize();
      hasInitialized.current = true;
    } else {
      setIsInitializing(false);
    }
  }, [autoStart]);

  // Initialize function
  const initialize = useCallback(async () => {
    setIsInitializing(true);
    try {
      await startCamera();
      await startFaceDetection();
      await startObjectDetection();
    } catch (err) {
      console.error("Failed to initialize proctoring:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [startCamera, startFaceDetection, startObjectDetection]);

  // Reinitialize function
  const reinitialize = useCallback(async () => {
    setIsInitializing(true);
    try {
      stopFaceDetection();
      stopObjectDetection();
      stopCamera();
      
      await startCamera();
      await startFaceDetection();
      await startObjectDetection();
    } catch (err) {
      console.error("Failed to reinitialize proctoring:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [
    startCamera, 
    startFaceDetection, 
    startObjectDetection, 
    stopCamera, 
    stopFaceDetection, 
    stopObjectDetection
  ]);

  // Stop detection
  const stopDetection = useCallback(() => {
    stopFaceDetection();
    stopObjectDetection();
    stopCamera();
  }, [stopFaceDetection, stopObjectDetection, stopCamera]);

  // Return combined state and functions
  return {
    videoRef,
    canvasRef,
    status,
    violations,
    objectViolations,
    isPhoneDetected,
    isCameraReady,
    isModelLoaded: isFaceModelLoaded && isObjectModelLoaded,
    isInitializing: isInitializing || isFaceInitializing || isObjectInitializing,
    error: cameraError || faceDetectionError || objectDetectionError,
    switchCamera,
    initialize,
    reinitialize,
    stopDetection,
  };
};
