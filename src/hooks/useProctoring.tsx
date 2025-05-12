
import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useToast } from '@/hooks/use-toast';

// Define constants
const DETECTION_INTERVAL = 1000; // 1 second interval between detections
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
  'objectDetected' |
  'error';

export type ViolationType = 
  'noFaceDetected' | 
  'multipleFacesDetected' | 
  'faceNotCentered' | 
  'faceCovered' | 
  'rapidMovement' | 
  'frequentDisappearance' |
  'identityMismatch' |
  'objectDetected';

export interface ProctoringOptions {
  showDebugInfo?: boolean;
  drawLandmarks?: boolean;
  drawExpressions?: boolean;
  detectExpressions?: boolean;
  trackViolations?: boolean;
  detectObjects?: boolean;
  enabled?: boolean;
  detectionOptions?: {
    faceDetectionThreshold?: number;
    faceCenteredTolerance?: number;
    rapidMovementThreshold?: number;
  };
}

export interface DetectionResult {
  status: ProctoringStatus;
  facesCount: number;
  expressions?: Record<string, number>;
  message?: string;
}

// Object detection classes (subset of COCO dataset that are relevant for proctoring)
const OBJECT_CLASSES = [
  'cell phone',
  'laptop',
  'book',
  'tv',
  'remote',
  'keyboard',
  'tablet',
  'smartphone'
];

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
    identityMismatch: 0,
    objectDetected: 0
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

  // Face tracking state
  const faceHistoryRef = useRef<{positions: Array<{x: number, y: number, width: number, height: number}>, timestamps: number[]}>(
    {positions: [], timestamps: []}
  );
  const noFaceCounterRef = useRef(0);
  const lastFaceDetectionTimeRef = useRef(Date.now());
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Enable/disable flag
  const enabled = options.enabled !== undefined ? options.enabled : true;

  // Load models with performance optimizations
  const loadModels = useCallback(async () => {
    if (!enabled) {
      console.log('Face detection disabled, skipping model load');
      return false;
    }
    
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
      
      // Load SSD model for object detection if needed
      if (options.detectObjects) {
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
          await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        }
      }
      
      console.log('Face-API models loaded successfully');
      setIsModelLoaded(true);
      return true;
    } catch (error) {
      console.error('Error loading face-api.js models:', error);
      setStatus('error');
      return false;
    }
  }, [enabled, options.detectObjects, toast]);

  // Initialize camera with improved error handling
  const initializeCamera = useCallback(async () => {
    if (!enabled) {
      console.log('Camera initialization skipped - feature disabled');
      return false;
    }
    
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
  }, [facingMode, toast, enabled]);

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

  // Detect prohibited objects
  const detectObjects = useCallback(async (video: HTMLVideoElement) => {
    if (!options.detectObjects || !faceapi.nets.ssdMobilenetv1.isLoaded) {
      return false;
    }
    
    try {
      // Run object detection
      const detections = await faceapi.detectAllFaces(
        video, 
        new faceapi.SsdMobilenetv1Options()
      ).withFaceLandmarks();
      
      // Filter for objects of interest
      const prohibitedObjects = detections.filter(detection => 
        OBJECT_CLASSES.includes(detection.toString().toLowerCase())
      );
      
      return prohibitedObjects.length > 0;
    } catch (error) {
      console.error("Error in object detection:", error);
      return false;
    }
  }, [options.detectObjects]);

  // Detect faces from video with optimizations
  const detectFaces = useCallback(async () => {
    if (!enabled || !videoRef.current || !canvasRef.current || !isModelLoaded || !isCameraReady) {
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

      // Check for prohibited objects if enabled
      let objectDetected = false;
      if (options.detectObjects) {
        objectDetected = await detectObjects(video);
      }

      // Track violations if enabled
      if (options.trackViolations) {
        const now = Date.now();
        
        // Object detection takes precedence
        if (objectDetected) {
          setViolations(prev => ({
            ...prev,
            objectDetected: prev.objectDetected + 1
          }));
          
          setStatus('objectDetected');
          setDetectionResult({
            status: 'objectDetected',
            facesCount: detections.length,
            message: 'Unauthorized object detected. Please remove it from view.'
          });
          
          // Skip other checks if object is detected
          return;
        }
        
        if (detections.length === 0) {
          // No face detected
          noFaceCounterRef.current += 1;
          
          // Only flag as violation if consistently not detected
          if (noFaceCounterRef.current >= 5) {
            setViolations(prev => ({
              ...prev,
              noFaceDetected: prev.noFaceDetected + 1
            }));
            noFaceCounterRef.current = 0; // Reset counter after recording violation
          }
          
          // Track frequent disappearance
          if (lastFaceDetectionTimeRef.current > 0 && 
              now - lastFaceDetectionTimeRef.current < 10000) {  // Within 10 seconds
            setViolations(prev => ({
              ...prev,
              frequentDisappearance: prev.frequentDisappearance + 1
            }));
          }
        } else {
          // Reset no-face counter
          noFaceCounterRef.current = 0;
          lastFaceDetectionTimeRef.current = now;
          
          // Multiple faces detection
          if (detections.length > 1) {
            setViolations(prev => ({
              ...prev,
              multipleFacesDetected: prev.multipleFacesDetected + 1
            }));
          }
          
          // Single face detection - check for other violations
          if (detections.length === 1) {
            const detection = detections[0];
            
            // Check if face is centered
            if (!isFaceCentered(detection, video.videoWidth, video.videoHeight)) {
              setViolations(prev => ({
                ...prev,
                faceNotCentered: prev.faceNotCentered + 1
              }));
            }
            
            // Check if face is covered
            if (isFaceCovered(detection)) {
              setViolations(prev => ({
                ...prev,
                faceCovered: prev.faceCovered + 1
              }));
            }
            
            // Check for rapid movements
            if (checkForRapidMovements(detection.detection.box)) {
              setViolations(prev => ({
                ...prev,
                rapidMovement: prev.rapidMovement + 1
              }));
            }
          }
        }
      }

      // Update status based on detection
      if (objectDetected) {
        setStatus('objectDetected');
        setDetectionResult({
          status: 'objectDetected',
          facesCount: detections.length,
          message: 'Unauthorized object detected. Please remove it from view.'
        });
      } else if (detections.length === 0) {
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
    enabled,
    isModelLoaded, 
    isCameraReady, 
    options.trackViolations, 
    options.showDebugInfo, 
    options.drawLandmarks, 
    options.drawExpressions,
    options.detectExpressions,
    options.detectObjects,
    isFaceCentered,
    isFaceCovered,
    checkForRapidMovements,
    detectObjects,
    violations
  ]);

  // Start detection loop
  const startDetection = useCallback(() => {
    if (!enabled) return () => {};
    
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
  }, [detectFaces, enabled]);

  // Stop detection and release camera
  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
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
      identityMismatch: 0,
      objectDetected: 0
    });
    
    // Reset face tracking state
    faceHistoryRef.current = { positions: [], timestamps: [] };
    noFaceCounterRef.current = 0;
    lastFaceDetectionTimeRef.current = 0;
  }, [enabled]);

  // Initialize system only if enabled
  useEffect(() => {
    if (!enabled) return;
    
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
  }, [loadModels, initializeCamera, stopDetection, enabled]);

  // Set up detection when camera is ready and models are loaded
  useEffect(() => {
    if (enabled && isModelLoaded && isCameraReady && !isInitializing) {
      const cleanup = startDetection();
      return cleanup;
    }
  }, [enabled, isModelLoaded, isCameraReady, isInitializing, startDetection]);

  // Handle facingMode changes
  useEffect(() => {
    if (enabled && isCameraPermissionGranted) {
      initializeCamera();
    }
  }, [enabled, facingMode, isCameraPermissionGranted, initializeCamera]);

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
    reinitialize: initializeCamera
  };
}

