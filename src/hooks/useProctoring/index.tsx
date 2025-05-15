
import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useDetectionOptions } from './useDetectionOptions';
import { useFaceDetection } from './useFaceDetection';
import { useCameraSetup } from './useCameraSetup';
import { useViolationTracking } from './useViolationTracking';
import { useModelLoading } from './useModelLoading';
import { useFaceRenderer } from './useFaceRenderer';

export type ProctoringStatus =
  | 'initializing'
  | 'faceDetected'
  | 'noFaceDetected'
  | 'multipleFacesDetected'
  | 'faceCovered'
  | 'faceNotCentered'
  | 'rapidMovement'
  | 'error';

export type ViolationType =
  | 'noFaceDetected'
  | 'multipleFacesDetected'
  | 'faceNotCentered'
  | 'faceCovered'
  | 'rapidMovement'
  | 'frequentDisappearance'
  | 'identityMismatch';

export interface ProctoringOptions {
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
}

export const useProctoring = (options: ProctoringOptions = {}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoStream = useRef<MediaStream | null>(null);
  
  const [status, setStatus] = useState<ProctoringStatus>('initializing');
  const { detectionOptions } = useDetectionOptions(options);
  
  // Setup model loading
  const { 
    isModelLoaded, 
    loadModels,
    modelsLoading
  } = useModelLoading();
  
  // Setup camera
  const {
    isCameraReady,
    isInitializing,
    setupCamera,
    stopCamera,
    switchCamera
  } = useCameraSetup({ videoRef, videoStream });
  
  // Setup face detection
  const { 
    handleVideoOnPlay, 
    startFaceDetection, 
    stopFaceDetection,
    faceDetectionActive,
  } = useFaceDetection({
    videoRef,
    canvasRef,
    detectionOptions,
    setStatus,
    isModelLoaded,
    options
  });
  
  // Setup violation tracking
  const { violations } = useViolationTracking({
    status,
    trackViolations: options.trackViolations
  });

  useEffect(() => {
    if (videoRef.current && isCameraReady && isModelLoaded) {
      startFaceDetection();
    }
    
    return () => {
      stopFaceDetection();
    };
  }, [isCameraReady, isModelLoaded, startFaceDetection, stopFaceDetection]);
  
  const reinitialize = useCallback(async () => {
    // Stop any existing camera and detection
    stopFaceDetection();
    stopCamera();
    
    setStatus('initializing');
    
    // Reload models if needed
    if (!isModelLoaded && !modelsLoading) {
      await loadModels();
    }
    
    // Setup camera
    await setupCamera();
  }, [loadModels, setupCamera, stopCamera, stopFaceDetection, isModelLoaded, modelsLoading]);
  
  // Initialize on mount
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        await loadModels();
        if (isMounted) {
          console.log("Models loaded, initializing camera...");
          await setupCamera();
        }
      } catch (error) {
        console.error("Error during initialization:", error);
        if (isMounted) {
          setStatus('error');
        }
      }
    };
    
    return () => {
      isMounted = false;
      stopFaceDetection();
      stopCamera();
    };
  }, []);
  
  const stopDetection = useCallback(() => {
    stopFaceDetection();
    stopCamera();
  }, [stopFaceDetection, stopCamera]);

  return {
    videoRef,
    canvasRef,
    status,
    violations,
    isModelLoaded,
    isCameraReady,
    isInitializing,
    reinitialize,
    switchCamera,
    stopDetection
  };
};

export * from './types';
