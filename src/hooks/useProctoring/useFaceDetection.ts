
import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';

export type ProctoringStatus = 
  | 'initializing' 
  | 'noFaceDetected' 
  | 'faceDetected' 
  | 'multipleFacesDetected' 
  | 'faceNotCentered' 
  | 'faceCovered'
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

export interface DetectionOptions {
  faceDetectionThreshold?: number;
  faceCenteredTolerance?: number;
  rapidMovementThreshold?: number;
}

interface UseFaceDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isRunningRef: React.RefObject<boolean>;
  isCameraReady: boolean;
  isModelLoaded: boolean;
  trackViolations?: boolean;
  detectionOptions?: DetectionOptions;
}

export const useFaceDetection = ({
  videoRef,
  canvasRef,
  isRunningRef,
  isCameraReady,
  isModelLoaded,
  trackViolations = false,
  detectionOptions = {}
}: UseFaceDetectionProps) => {
  const [status, setStatus] = useState<ProctoringStatus>('initializing');
  const [violations, setViolations] = useState<Record<ViolationType, number>>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0,
    frequentDisappearance: 0,
    identityMismatch: 0
  });
  
  const lastDetectionTimeRef = useRef<number>(Date.now());
  const previousFacePositionRef = useRef<faceapi.FaceDetection | null>(null);
  const noFaceTimeoutRef = useRef<number | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  
  // Track when violations were last recorded (for cooldown)
  const lastViolationTimeRef = useRef<Record<ViolationType, number>>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0,
    frequentDisappearance: 0,
    identityMismatch: 0
  });
  
  // Default detection options with fallbacks
  const defaultOptions = {
    faceDetectionThreshold: 0.5,
    faceCenteredTolerance: 0.3,
    rapidMovementThreshold: 0.3,
    ...detectionOptions
  };
  
  // Record a violation if tracking is enabled, with 60-second cooldown
  const recordViolation = useCallback((violationType: ViolationType) => {
    if (trackViolations) {
      const now = Date.now();
      // Only record a violation if 60 seconds (60000ms) have passed since the last one of this type
      if (now - lastViolationTimeRef.current[violationType] >= 60000) {
        setViolations(prev => ({
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
  
  // Detect faces and update status
  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isRunningRef.current || !isCameraReady || !isModelLoaded) {
      return;
    }
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const displaySize = { width: video.width, height: video.height };
      
      if (displaySize.width === 0 || displaySize.height === 0) {
        return;
      }
      
      // Match canvas size to video
      faceapi.matchDimensions(canvas, displaySize);
      
      // Detect all faces with landmarks and expressions
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: defaultOptions.faceDetectionThreshold
      });
      
      const detections = await faceapi.detectAllFaces(video, detectionOptions)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();
      
      // Clear previous drawings
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (detections.length === 0) {
        // No face detected
        if (status !== 'noFaceDetected') {
          setStatus('noFaceDetected');
          recordViolation('noFaceDetected');
        }
        return;
      } else if (detections.length > 1) {
        // Multiple faces detected
        setStatus('multipleFacesDetected');
        recordViolation('multipleFacesDetected');
        return;
      }
      
      const detection = detections[0];
      const face = detection.detection;
      
      // Check if face is centered in frame
      const box = face.box;
      const videoWidth = video.videoWidth || video.width;
      const videoHeight = video.videoHeight || video.height;
      
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      
      const normalizedFacePosX = faceCenterX / videoWidth;
      const normalizedFacePosY = faceCenterY / videoHeight;
      
      // Check if face is not centered (outside of tolerance zone)
      if (
        normalizedFacePosX < 0.5 - defaultOptions.faceCenteredTolerance || 
        normalizedFacePosX > 0.5 + defaultOptions.faceCenteredTolerance ||
        normalizedFacePosY < 0.5 - defaultOptions.faceCenteredTolerance || 
        normalizedFacePosY > 0.5 + defaultOptions.faceCenteredTolerance
      ) {
        setStatus('faceNotCentered');
        recordViolation('faceNotCentered');
        return;
      }
      
      // Detect rapid movement
      if (previousFacePositionRef.current) {
        const prevFace = previousFacePositionRef.current;
        const prevBox = prevFace.box;
        
        const moveDistanceX = Math.abs(faceCenterX - (prevBox.x + prevBox.width / 2)) / videoWidth;
        const moveDistanceY = Math.abs(faceCenterY - (prevBox.y + prevBox.height / 2)) / videoHeight;
        const moveDist = Math.sqrt(moveDistanceX * moveDistanceX + moveDistanceY * moveDistanceY);
        
        if (moveDist > defaultOptions.rapidMovementThreshold) {
          setStatus('rapidMovement');
          recordViolation('rapidMovement');
          return;
        }
      }
      
      // Store current face position for next comparison
      previousFacePositionRef.current = face;
      
      // Check for facial expressions that might indicate face covering
      const expressions = detection.expressions;
      if (expressions) {
        const neutral = expressions.neutral || 0;
        if (neutral < 0.5) {
          setStatus('faceCovered');
          recordViolation('faceCovered');
          return;
        }
      }
      
      // Face is detected correctly
      setStatus('faceDetected');
      lastDetectionTimeRef.current = Date.now();
      
      // Clear any pending "face disappeared" timeout
      if (noFaceTimeoutRef.current) {
        window.clearTimeout(noFaceTimeoutRef.current);
        noFaceTimeoutRef.current = null;
      }
      
    } catch (error) {
      console.error('Error in face detection:', error);
      setStatus('error');
    }
  }, [
    videoRef, 
    canvasRef, 
    isRunningRef, 
    isCameraReady, 
    isModelLoaded, 
    status, 
    recordViolation, 
    defaultOptions
  ]);
  
  // Start face detection loop
  useEffect(() => {
    if (isCameraReady && isModelLoaded && isRunningRef.current) {
      // Run detection at regular intervals
      if (!detectionIntervalRef.current) {
        detectionIntervalRef.current = window.setInterval(detectFaces, 500);
      }
      
      return () => {
        if (detectionIntervalRef.current) {
          window.clearInterval(detectionIntervalRef.current);
          detectionIntervalRef.current = null;
        }
        
        if (noFaceTimeoutRef.current) {
          window.clearTimeout(noFaceTimeoutRef.current);
          noFaceTimeoutRef.current = null;
        }
      };
    }
  }, [isCameraReady, isModelLoaded, detectFaces]);
  
  return { status, violations };
};
