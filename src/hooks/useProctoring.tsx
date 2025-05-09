
import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { useToast } from '@/hooks/use-toast';

// Constants for detection - further reduced thresholds for better detection
const FACE_SIZE_THRESHOLD = 0.2; // Reduced to be less sensitive
const FACE_DISTANCE_THRESHOLD = 0.02; // Reduced to be less sensitive
const GAZE_DEVIATION_THRESHOLD = 0.3; // Increased to be less sensitive
const FACE_CONFIDENCE_THRESHOLD = 0.3; // Reduced to be less strict
const POSE_CONFIDENCE_THRESHOLD = 0.15; // Reduced to be less strict
const MIN_FACE_LANDMARKS = 0; // Allow detection with fewer landmarks
const DETECTION_INTERVAL = 300; // More frequent detection checks

// Violation types
export type ViolationType = 'no_face' | 'multiple_faces' | 'looking_away' | 'unusual_posture' | 'person_switched' | 'face_too_close' | 'face_too_far';

export interface ViolationEvent {
  type: ViolationType;
  timestamp: number;
  confidence: number;
  imageData?: string; // Base64 snapshot of violation moment
}

// Interface for face detection results
interface DetectedFace {
  box: {
    xMin: number;
    yMin: number;
    width: number;
    height: number;
    xMax: number;
    yMax: number;
  };
  keypoints: Array<{
    x: number;
    y: number;
    name: string;
  }>;
  score: number;
}

export function useProctoring() {
  const [cameraAccess, setCameraAccess] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [environmentCheckPassed, setEnvironmentCheckPassed] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(true);
  const [modelLoadingProgress, setModelLoadingProgress] = useState<number>(0);
  const [faceModel, setFaceModel] = useState<faceDetection.FaceDetector | null>(null);
  const [poseModel, setPoseModel] = useState<poseDetection.PoseDetector | null>(null);
  const [faceBenchmark, setFaceBenchmark] = useState<Float32Array | null>(null);
  
  // State for real-time detections
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [detectedPose, setDetectedPose] = useState<poseDetection.Pose | null>(null);
  const [faceTooClose, setFaceTooClose] = useState<boolean>(false);
  const [faceTooFar, setFaceTooFar] = useState<boolean>(false);
  const [isLookingAway, setIsLookingAway] = useState<boolean>(false);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);
  const [fallbackMode, setFallbackMode] = useState<boolean>(false);
  const [detectionsAttempted, setDetectionsAttempted] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const monitoringIntervalRef = useRef<number | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  // Debug helper
  const logDebug = (message: string, data?: any) => {
    console.log(`[Proctoring] ${message}`, data || '');
  };

  // Initialize TensorFlow and load models
  useEffect(() => {
    const initializeTf = async () => {
      try {
        logDebug('Initializing TensorFlow');
        setModelLoadingProgress(5);
        
        // Check if TensorFlow is already initialized
        if (!tf.getBackend()) {
          try {
            await tf.setBackend('webgl');
            logDebug('Using WebGL backend');
          } catch (e) {
            logDebug('WebGL initialization failed, falling back to CPU', e);
            await tf.setBackend('cpu');
            setFallbackMode(true);
            toast({
              title: "Performance Notice",
              description: "Using CPU mode for AI processing. This may be slower.",
              variant: "default"
            });
          }
          
          await tf.ready();
        }
        
        setModelLoadingProgress(20);
        logDebug('TensorFlow initialized with backend:', tf.getBackend());
        
        // Load face detection model with simplified options
        setModelLoadingProgress(25);
        logDebug('Loading face detection model');
        const faceModelConfig = {
          runtime: 'tfjs' as const,
          maxFaces: 4,
          modelType: 'short' as const,
        };
            
        const faceModel = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          faceModelConfig
        );
        setFaceModel(faceModel);
        setModelLoadingProgress(60);
        logDebug('Face detection model loaded');
        
        // Try to load pose detection model but continue if it fails
        logDebug('Loading pose detection model');
        try {
          const poseModel = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
              modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
              enableSmoothing: true,
            }
          );
          setPoseModel(poseModel);
          logDebug('Pose detection model loaded');
        } catch (error) {
          logDebug('Failed to load pose detection model, continuing without it', error);
          // Continue without pose detection
        }
        
        setModelLoadingProgress(100);
        setLoadingModels(false);
        setIsModelReady(true);
        logDebug("AI models loaded successfully");
      } catch (error) {
        console.error('Error loading TensorFlow models:', error);
        
        // Last resort fallback to basic mode
        setFallbackMode(true);
        setModelLoadingProgress(100);
        setLoadingModels(false);
        setIsModelReady(true);
        
        toast({
          title: "Limited AI Functionality",
          description: "Using basic face detection only. Some features may be limited.",
          variant: "destructive"
        });
      }
    };
    
    initializeTf();
    
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
      
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  // Request camera access with better error handling
  const requestCameraAccess = async () => {
    try {
      logDebug('Requesting camera access');
      const constraints = { 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { min: 15, ideal: 30 }
        }, 
        audio: false 
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setCameraStream(stream);
      setCameraAccess(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Make sure we can detect when the video is actually playing
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            logDebug('Video metadata loaded, dimensions:', 
                    videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
            
            videoRef.current.play().catch(err => {
              logDebug('Error playing video:', err);
            });
          }
        };
        
        // Add additional event listeners for better debugging
        videoRef.current.onplaying = () => {
          logDebug('Video is now playing');
          // Start detection once video is actually playing
          startContinuousDetection();
        };
        
        videoRef.current.onerror = (err) => {
          logDebug('Video error:', err);
        };
      }
      
      logDebug('Camera access granted');
      return stream;
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access for proctoring.",
        variant: "destructive"
      });
      return null;
    }
  };

  // Start continuous face and pose detection with improved reliability
  const startContinuousDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    logDebug('Starting continuous detection');
    
    detectionIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !faceModel) {
        return;
      }
      
      try {
        // Make sure video is properly initialized
        if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
          logDebug('Video dimensions not ready');
          return;
        }
        
        // Check if video is actually visible and playing
        const time = videoRef.current.currentTime;
        if (time === 0 || Number.isNaN(time)) {
          logDebug('Video not playing yet');
          return;
        }
        
        // Log video dimensions occasionally
        if (detectionsAttempted % 10 === 0) {
          logDebug(`Video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
        }

        setDetectionsAttempted(prev => prev + 1);
        
        // Detect faces with increased frequency for better responsiveness
        logDebug('Running face detection');
        const faces = await faceModel.estimateFaces(videoRef.current);
        logDebug(`Detected ${faces.length} faces`, faces);
        
        // Update the detected faces state
        setDetectedFaces(faces as unknown as DetectedFace[]);
        
        // Check if face is too close to the camera
        if (faces.length === 1) {
          const face = faces[0];
          const faceHeight = face.box.height;
          const videoHeight = videoRef.current.videoHeight;
          const faceRatio = faceHeight / videoHeight;
          
          logDebug(`Face ratio: ${faceRatio}, height: ${faceHeight}, video height: ${videoHeight}`);
          
          setFaceTooClose(faceRatio > FACE_SIZE_THRESHOLD);
          setFaceTooFar(faceRatio < FACE_DISTANCE_THRESHOLD);
          
          // Check if looking away based on face position
          const faceCenter = {
            x: face.box.xMin + face.box.width / 2,
            y: face.box.yMin + face.box.height / 2
          };
          const videoWidth = videoRef.current.videoWidth;
          const centerDeviation = Math.abs((faceCenter.x / videoWidth) - 0.5);
          
          setIsLookingAway(centerDeviation > GAZE_DEVIATION_THRESHOLD);
        } else {
          setFaceTooClose(false);
          setFaceTooFar(false);
          setIsLookingAway(false);
        }
        
        // Detect pose if poseModel is available
        if (poseModel) {
          try {
            const poses = await poseModel.estimatePoses(videoRef.current);
            setDetectedPose(poses.length > 0 ? poses[0] : null);
          } catch (error) {
            logDebug('Error detecting poses:', error);
          }
        }
      } catch (error) {
        console.error('Error during continuous detection:', error);
      }
    }, DETECTION_INTERVAL);
    
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [faceModel, poseModel, detectionsAttempted]);

  // Check environment with improved detection reliability
  const checkEnvironment = async () => {
    if (!faceModel || !videoRef.current || !cameraStream) {
      logDebug('Cannot check environment - model, video, or stream not ready');
      return false;
    }
    
    try {
      logDebug('Checking environment');
      // Take a snapshot of the current video frame
      const videoEl = videoRef.current;
      
      // Make sure video is playing and has dimensions
      if (videoEl.paused || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
        logDebug('Video not ready - paused:', videoEl.paused, 'dimensions:', videoEl.videoWidth, 'x', videoEl.videoHeight);
        
        toast({
          title: "Video not ready",
          description: "Please ensure your camera is working properly.",
          variant: "destructive"
        });
        return false;
      }
      
      // Add a small delay to make sure the video frame is captured correctly
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Run face detection with multiple attempts for better reliability
      let faces = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        logDebug(`Face detection attempt ${attempt + 1}`);
        faces = await faceModel.estimateFaces(videoEl);
        if (faces.length > 0) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      logDebug(`Environment check detected ${faces.length} faces`, faces);
      
      // Update the state with the detection results
      setDetectedFaces(faces as unknown as DetectedFace[]);
      
      // Environment checks
      if (faces.length === 0) {
        toast({
          title: "No face detected",
          description: "Make sure your face is visible in the camera and you have good lighting.",
          variant: "destructive"
        });
        return false;
      }
      
      if (faces.length > 1) {
        toast({
          title: "Multiple faces detected",
          description: "Only one person should be visible during the assessment.",
          variant: "destructive"
        });
        return false;
      }
      
      // Check if face is clear and well-lit (using box dimensions and confidence)
      const face = faces[0] as unknown as DetectedFace;
      
      // Check if face is too close
      const faceHeight = face.box.height;
      const videoHeight = videoEl.videoHeight;
      const faceRatio = faceHeight / videoHeight;
      
      logDebug(`Face ratio: ${faceRatio}, threshold close: ${FACE_SIZE_THRESHOLD}, far: ${FACE_DISTANCE_THRESHOLD}`);
      
      if (faceRatio > FACE_SIZE_THRESHOLD) {
        toast({
          title: "Face too close",
          description: "Please move further away from the camera.",
          variant: "destructive"
        });
        return false;
      }
      
      // Check if face is too far
      if (faceRatio < FACE_DISTANCE_THRESHOLD) {
        toast({
          title: "Face too far",
          description: "Please move closer to the camera.",
          variant: "destructive"
        });
        return false;
      }
      
      // All checks passed
      setEnvironmentCheckPassed(true);
      toast({
        title: "Environment check passed",
        description: "You may now start the assessment.",
        variant: "default"
      });
      
      logDebug('Environment check passed');
      return true;
    } catch (error) {
      console.error('Error checking environment:', error);
      toast({
        title: "Environment check failed",
        description: "Please ensure proper lighting and camera positioning.",
        variant: "destructive"
      });
      return false;
    }
  };

  // Draw face and pose detections on canvas with improved visualization
  const drawFaceDetection = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw detected faces
    detectedFaces.forEach(face => {
      // Draw face bounding box
      ctx.strokeStyle = faceTooClose ? 'red' : isLookingAway ? 'orange' : 'green';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        face.box.xMin,
        face.box.yMin,
        face.box.width,
        face.box.height
      );
      
      // Draw facial keypoints
      if (face.keypoints) {
        face.keypoints.forEach(keypoint => {
          ctx.fillStyle = 'cyan';
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
      
      // Add label
      ctx.fillStyle = faceTooClose ? 'red' : isLookingAway ? 'orange' : 'green';
      ctx.font = '14px Arial';
      let statusText = 'OK';
      if (faceTooClose) statusText = 'Too Close';
      else if (faceTooFar) statusText = 'Too Far';
      else if (isLookingAway) statusText = 'Looking Away';
      
      ctx.fillText(
        `Face: ${Math.round(face.score * 100)}% - ${statusText}`, 
        face.box.xMin, 
        face.box.yMin - 5
      );
    });
    
    // Draw pose detection if available
    if (detectedPose && detectedPose.keypoints) {
      // Draw pose keypoints with confidence above threshold
      detectedPose.keypoints
        .filter(keypoint => keypoint.score && keypoint.score > POSE_CONFIDENCE_THRESHOLD)
        .forEach(keypoint => {
          ctx.fillStyle = 'yellow';
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
          ctx.fill();
          
          // Add keypoint name
          if (keypoint.name) {
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.fillText(keypoint.name, keypoint.x + 5, keypoint.y - 5);
          }
        });
      
      // Connect pose keypoints with lines to form a skeleton
      const connections = [
        // Upper body
        ['nose', 'left_eye'], ['nose', 'right_eye'],
        ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
        ['nose', 'left_shoulder'], ['nose', 'right_shoulder'],
        ['left_shoulder', 'right_shoulder'],
        // Arms
        ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
        ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
        // Torso
        ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'],
        // Legs
        ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
      ];
      
      ctx.strokeStyle = 'yellow';
      ctx.lineWidth = 2;
      
      connections.forEach(([keypointNameA, keypointNameB]) => {
        const keypointA = detectedPose?.keypoints.find(kp => kp.name === keypointNameA);
        const keypointB = detectedPose?.keypoints.find(kp => kp.name === keypointNameB);
        
        if (keypointA?.score && keypointB?.score && 
            keypointA.score > POSE_CONFIDENCE_THRESHOLD && 
            keypointB.score > POSE_CONFIDENCE_THRESHOLD) {
          ctx.beginPath();
          ctx.moveTo(keypointA.x, keypointA.y);
          ctx.lineTo(keypointB.x, keypointB.y);
          ctx.stroke();
        }
      });
    }
    
    // Draw a help message if no face is detected
    if (detectedFaces.length === 0) {
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No face detected - please position yourself in view', canvas.width / 2, canvas.height / 2);
      
      // Draw face positioning guides
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      
      // Draw oval face guide
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const ovalWidth = canvas.width * 0.25;
      const ovalHeight = canvas.height * 0.35;
      
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, ovalWidth, ovalHeight, 0, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Draw positioning box
      ctx.setLineDash([5, 5]);
      const boxWidth = canvas.width * 0.5;
      const boxHeight = canvas.height * 0.6;
      ctx.strokeRect(
        centerX - boxWidth/2,
        centerY - boxHeight/2,
        boxWidth,
        boxHeight
      );
      ctx.setLineDash([]);
      
      // Draw center crosshair
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY);
      ctx.lineTo(centerX + 10, centerY);
      ctx.moveTo(centerX, centerY - 10);
      ctx.lineTo(centerX, centerY + 10);
      ctx.stroke();
      
      // Add instructional text
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(centerX - 125, centerY + ovalHeight + 10, 250, 60);
      ctx.fillStyle = 'black';
      ctx.font = '12px Arial';
      ctx.fillText('Position your face within the oval', centerX, centerY + ovalHeight + 25);
      ctx.fillText('Ensure good lighting on your face', centerX, centerY + ovalHeight + 40);
      ctx.fillText('Look directly at the camera', centerX, centerY + ovalHeight + 55);
    }
  }, [detectedFaces, detectedPose, faceTooClose, faceTooFar, isLookingAway]);

  // Start recording
  const startRecording = () => {
    if (!cameraStream || !videoRef.current) {
      return;
    }
    
    const options = { mimeType: 'video/webm;codecs=vp9' };
    recordedChunksRef.current = [];
    
    try {
      const mediaRecorder = new MediaRecorder(cameraStream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000); // Collect 1 second of data at a time
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      // Start AI monitoring
      startMonitoring();
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording failed",
        description: "Could not start proctoring recording.",
        variant: "destructive"
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop monitoring
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
      
      // Stop continuous detection
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    }
    
    // Release camera stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setCameraAccess(false);
    }
  };

  // Get recorded video as blob
  const getRecordedVideo = (): Blob | null => {
    if (recordedChunksRef.current.length === 0) return null;
    
    return new Blob(recordedChunksRef.current, {
      type: 'video/webm'
    });
  };

  // Take snapshot of current video frame
  const takeSnapshot = async (): Promise<string | null> => {
    if (!videoRef.current) return null;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Draw face and pose detections on the snapshot
    if (detectedFaces.length > 0 || detectedPose) {
      drawFaceDetection(canvas);
    }
    
    return canvas.toDataURL('image/jpeg', 0.7); // Lower quality to save space
  };

  // Continuous AI monitoring
  const startMonitoring = () => {
    if (!faceModel || !videoRef.current) {
      return;
    }
    
    // Run monitoring every 2 seconds
    monitoringIntervalRef.current = window.setInterval(async () => {
      try {
        if (!videoRef.current) return;
        
        const video = videoRef.current;
        
        // Skip if video is not playing
        if (video.paused || video.videoWidth === 0 || video.videoHeight === 0) {
          return;
        }
        
        // No face detected
        if (detectedFaces.length === 0) {
          const snapshot = await takeSnapshot();
          const violation: ViolationEvent = {
            type: 'no_face',
            timestamp: Date.now(),
            confidence: 0.9,
            imageData: snapshot || undefined
          };
          
          setViolations(prev => [...prev, violation]);
          
          toast({
            title: "Warning",
            description: "No face detected. Please stay in front of the camera.",
            variant: "destructive"
          });
          return;
        }
        
        // Multiple faces detected
        if (detectedFaces.length > 1) {
          const snapshot = await takeSnapshot();
          const violation: ViolationEvent = {
            type: 'multiple_faces',
            timestamp: Date.now(),
            confidence: 0.9,
            imageData: snapshot || undefined
          };
          
          setViolations(prev => [...prev, violation]);
          
          toast({
            title: "Warning",
            description: "Multiple faces detected. Only your face should be visible.",
            variant: "destructive"
          });
          return;
        }
        
        // Face too close warning
        if (faceTooClose) {
          const snapshot = await takeSnapshot();
          const violation: ViolationEvent = {
            type: 'face_too_close',
            timestamp: Date.now(),
            confidence: 0.9,
            imageData: snapshot || undefined
          };
          
          setViolations(prev => [...prev, violation]);
          
          toast({
            title: "Warning",
            description: "Your face is too close to the camera. Please move back.",
            variant: "destructive"
          });
        }
        
        // Looking away warning
        if (isLookingAway) {
          const snapshot = await takeSnapshot();
          const violation: ViolationEvent = {
            type: 'looking_away',
            timestamp: Date.now(),
            confidence: 0.8,
            imageData: snapshot || undefined
          };
          
          setViolations(prev => [...prev, violation]);
          
          toast({
            title: "Warning",
            description: "You appear to be looking away. Please focus on your assessment.",
            variant: "destructive"
          });
        }
        
        // Check if person has changed (identity verification)
        if (faceBenchmark && detectedFaces.length === 1) {
          const currentFrame = tf.browser.fromPixels(video);
          const normalizedFrame = tf.div(currentFrame, 255);
          const resizedFrame = tf.image.resizeBilinear(normalizedFrame as tf.Tensor3D, [128, 128]);
          const currentFaceTensor = resizedFrame.reshape([128 * 128 * 3]);
          const currentFace = currentFaceTensor.dataSync() as Float32Array;
          
          // Calculate basic similarity (extremely simplified for demo purposes)
          // In a real implementation, use a proper facial recognition model
          let diff = 0;
          for (let i = 0; i < faceBenchmark.length; i++) {
            diff += Math.abs(faceBenchmark[i] - currentFace[i]);
          }
          const similarity = 1 - (diff / faceBenchmark.length);
          
          // Clean up tensors
          currentFrame.dispose();
          normalizedFrame.dispose();
          resizedFrame.dispose();
          currentFaceTensor.dispose();
          
          // If similarity is low, likely a different person
          if (similarity < 0.7) {
            const snapshot = await takeSnapshot();
            const violation: ViolationEvent = {
              type: 'person_switched',
              timestamp: Date.now(),
              confidence: 0.85,
              imageData: snapshot || undefined
            };
            
            setViolations(prev => [...prev, violation]);
            
            toast({
              title: "Warning",
              description: "Different person detected. This incident has been recorded.",
              variant: "destructive"
            });
          }
        }
        
        // Unusual posture detection using the pose model
        if (detectedPose) {
          const nose = detectedPose.keypoints.find(kp => kp.name === 'nose');
          const leftShoulder = detectedPose.keypoints.find(kp => kp.name === 'left_shoulder');
          const rightShoulder = detectedPose.keypoints.find(kp => kp.name === 'right_shoulder');
          
          if (nose && leftShoulder && rightShoulder &&
              nose.score && leftShoulder.score && rightShoulder.score &&
              nose.score > POSE_CONFIDENCE_THRESHOLD &&
              leftShoulder.score > POSE_CONFIDENCE_THRESHOLD &&
              rightShoulder.score > POSE_CONFIDENCE_THRESHOLD) {
                
            // Check if person is leaning too much to one side
            const shoulderMidpoint = {
              x: (leftShoulder.x + rightShoulder.x) / 2,
              y: (leftShoulder.y + rightShoulder.y) / 2
            };
            
            const horizontalDeviation = Math.abs(nose.x - shoulderMidpoint.x) / video.videoWidth;
            const verticalDeviation = Math.abs(nose.y - shoulderMidpoint.y) / video.videoHeight;
            
            // If deviations are too large, person might be in unusual posture
            if (horizontalDeviation > 0.2 || verticalDeviation > 0.3) {
              const snapshot = await takeSnapshot();
              const violation: ViolationEvent = {
                type: 'unusual_posture',
                timestamp: Date.now(),
                confidence: 0.75,
                imageData: snapshot || undefined
              };
              
              setViolations(prev => [...prev, violation]);
              
              toast({
                title: "Warning",
                description: "Unusual posture detected. Please sit properly and face the screen.",
                variant: "destructive"
              });
            }
          }
        }
      } catch (error) {
        console.error('Error during AI monitoring:', error);
      }
    }, 3000); // Every 3 seconds to avoid too many alerts
  };

  return {
    videoRef,
    cameraAccess,
    environmentCheckPassed,
    isRecording,
    loadingModels,
    modelLoadingProgress,
    violations,
    detectedFaces,
    detectedPose,
    faceTooClose,
    faceTooFar,
    isLookingAway,
    isModelReady,
    fallbackMode,
    requestCameraAccess,
    checkEnvironment,
    startRecording,
    stopRecording,
    getRecordedVideo,
    drawFaceDetection,
    cameraStream,
    detectionsAttempted
  };
}
