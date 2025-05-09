
import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { useToast } from '@/hooks/use-toast';

// Constants for detection
const FACE_SIZE_THRESHOLD = 0.3; // If face takes up more than 30% of screen height, it's too close
const FACE_DISTANCE_THRESHOLD = 0.1; // If face takes up less than 10% of screen height, it's too far
const GAZE_DEVIATION_THRESHOLD = 0.15; // Maximum allowed head deviation from center (as fraction of image width)
const FACE_CONFIDENCE_THRESHOLD = 0.8; // Minimum confidence for face detection
const POSE_CONFIDENCE_THRESHOLD = 0.3; // Minimum confidence for pose keypoints
const MIN_FACE_LANDMARKS = 3; // Minimum number of facial landmarks needed for valid detection

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const monitoringIntervalRef = useRef<number | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  // Initialize TensorFlow and load models
  useEffect(() => {
    const initializeTf = async () => {
      try {
        setModelLoadingProgress(5);
        await tf.ready();
        setModelLoadingProgress(20);
        
        // Load face detection model
        setModelLoadingProgress(25);
        const faceModel = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'tfjs',
            maxFaces: 4,
            modelType: 'short',
          }
        );
        setFaceModel(faceModel);
        setModelLoadingProgress(60);
        
        // Load pose detection model
        const poseModel = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true,
          }
        );
        setPoseModel(poseModel);
        setModelLoadingProgress(100);
        
        setLoadingModels(false);
        console.log("AI models loaded successfully");
      } catch (error) {
        console.error('Error loading TensorFlow models:', error);
        toast({
          title: "Error",
          description: "Failed to initialize AI proctoring models. Please refresh the page and try again.",
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

  // Request camera access
  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }, 
        audio: false 
      });
      
      setCameraStream(stream);
      setCameraAccess(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
      }
      
      // Start continuous detection when camera is on
      startContinuousDetection();
      
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

  // Start continuous face and pose detection
  const startContinuousDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    // Run detection every 500ms
    detectionIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || !faceModel || !poseModel) return;
      
      try {
        // Detect faces
        const faces = await faceModel.estimateFaces(videoRef.current);
        setDetectedFaces(faces as unknown as DetectedFace[]);
        
        // Check if face is too close to the camera
        if (faces.length === 1) {
          const face = faces[0];
          const faceHeight = face.box.height;
          const videoHeight = videoRef.current.videoHeight;
          const faceRatio = faceHeight / videoHeight;
          
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
        
        // Detect pose
        const poses = await poseModel.estimatePoses(videoRef.current);
        setDetectedPose(poses.length > 0 ? poses[0] : null);
      } catch (error) {
        console.error('Error during continuous detection:', error);
      }
    }, 500);
    
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [faceModel, poseModel]);

  // Check environment (good lighting, clear face visibility)
  const checkEnvironment = async () => {
    if (!faceModel || !videoRef.current || !cameraStream) {
      return false;
    }
    
    try {
      // Take a snapshot of the current video frame
      const videoEl = videoRef.current;
      
      // Make sure video is playing and has dimensions
      if (videoEl.paused || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
        toast({
          title: "Video not ready",
          description: "Please ensure your camera is working properly.",
          variant: "destructive"
        });
        return false;
      }
      
      // Detect faces in the current frame
      const faces = await faceModel.estimateFaces(videoEl);
      
      // Environment checks
      if (faces.length === 0) {
        toast({
          title: "No face detected",
          description: "Make sure your face is visible in the camera.",
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
      
      // Check if face confidence is high enough
      if (face.score < FACE_CONFIDENCE_THRESHOLD) {
        toast({
          title: "Face not clear",
          description: "Please ensure better lighting and clear visibility of your face.",
          variant: "destructive"
        });
        return false;
      }
      
      // Check if enough facial landmarks are detected
      if (!face.keypoints || face.keypoints.length < MIN_FACE_LANDMARKS) {
        toast({
          title: "Face landmarks not detected",
          description: "Please ensure your full face is visible in good lighting.",
          variant: "destructive"
        });
        return false;
      }
      
      // Check for looking away
      const nose = face.keypoints.find(kp => kp.name === 'noseTip');
      if (nose) {
        const centerDeviation = Math.abs((nose.x / videoEl.videoWidth) - 0.5);
        if (centerDeviation > GAZE_DEVIATION_THRESHOLD) {
          toast({
            title: "Looking away",
            description: "Please look directly at the screen.",
            variant: "destructive"
          });
          return false;
        }
      }
      
      // Store facial features as benchmark for identity verification later
      const tensorFace = tf.browser.fromPixels(videoEl);
      const normalizedFace = tf.div(tensorFace, 255);
      const resizedFace = tf.image.resizeBilinear(normalizedFace as tf.Tensor3D, [128, 128]);
      const faceTensor = resizedFace.reshape([128 * 128 * 3]);
      setFaceBenchmark(faceTensor.dataSync() as Float32Array);
      
      // Clean up tensors
      tensorFace.dispose();
      normalizedFace.dispose();
      resizedFace.dispose();
      faceTensor.dispose();
      
      // All checks passed
      setEnvironmentCheckPassed(true);
      toast({
        title: "Environment check passed",
        description: "You may now start the assessment.",
      });
      
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

  // Draw face and pose detections on canvas
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
    if (!faceModel || !poseModel || !videoRef.current) {
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
        
        // Face detection - uses the existing detectedFaces state
        
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
    requestCameraAccess,
    checkEnvironment,
    startRecording,
    stopRecording,
    getRecordedVideo,
    drawFaceDetection,
    cameraStream,
  };
}
