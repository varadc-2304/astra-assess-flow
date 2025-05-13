
import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useToast } from '@/hooks/use-toast';
import { 
  ProctoringStatus, 
  DetectionResult, 
  ProctoringOptions, 
  ViolationCounts,
  ViolationType,
  FaceHistory
} from './types';
import { loadModels } from './modelUtils';
import { initializeCamera, stopCameraStream, clearCanvas } from './cameraUtils';
import { createFaceDetectionOptions, drawFaceDetectionResults, isFaceCovered, isFaceCentered, checkForRapidMovements } from './faceDetectionUtils';
import { trackViolations, updateFaceHistory } from './violationUtils';

// Define constants
const DETECTION_INTERVAL = 1000; // 1 second interval between detections

export function useProctoring(options: ProctoringOptions = {}) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [status, setStatus] = useState<ProctoringStatus>('initializing');
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isCameraPermissionGranted, setIsCameraPermissionGranted] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isInitializing, setIsInitializing] = useState(true);
  const [violations, setViolations] = useState<ViolationCounts>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0,
    frequentDisappearance: 0,
    identityMismatch: 0
  });

  // Set default detection options
  const detectionOptions = {
    faceDetectionThreshold: options.detectionOptions?.faceDetectionThreshold || 0.8,
    faceCenteredTolerance: options.detectionOptions?.faceCenteredTolerance || 0.2,
    rapidMovementThreshold: options.detectionOptions?.rapidMovementThreshold || 0.2
  };

  // Configure face detector with options
  const FACE_DETECTION_OPTIONS = createFaceDetectionOptions();

  // Face tracking state
  const faceHistoryRef = useRef<FaceHistory>({positions: [], timestamps: []});
  const noFaceCounterRef = useRef(0);
  const lastFaceDetectionTimeRef = useRef(Date.now());
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const toastUtils = useToast();

  // Initialize camera
  const initializeCameraStream = useCallback(async () => {
    // Stop any existing stream
    if (streamRef.current) {
      stopCameraStream(streamRef.current);
    }

    const stream = await initializeCamera(videoRef, toastUtils, facingMode);
    
    if (stream) {
      streamRef.current = stream;
      setIsCameraPermissionGranted(true);
      setIsCameraReady(true);
      return true;
    } else {
      setStatus('error');
      setIsCameraPermissionGranted(false);
      return false;
    }
  }, [facingMode, toastUtils]);

  // Switch camera (for mobile devices with multiple cameras)
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  // Detect faces from video with optimizations
  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded || !isCameraReady) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video is playing and has dimensions
    if (video.paused || video.ended || !video.videoWidth) {
      return;
    }

    // Match canvas size to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      // Performance optimization - use a smaller size for detection
      const detectionsPromise = faceapi
        .detectAllFaces(video, FACE_DETECTION_OPTIONS)
        .withFaceLandmarks();
      
      // Only add expressions if needed
      const detections = options.detectExpressions 
        ? await detectionsPromise.withFaceExpressions()
        : await detectionsPromise;

      // Track violations if enabled
      if (options.trackViolations) {
        const { 
          updatedViolations, 
          updatedNoFaceCounter,
          violationsDetected 
        } = trackViolations(
          detections,
          video.videoWidth,
          video.videoHeight,
          detectionOptions,
          violations,
          faceHistoryRef.current,
          noFaceCounterRef.current,
          lastFaceDetectionTimeRef.current
        );
        
        // Update state if violations changed
        if (violationsDetected) {
          setViolations(updatedViolations);
        }
        
        // Update counter
        noFaceCounterRef.current = updatedNoFaceCounter;
        
        // Update face history for movement tracking
        if (detections.length === 1) {
          lastFaceDetectionTimeRef.current = Date.now();
          faceHistoryRef.current = updateFaceHistory(detections, faceHistoryRef.current);
        }
      }

      // Update status based on detection
      if (detections.length === 0) {
        setStatus('noFaceDetected');
        setDetectionResult({
          status: 'noFaceDetected',
          facesCount: 0,
          message: 'No face detected. Please position yourself in front of the camera.'
        });
      } else if (detections.length === 1) {
        const detection = detections[0];
        
        // Convert FaceExpressions to Record<string, number>
        const expressions: Record<string, number> = {};
        if (options.detectExpressions && 'expressions' in detection) {
          Object.entries(detection.expressions || {}).forEach(([key, value]) => {
            expressions[key] = value;
          });
        }
        
        // Determine status based on detected issues
        const hasFaceCovered = options.trackViolations && 
          'detection' in detection && 
          isFaceCovered(detection, detectionOptions.faceDetectionThreshold);
          
        const faceNotCentered = options.trackViolations && 
          !isFaceCentered(
            detection, 
            video.videoWidth, 
            video.videoHeight, 
            detectionOptions.faceCenteredTolerance
          );
          
        const hasRapidMovement = options.trackViolations && 
          'detection' in detection && 
          checkForRapidMovements(
            detection.detection.box, 
            faceHistoryRef.current,
            detectionOptions.rapidMovementThreshold
          );

        if (hasFaceCovered) {
          setStatus('faceCovered');
          setDetectionResult({
            status: 'faceCovered',
            facesCount: 1,
            expressions,
            message: 'Face appears to be covered. Please remove any obstructions.'
          });
        } else if (faceNotCentered) {
          setStatus('faceNotCentered');
          setDetectionResult({
            status: 'faceNotCentered',
            facesCount: 1,
            expressions,
            message: 'Face not centered. Please position yourself in the middle of the frame.'
          });
        } else if (hasRapidMovement) {
          setStatus('rapidMovement');
          setDetectionResult({
            status: 'rapidMovement',
            facesCount: 1,
            expressions,
            message: 'Rapid movement detected. Please keep your head still.'
          });
        } else {
          setStatus('faceDetected');
          setDetectionResult({
            status: 'faceDetected',
            facesCount: 1,
            expressions,
            message: 'Face detected successfully.'
          });
        }
      } else {
        setStatus('multipleFacesDetected');
        setDetectionResult({
          status: 'multipleFacesDetected',
          facesCount: detections.length,
          message: 'Multiple faces detected. Please ensure only you are visible.'
        });
      }
      
      // Draw the detections on the canvas
      drawFaceDetectionResults(
        canvas, 
        detections, 
        options, 
        status,
        options.trackViolations ? violations : undefined
      );
    } catch (error) {
      console.error('Error in face detection:', error);
      // Don't update status on transient errors to avoid flickering
    }
  }, [
    isModelLoaded, 
    isCameraReady, 
    options.trackViolations, 
    options.showDebugInfo, 
    options.drawLandmarks, 
    options.drawExpressions,
    options.detectExpressions,
    detectionOptions,
    violations,
    status
  ]);

  // Start detection loop
  const startDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    detectionIntervalRef.current = window.setInterval(detectFaces, DETECTION_INTERVAL);
    
    // Initial detection immediately
    detectFaces();
    
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [detectFaces]);

  // Stop detection and release camera
  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (streamRef.current) {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    }

    setIsCameraReady(false);
    
    // Clear canvas
    if (canvasRef.current) {
      clearCanvas(canvasRef.current);
    }
    
    // Reset violation tracking
    setViolations({
      noFaceDetected: 0,
      multipleFacesDetected: 0,
      faceNotCentered: 0,
      faceCovered: 0,
      rapidMovement: 0,
      frequentDisappearance: 0,
      identityMismatch: 0
    });
    
    // Reset face tracking state
    faceHistoryRef.current = { positions: [], timestamps: [] };
    noFaceCounterRef.current = 0;
    lastFaceDetectionTimeRef.current = 0;
  }, []);

  // Initialize system
  useEffect(() => {
    async function initializeProctoring() {
      setIsInitializing(true);
      const modelsLoaded = await loadModels(toastUtils);
      if (modelsLoaded) {
        setIsModelLoaded(true);
        await initializeCameraStream();
      }
      setIsInitializing(false);
    }
    
    initializeProctoring();
    
    return () => {
      stopDetection();
    };
  }, [initializeCameraStream, stopDetection, toastUtils]);

  // Set up detection when camera is ready and models are loaded
  useEffect(() => {
    if (isModelLoaded && isCameraReady && !isInitializing) {
      const cleanup = startDetection();
      return cleanup;
    }
  }, [isModelLoaded, isCameraReady, isInitializing, startDetection]);

  // Handle facingMode changes
  useEffect(() => {
    if (isCameraPermissionGranted) {
      initializeCameraStream();
    }
  }, [facingMode, isCameraPermissionGranted, initializeCameraStream]);

  // Return values and functions
  return {
    videoRef,
    canvasRef,
    status,
    detectionResult,
    violations: options.trackViolations ? violations : undefined,
    isModelLoaded,
    isCameraReady,
    isCameraPermissionGranted,
    isInitializing,
    switchCamera,
    stopDetection,
    reinitialize: initializeCameraStream
  };
}

// Re-export types
export type { 
  ProctoringStatus,
  ViolationType,
  ProctoringOptions,
  DetectionResult
} from './types';
