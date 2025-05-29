import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useToast } from '@/hooks/use-toast';

// Define constants
const DETECTION_INTERVAL = 1000; // 1 second interval between detections
const VIOLATION_RECORDING_INTERVAL = 60000; // 60 seconds for violation recording
const MODEL_URL = '/models';

// Types
export type ProctoringStatus = 
  'initializing' | 
  'noFaceDetected' | 
  'faceDetected' | 
  'multipleFacesDetected' | 
  'faceCovered' |
  'faceNotCentered' |
  'rapidMovement' |
  'error';

export type ViolationType = 
  'noFaceDetected' | 
  'multipleFacesDetected' | 
  'faceNotCentered' | 
  'faceCovered' | 
  'rapidMovement' | 
  'frequentDisappearance' |
  'identityMismatch';

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
  onViolationRecorded?: (violationType: ViolationType, count: number) => void;
}

export interface DetectionResult {
  status: ProctoringStatus;
  facesCount: number;
  expressions?: Record<string, number>;
  message?: string;
}

export function useProctoring(options: ProctoringOptions = {}) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [status, setStatus] = useState<ProctoringStatus>('initializing');
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isCameraPermissionGranted, setIsCameraPermissionGranted] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isInitializing, setIsInitializing] = useState(true);
  const [violations, setViolations] = useState<Record<ViolationType, number>>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0,
    frequentDisappearance: 0,
    identityMismatch: 0
  });

  // Enhanced violation tracking state
  const [currentViolationCounts, setCurrentViolationCounts] = useState<Record<ViolationType, number>>({
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
  const FACE_DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({ 
    inputSize: 224, 
    scoreThreshold: 0.5 
  });

  // Enhanced violation tracking refs
  const violationTrackingRef = useRef<{
    lastRecordingTime: number;
    currentPeriodViolations: Record<ViolationType, number>;
    consecutiveNoFaceCount: number;
    lastFaceDetectionTime: number;
  }>({
    lastRecordingTime: Date.now(),
    currentPeriodViolations: {
      noFaceDetected: 0,
      multipleFacesDetected: 0,
      faceNotCentered: 0,
      faceCovered: 0,
      rapidMovement: 0,
      frequentDisappearance: 0,
      identityMismatch: 0
    },
    consecutiveNoFaceCount: 0,
    lastFaceDetectionTime: Date.now()
  });

  // Face tracking state
  const faceHistoryRef = useRef<{positions: Array<{x: number, y: number, width: number, height: number}>, timestamps: number[]}>(
    {positions: [], timestamps: []}
  );
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const violationRecordingIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Record violations to database every 60 seconds
  const recordViolationsToDB = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRecording = now - violationTrackingRef.current.lastRecordingTime;
    
    if (timeSinceLastRecording >= VIOLATION_RECORDING_INTERVAL) {
      const currentPeriodViolations = violationTrackingRef.current.currentPeriodViolations;
      
      // Check if there are any violations to record
      const hasViolations = Object.values(currentPeriodViolations).some(count => count > 0);
      
      if (hasViolations && options.trackViolations) {
        console.log('Recording violations to database:', currentPeriodViolations);
        
        // Update the main violations state with accumulated counts
        setViolations(prev => {
          const newViolations = { ...prev };
          Object.entries(currentPeriodViolations).forEach(([type, count]) => {
            const violationType = type as ViolationType;
            newViolations[violationType] += count;
            
            // Trigger callback for each violation type that occurred
            if (count > 0 && options.onViolationRecorded) {
              options.onViolationRecorded(violationType, newViolations[violationType]);
            }
          });
          return newViolations;
        });
        
        // Reset current period violations
        violationTrackingRef.current.currentPeriodViolations = {
          noFaceDetected: 0,
          multipleFacesDetected: 0,
          faceNotCentered: 0,
          faceCovered: 0,
          rapidMovement: 0,
          frequentDisappearance: 0,
          identityMismatch: 0
        };
      }
      
      violationTrackingRef.current.lastRecordingTime = now;
    }
  }, [options.trackViolations, options.onViolationRecorded]);

  // Start violation recording interval
  useEffect(() => {
    if (options.trackViolations) {
      violationRecordingIntervalRef.current = window.setInterval(recordViolationsToDB, 10000); // Check every 10 seconds
      
      return () => {
        if (violationRecordingIntervalRef.current) {
          clearInterval(violationRecordingIntervalRef.current);
        }
      };
    }
  }, [recordViolationsToDB, options.trackViolations]);

  // Load models with performance optimizations
  const loadModels = useCallback(async () => {
    try {
      // Check if models are already loaded to avoid reloading
      if (faceapi.nets.tinyFaceDetector.isLoaded && 
          faceapi.nets.faceLandmark68Net.isLoaded && 
          faceapi.nets.faceExpressionNet.isLoaded) {
        console.log('Face-API models already loaded');
        setIsModelLoaded(true);
        return true;
      }

      // Load models in parallel for better performance
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);
      
      console.log('Face-API models loaded successfully');
      setIsModelLoaded(true);
      return true;
    } catch (error) {
      console.error('Error loading face-api.js models:', error);
      toast({
        title: 'Error',
        description: 'Failed to load face detection models. Please refresh and try again.',
        variant: 'destructive',
      });
      setStatus('error');
      return false;
    }
  }, [toast]);

  // Initialize camera with improved error handling
  const initializeCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: 'Camera Error',
        description: 'Your browser does not support camera access.',
        variant: 'destructive',
      });
      setStatus('error');
      setIsCameraPermissionGranted(false);
      return false;
    }

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Request camera access with optimized settings for performance
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 }, // Lower resolution for better performance
          height: { ideal: 480 },
          frameRate: { ideal: 15 } // Lower framerate to reduce CPU usage
        }
      });

      // Set the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Add event listener for when video is ready to play
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) videoRef.current.play();
        };
      }

      streamRef.current = stream;
      setIsCameraPermissionGranted(true);
      setIsCameraReady(true);
      
      return true;
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Permission Denied',
        description: 'Please allow camera access for proctoring.',
        variant: 'destructive',
      });
      setStatus('error');
      setIsCameraPermissionGranted(false);
      return false;
    }
  }, [facingMode, toast]);

  // Switch camera (for mobile devices with multiple cameras)
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  // Check for rapid head movements with improved threshold
  const checkForRapidMovements = useCallback((currentBox: faceapi.Box) => {
    const { positions, timestamps } = faceHistoryRef.current;
    
    // Add current position
    positions.push({
      x: currentBox.x,
      y: currentBox.y,
      width: currentBox.width,
      height: currentBox.height
    });
    timestamps.push(Date.now());
    
    // Keep only the last 5 positions
    if (positions.length > 5) {
      positions.shift();
      timestamps.shift();
    }
    
    // Need at least 3 positions for movement detection
    if (positions.length >= 3) {
      const recentPositions = positions.slice(-3);
      
      // Calculate movement distance
      let totalMovement = 0;
      for (let i = 1; i < recentPositions.length; i++) {
        const prev = recentPositions[i-1];
        const curr = recentPositions[i];
        
        // Calculate center points
        const prevCenterX = prev.x + prev.width/2;
        const prevCenterY = prev.y + prev.height/2;
        const currCenterX = curr.x + curr.width/2;
        const currCenterY = curr.y + curr.height/2;
        
        // Calculate distance between centers
        const distance = Math.sqrt(
          Math.pow(currCenterX - prevCenterX, 2) + 
          Math.pow(currCenterY - prevCenterY, 2)
        );
        
        // Normalize by face width to account for distance from camera
        totalMovement += distance / curr.width;
      }
      
      // Check recent timestamps to ensure this is a rapid movement
      const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
      const averageMovement = totalMovement / (recentPositions.length - 1);
      
      // Use configurable threshold for rapid movement detection
      if (averageMovement > detectionOptions.rapidMovementThreshold && timeSpan < 1500) {
        return true;
      }
    }
    
    return false;
  }, [detectionOptions.rapidMovementThreshold]);

  // Check if face is centered with configurable tolerance
  const isFaceCentered = useCallback((detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>, videoWidth: number, videoHeight: number) => {
    const box = detection.detection.box;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    const videoCenter = { x: videoWidth / 2, y: videoHeight / 2 };
    
    // Calculate how far (as a percentage of frame dimensions) the face is from center
    const offsetX = Math.abs(centerX - videoCenter.x) / videoWidth;
    const offsetY = Math.abs(centerY - videoCenter.y) / videoHeight;
    
    // Face should be within configurable % of center in both directions
    return offsetX < detectionOptions.faceCenteredTolerance && offsetY < detectionOptions.faceCenteredTolerance;
  }, [detectionOptions.faceCenteredTolerance]);

  // Check if face is partially covered/occluded with improved detection
  const isFaceCovered = useCallback((detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>) => {
    // Use low landmark detection confidence as a proxy for occlusion
    const landmarks = detection.landmarks;
    if (!landmarks) return false;
    
    // Check if landmarks have unusually low confidence score
    // or if certain key landmarks are missing/have low confidence
    const landmarksPositions = landmarks.positions;
    
    // A heuristic approach: if key facial landmarks deviate too much from expected positions
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const mouth = landmarks.getMouth();
    
    // Check if important facial features are detected
    if (nose.length < 3 || leftEye.length < 3 || rightEye.length < 3 || mouth.length < 5) {
      return true;
    }
    
    // Use detection score as an indicator of face quality with configurable threshold
    const detectionScore = detection.detection.score;
    
    // Use configurable threshold
    return detectionScore < detectionOptions.faceDetectionThreshold;
  }, [detectionOptions.faceDetectionThreshold]);

  // Enhanced violation tracking in face detection
  const trackViolation = useCallback((violationType: ViolationType) => {
    if (options.trackViolations) {
      violationTrackingRef.current.currentPeriodViolations[violationType] += 1;
      
      // Update current counts for UI display
      setCurrentViolationCounts(prev => ({
        ...prev,
        [violationType]: prev[violationType] + 1
      }));
      
      console.log(`Violation tracked: ${violationType}, current period count: ${violationTrackingRef.current.currentPeriodViolations[violationType]}`);
    }
  }, [options.trackViolations]);

  // Detect faces from video with enhanced violation tracking
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

      // Clear previous drawings
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Enhanced violation tracking
      if (options.trackViolations) {
        const now = Date.now();
        
        if (detections.length === 0) {
          // No face detected
          violationTrackingRef.current.consecutiveNoFaceCount += 1;
          
          // Track violation after 3 consecutive detections (3 seconds)
          if (violationTrackingRef.current.consecutiveNoFaceCount >= 3) {
            trackViolation('noFaceDetected');
            violationTrackingRef.current.consecutiveNoFaceCount = 0; // Reset after tracking
          }
          
          // Track frequent disappearance
          if (violationTrackingRef.current.lastFaceDetectionTime > 0 && 
              now - violationTrackingRef.current.lastFaceDetectionTime < 10000) {  // Within 10 seconds
            trackViolation('frequentDisappearance');
          }
        } else {
          // Reset no-face counter when face is detected
          violationTrackingRef.current.consecutiveNoFaceCount = 0;
          violationTrackingRef.current.lastFaceDetectionTime = now;
          
          // Multiple faces detection
          if (detections.length > 1) {
            trackViolation('multipleFacesDetected');
          }
          
          // Single face detection - check for other violations
          if (detections.length === 1) {
            const detection = detections[0];
            
            // Check if face is centered
            if (!isFaceCentered(detection, video.videoWidth, video.videoHeight)) {
              trackViolation('faceNotCentered');
            }
            
            // Check if face is covered
            if (isFaceCovered(detection)) {
              trackViolation('faceCovered');
            }
            
            // Check for rapid movements
            if (checkForRapidMovements(detection.detection.box)) {
              trackViolation('rapidMovement');
            }
          }
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
        
        // Check for specific violations to update status
        if (options.trackViolations) {
          if (isFaceCovered(detection)) {
            setStatus('faceCovered');
            setDetectionResult({
              status: 'faceCovered',
              facesCount: 1,
              expressions,
              message: 'Face appears to be covered. Please remove any obstructions.'
            });
          } else if (!isFaceCentered(detection, video.videoWidth, video.videoHeight)) {
            setStatus('faceNotCentered');
            setDetectionResult({
              status: 'faceNotCentered',
              facesCount: 1,
              expressions,
              message: 'Face not centered. Please position yourself in the middle of the frame.'
            });
          } else if (checkForRapidMovements(detection.detection.box)) {
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
      
      // Draw the detections
      if (ctx && detections.length > 0) {
        // Draw each detected face
        detections.forEach((detection, index) => {
          const box = detection.detection.box;
          
          // Define a border color based on status
          const borderColor = 
            detections.length > 1 
              ? "rgb(239, 68, 68)" // red
              : "rgb(245, 158, 11)"; // amber
          
          if (ctx) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = borderColor;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
          }
          
          // Add corner marks for better visibility
          const cornerLength = Math.min(25, Math.min(box.width, box.height) / 4);
          if (ctx) {
            ctx.lineWidth = 4;
            
            // Draw corner marks (top-left, top-right, bottom-left, bottom-right)
            // Top-left
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + cornerLength);
            ctx.lineTo(box.x, box.y);
            ctx.lineTo(box.x + cornerLength, box.y);
            ctx.stroke();
            
            // Top-right
            ctx.beginPath();
            ctx.moveTo(box.x + box.width - cornerLength, box.y);
            ctx.lineTo(box.x + box.width, box.y);
            ctx.lineTo(box.x + box.width, box.y + cornerLength);
            ctx.stroke();
            
            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + box.height - cornerLength);
            ctx.lineTo(box.x, box.y + box.height);
            ctx.lineTo(box.x + cornerLength, box.y + box.height);
            ctx.stroke();
            
            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(box.x + box.width - cornerLength, box.y + box.height);
            ctx.lineTo(box.x + box.width, box.y + box.height);
            ctx.lineTo(box.x + box.width, box.y + box.height - cornerLength);
            ctx.stroke();
          }

          // Optionally draw landmarks
          if (options.drawLandmarks && ctx) {
            faceapi.draw.drawFaceLandmarks(canvas, detection);
          }
          
          // Optionally draw expressions
          if (options.drawExpressions && ctx && 'expressions' in detection) {
            const expressions = detection.expressions;
            if (expressions) {
              const sorted = Object.entries(expressions)
                .sort((a, b) => b[1] - a[1]);
                
              if (sorted.length > 0) {
                const [emotion, confidence] = sorted[0];
                const text = `${emotion}: ${Math.round(confidence * 100)}%`;
                
                ctx.font = '16px Arial';
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeText(text, box.x, box.y - 5);
                ctx.fillText(text, box.x, box.y - 5);
              }
            }
          }
        });
        
        // Show debug info if enabled
        if (options.showDebugInfo && ctx) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, 0, 180, 80);
          ctx.font = '14px Arial';
          ctx.fillStyle = '#fff';
          ctx.fillText(`Faces: ${detections.length}`, 10, 20);
          ctx.fillText(`Status: ${status}`, 10, 40);
          
          if (options.trackViolations) {
            const totalViolations = Object.values(violations).reduce((sum, val) => sum + val, 0);
            ctx.fillText(`Violations: ${totalViolations}`, 10, 60);
          }
        }
      }
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
    isFaceCentered,
    isFaceCovered,
    checkForRapidMovements,
    trackViolation
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

    if (violationRecordingIntervalRef.current) {
      clearInterval(violationRecordingIntervalRef.current);
      violationRecordingIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsCameraReady(false);
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
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
    
    setCurrentViolationCounts({
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
    violationTrackingRef.current = {
      lastRecordingTime: Date.now(),
      currentPeriodViolations: {
        noFaceDetected: 0,
        multipleFacesDetected: 0,
        faceNotCentered: 0,
        faceCovered: 0,
        rapidMovement: 0,
        frequentDisappearance: 0,
        identityMismatch: 0
      },
      consecutiveNoFaceCount: 0,
      lastFaceDetectionTime: 0
    };
  }, []);

  // Initialize system
  useEffect(() => {
    async function initializeProctoring() {
      setIsInitializing(true);
      const modelsLoaded = await loadModels();
      if (modelsLoaded) {
        await initializeCamera();
      }
      setIsInitializing(false);
    }
    
    initializeProctoring();
    
    return () => {
      stopDetection();
    };
  }, [loadModels, initializeCamera, stopDetection]);

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
      initializeCamera();
    }
  }, [facingMode, isCameraPermissionGranted, initializeCamera]);

  // Return values and functions
  return {
    videoRef,
    canvasRef,
    status,
    detectionResult,
    violations: options.trackViolations ? violations : undefined,
    currentViolationCounts: options.trackViolations ? currentViolationCounts : undefined,
    isModelLoaded,
    isCameraReady,
    isCameraPermissionGranted,
    isInitializing,
    switchCamera,
    stopDetection,
    reinitialize: initializeCamera
  };
}
