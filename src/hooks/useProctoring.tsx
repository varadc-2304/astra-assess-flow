import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  'electronicDeviceDetected';

export interface ProctoringOptions {
  showDebugInfo?: boolean;
  drawLandmarks?: boolean;
  drawExpressions?: boolean;
  detectExpressions?: boolean;
  trackViolations?: boolean;
  detectObjects?: boolean;
  detectionOptions?: {
    faceDetectionThreshold?: number;
    faceCenteredTolerance?: number;
    rapidMovementThreshold?: number;
    objectDetectionThreshold?: number;
  };
}

export interface DetectionResult {
  status: ProctoringStatus;
  facesCount: number;
  expressions?: Record<string, number>;
  objects?: Array<{type: string, confidence: number, box: any}>;
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
    identityMismatch: 0,
    electronicDeviceDetected: 0
  });

  // Set default detection options
  const detectionOptions = {
    faceDetectionThreshold: options.detectionOptions?.faceDetectionThreshold || 0.5,
    faceCenteredTolerance: options.detectionOptions?.faceCenteredTolerance || 0.3,
    rapidMovementThreshold: options.detectionOptions?.rapidMovementThreshold || 0.3,
    objectDetectionThreshold: options.detectionOptions?.objectDetectionThreshold || 0.3
  };

  // Configure face detector with options
  const FACE_DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({ 
    inputSize: 224, 
    scoreThreshold: 0.5 
  });

  // Object detection options
  const SSD_DETECTION_OPTIONS = new faceapi.SsdMobilenetv1Options({
    minConfidence: detectionOptions.objectDetectionThreshold,
    maxResults: 10
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

  // Electronic device detection keywords
  const electronicDeviceKeywords = [
    'cell phone', 'mobile phone', 'smartphone', 'phone', 'tablet', 
    'laptop', 'computer', 'monitor', 'screen', 'device', 'electronics',
    'remote', 'calculator', 'headphones', 'earbuds', 'smartwatch', 'watch'
  ];

  // Load models with performance optimizations
  const loadModels = useCallback(async () => {
    try {
      // Check if models are already loaded to avoid reloading
      if (faceapi.nets.tinyFaceDetector.isLoaded && 
          faceapi.nets.faceLandmark68Net.isLoaded && 
          faceapi.nets.faceExpressionNet.isLoaded &&
          faceapi.nets.ssdMobilenetv1.isLoaded) {
        console.log('Face-API models already loaded');
        setIsModelLoaded(true);
        return true;
      }

      console.log('Loading face-api.js models...');
      
      // Load models in parallel for better performance
      const modelPromises = [
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ];

      // Add object detection model if enabled
      if (options.detectObjects) {
        modelPromises.push(faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL));
      }

      await Promise.all(modelPromises);
      
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
  }, [toast, options.detectObjects]);

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
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        }
      });

      // Set the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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

  // Detect objects (electronic devices) in the frame - IMPROVED VERSION
  const detectObjects = useCallback(async (video: HTMLVideoElement, faceBoxes: Array<{x: number, y: number, width: number, height: number}>) => {
    if (!options.detectObjects) {
      return [];
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return [];

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const devices = [];
      const blockSize = 60; // Larger blocks for better device detection
      const edgeThreshold = 40;
      const rectangleAspectRatios = [
        { min: 0.4, max: 0.8, type: 'smartphone' },
        { min: 1.2, max: 2.0, type: 'tablet' },
        { min: 1.4, max: 1.8, type: 'laptop' }
      ];
      
      for (let y = 0; y < canvas.height - blockSize; y += 30) {
        for (let x = 0; x < canvas.width - blockSize; x += 30) {
          // Skip areas where faces are detected
          const overlapsFace = faceBoxes.some(face => {
            return !(x > face.x + face.width || 
                    x + blockSize < face.x || 
                    y > face.y + face.height || 
                    y + blockSize < face.y);
          });
          
          if (overlapsFace) continue;
          
          let edgeCount = 0;
          let totalBrightness = 0;
          let darkPixels = 0;
          let brightPixels = 0;
          
          // Analyze the block for device characteristics
          for (let dy = 0; dy < blockSize; dy++) {
            for (let dx = 0; dx < blockSize; dx++) {
              const i = ((y + dy) * canvas.width + (x + dx)) * 4;
              const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
              totalBrightness += brightness;
              
              if (brightness < 80) darkPixels++;
              if (brightness > 180) brightPixels++;
              
              // Edge detection
              if (dx > 0 && dy > 0) {
                const prevI = ((y + dy) * canvas.width + (x + dx - 1)) * 4;
                const prevBrightness = (data[prevI] + data[prevI + 1] + data[prevI + 2]) / 3;
                if (Math.abs(brightness - prevBrightness) > edgeThreshold) {
                  edgeCount++;
                }
                
                const topI = ((y + dy - 1) * canvas.width + (x + dx)) * 4;
                const topBrightness = (data[topI] + data[topI + 1] + data[topI + 2]) / 3;
                if (Math.abs(brightness - topBrightness) > edgeThreshold) {
                  edgeCount++;
                }
              }
            }
          }
          
          const avgBrightness = totalBrightness / (blockSize * blockSize);
          const edgeDensity = edgeCount / (blockSize * blockSize);
          const contrastRatio = (brightPixels + darkPixels) / (blockSize * blockSize);
          
          // Device detection heuristics
          const hasStrongEdges = edgeDensity > 0.1;
          const hasContrast = contrastRatio > 0.3;
          const hasDeviceBrightness = (avgBrightness > 100 && avgBrightness < 220);
          const hasScreenCharacteristics = brightPixels > (blockSize * blockSize * 0.2);
          
          if (hasStrongEdges && hasContrast && (hasDeviceBrightness || hasScreenCharacteristics)) {
            // Refine the bounding box by finding the actual edges
            let minX = x + blockSize, maxX = x, minY = y + blockSize, maxY = y;
            
            for (let dy = 0; dy < blockSize; dy++) {
              for (let dx = 0; dx < blockSize; dx++) {
                const i = ((y + dy) * canvas.width + (x + dx)) * 4;
                const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                
                // Check if this pixel is part of an edge
                let isEdge = false;
                if (dx > 0) {
                  const leftI = ((y + dy) * canvas.width + (x + dx - 1)) * 4;
                  const leftBrightness = (data[leftI] + data[leftI + 1] + data[leftI + 2]) / 3;
                  if (Math.abs(brightness - leftBrightness) > edgeThreshold) isEdge = true;
                }
                if (dy > 0) {
                  const topI = ((y + dy - 1) * canvas.width + (x + dx)) * 4;
                  const topBrightness = (data[topI] + data[topI + 1] + data[topI + 2]) / 3;
                  if (Math.abs(brightness - topBrightness) > edgeThreshold) isEdge = true;
                }
                
                if (isEdge) {
                  minX = Math.min(minX, x + dx);
                  maxX = Math.max(maxX, x + dx);
                  minY = Math.min(minY, y + dy);
                  maxY = Math.max(maxY, y + dy);
                }
              }
            }
            
            const width = maxX - minX;
            const height = maxY - minY;
            const aspectRatio = width / height;
            
            // Determine device type based on aspect ratio and size
            let deviceType = 'electronic_device';
            for (const ratio of rectangleAspectRatios) {
              if (aspectRatio >= ratio.min && aspectRatio <= ratio.max) {
                deviceType = ratio.type;
                break;
              }
            }
            
            // Only add if it's a reasonable size for a device
            if (width > 40 && height > 40 && width < canvas.width * 0.7 && height < canvas.height * 0.7) {
              devices.push({
                type: deviceType,
                confidence: Math.min(0.9, (edgeDensity * 2 + contrastRatio) * 0.5),
                box: {
                  x: minX,
                  y: minY,
                  width: width,
                  height: height
                }
              });
            }
          }
        }
      }

      return devices;
    } catch (error) {
      console.error('Error in object detection:', error);
      return [];
    }
  }, [options.detectObjects]);

  // Function to log object violations to database
  const logObjectViolation = useCallback(async (objects: Array<{type: string, confidence: number, box: any}>, submissionId?: string) => {
    if (!submissionId || objects.length === 0) return;

    try {
      const { data: submission, error: fetchError } = await supabase
        .from('submissions')
        .select('object_violations')
        .eq('id', submissionId)
        .single();

      if (fetchError) {
        console.error('Error fetching submission for object violations:', fetchError);
        return;
      }

      let currentViolations: any[] = [];
      if (submission && submission.object_violations) {
        if (Array.isArray(submission.object_violations)) {
          currentViolations = submission.object_violations as any[];
        } else {
          try {
            const parsed = typeof submission.object_violations === 'string'
              ? JSON.parse(submission.object_violations)
              : submission.object_violations;
            currentViolations = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error('Error parsing object_violations:', e);
            currentViolations = [];
          }
        }
      }

      const violationEntry = {
        timestamp: new Date().toISOString(),
        devices_detected: objects.map(obj => ({
          type: obj.type,
          confidence: obj.confidence,
          position: obj.box
        })),
        violation_count: currentViolations.length + 1
      };

      currentViolations.push(violationEntry);

      const { error: updateError } = await supabase
        .from('submissions')
        .update({ 
          object_violations: currentViolations
        })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Error updating object violations:', updateError);
      } else {
        console.log('Object violation logged:', violationEntry);
      }
    } catch (err) {
      console.error('Error logging object violation:', err);
    }
  }, []);

  // Detect faces from video with improved object detection integration
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

      // Get face bounding boxes for object detection
      const faceBoxes = detections.map(detection => detection.detection.box);
      
      // Detect objects with improved algorithm
      const objects = await detectObjects(video, faceBoxes);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Track violations if enabled
      if (options.trackViolations) {
        const now = Date.now();
        
        // Check for electronic devices (now properly implemented)
        if (objects.length > 0) {
          setViolations(prev => ({
            ...prev,
            electronicDeviceDetected: prev.electronicDeviceDetected + 1
          }));
        }
        
        if (detections.length === 0) {
          // No face detected
          noFaceCounterRef.current += 1;
          
          // Increase violation count if no face for 5 consecutive checks (5 seconds)
          if (noFaceCounterRef.current >= 5) {
            setViolations(prev => ({
              ...prev,
              noFaceDetected: prev.noFaceDetected + 1
            }));
            noFaceCounterRef.current = 0;
          }
          
          // Track frequent disappearance
          if (lastFaceDetectionTimeRef.current > 0 && 
              now - lastFaceDetectionTimeRef.current < 10000) {
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
                  objects,
                  message: 'Face appears to be covered. Please remove any obstructions.'
                });
              } else if (!isFaceCentered(detection, video.videoWidth, video.videoHeight)) {
                setStatus('faceNotCentered');
                setDetectionResult({
                  status: 'faceNotCentered',
                  facesCount: 1,
                  expressions,
                  objects,
                  message: 'Face not centered. Please position yourself in the middle of the frame.'
                });
              } else if (checkForRapidMovements(detection.detection.box)) {
                setStatus('rapidMovement');
                setDetectionResult({
                  status: 'rapidMovement',
                  facesCount: 1,
                  expressions,
                  objects,
                  message: 'Rapid movement detected. Please keep your head still.'
                });
              } else {
                setStatus('faceDetected');
                setDetectionResult({
                  status: 'faceDetected',
                  facesCount: 1,
                  expressions,
                  objects,
                  message: 'Face detected successfully.'
                });
              }
            } else {
              setStatus('faceDetected');
              setDetectionResult({
                status: 'faceDetected',
                facesCount: 1,
                expressions,
                objects,
                message: 'Face detected successfully.'
              });
            }
          }
        }
      }

      // Update status and log object violations if needed
      if (objects.length > 0) {
        setStatus('objectDetected');
        setDetectionResult({
          status: 'objectDetected',
          facesCount: detections.length,
          objects,
          message: `${objects.length} electronic device(s) detected: ${objects.map(o => o.type).join(', ')}`
        });
        
        // Log to database if we have submission context
        const submissionId = (window as any).currentSubmissionId;
        if (submissionId) {
          logObjectViolation(objects, submissionId);
        }
      } else if (detections.length === 0) {
        setStatus('noFaceDetected');
        setDetectionResult({
          status: 'noFaceDetected',
          facesCount: 0,
          objects,
          message: 'No face detected. Please position yourself in front of the camera.'
        });
      } else if (detections.length === 1) {
        const detection = detections[0];
        
        const expressions: Record<string, number> = {};
        if (options.detectExpressions && 'expressions' in detection) {
          Object.entries(detection.expressions || {}).forEach(([key, value]) => {
            expressions[key] = value;
          });
        }
        
        if (options.trackViolations) {
          if (isFaceCovered(detection)) {
            setStatus('faceCovered');
            setDetectionResult({
              status: 'faceCovered',
              facesCount: 1,
              expressions,
              objects,
              message: 'Face appears to be covered. Please remove any obstructions.'
            });
          } else if (!isFaceCentered(detection, video.videoWidth, video.videoHeight)) {
            setStatus('faceNotCentered');
            setDetectionResult({
              status: 'faceNotCentered',
              facesCount: 1,
              expressions,
              objects,
              message: 'Face not centered. Please position yourself in the middle of the frame.'
            });
          } else if (checkForRapidMovements(detection.detection.box)) {
            setStatus('rapidMovement');
            setDetectionResult({
              status: 'rapidMovement',
              facesCount: 1,
              expressions,
              objects,
              message: 'Rapid movement detected. Please keep your head still.'
            });
          } else {
            setStatus('faceDetected');
            setDetectionResult({
              status: 'faceDetected',
              facesCount: 1,
              expressions,
              objects,
              message: 'Face detected successfully.'
            });
          }
        } else {
          setStatus('faceDetected');
          setDetectionResult({
            status: 'faceDetected',
            facesCount: 1,
            expressions,
            objects,
            message: 'Face detected successfully.'
          });
        }
      } else {
        setStatus('multipleFacesDetected');
        setDetectionResult({
          status: 'multipleFacesDetected',
          facesCount: detections.length,
          objects,
          message: 'Multiple faces detected. Please ensure only you are visible.'
        });
      }
      
      // Draw the detections with improved object boxes
      if (ctx && (detections.length > 0 || objects.length > 0)) {
        // Draw face detections
        detections.forEach((detection, index) => {
          const box = detection.detection.box;
          
          // Define a border color based on status
          const borderColor = 
            detections.length > 1 
              ? "rgb(239, 68, 68)" // red
              : "rgb(34, 197, 94)"; // green
          
          ctx.lineWidth = 3;
          ctx.strokeStyle = borderColor;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          
          // Add corner marks for better visibility
          const cornerLength = Math.min(25, Math.min(box.width, box.height) / 4);
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

          // Optionally draw landmarks
          if (options.drawLandmarks) {
            faceapi.draw.drawFaceLandmarks(canvas, detection);
          }
          
          // Optionally draw expressions
          if (options.drawExpressions && 'expressions' in detection) {
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

        // Draw object detections with improved styling
        objects.forEach((obj, index) => {
          const box = obj.box;
          
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgb(239, 68, 68)"; // red for objects
          ctx.setLineDash([10, 5]); // Dashed line for objects
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.setLineDash([]); // Reset line dash
          
          // Add device type and confidence label
          const label = `${obj.type} (${Math.round(obj.confidence * 100)}%)`;
          const labelWidth = ctx.measureText(label).width + 10;
          
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.fillRect(box.x, box.y - 30, labelWidth, 25);
          ctx.fillStyle = '#fff';
          ctx.font = '14px Arial';
          ctx.fillText(label, box.x + 5, box.y - 10);
          
          // Add warning icon
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fillRect(box.x, box.y, box.width, box.height);
        });
        
        if (options.showDebugInfo) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, 0, 200, 120);
          ctx.font = '14px Arial';
          ctx.fillStyle = '#fff';
          ctx.fillText(`Faces: ${detections.length}`, 10, 20);
          ctx.fillText(`Objects: ${objects.length}`, 10, 40);
          ctx.fillText(`Status: ${status}`, 10, 60);
          
          if (options.trackViolations) {
            const totalViolations = Object.values(violations).reduce((sum, val) => sum + val, 0);
            ctx.fillText(`Violations: ${totalViolations}`, 10, 80);
          }
          
          if (objects.length > 0) {
            ctx.fillText(`Device Types:`, 10, 100);
            objects.forEach((obj, i) => {
              ctx.fillText(`${obj.type}`, 10, 120 + (i * 15));
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in face detection:', error);
    }

  }, [
    isModelLoaded, 
    isCameraReady, 
    options.trackViolations, 
    options.showDebugInfo, 
    options.drawLandmarks, 
    options.drawExpressions,
    options.detectExpressions,
    options.detectObjects,
    detectObjects,
    logObjectViolation,
    isFaceCentered,
    isFaceCovered,
    checkForRapidMovements,
    violations
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
      electronicDeviceDetected: 0
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
    isModelLoaded,
    isCameraReady,
    isCameraPermissionGranted,
    isInitializing,
    switchCamera,
    stopDetection,
    reinitialize: initializeCamera
  };
}
