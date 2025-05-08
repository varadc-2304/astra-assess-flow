
import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { useToast } from '@/hooks/use-toast';

// Violation types
export type ViolationType = 'no_face' | 'multiple_faces' | 'looking_away' | 'unusual_posture' | 'person_switched';

export interface ViolationEvent {
  type: ViolationType;
  timestamp: number;
  confidence: number;
  imageData?: string; // Base64 snapshot of violation moment
}

export function useProctoring() {
  const [cameraAccess, setCameraAccess] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [environmentCheckPassed, setEnvironmentCheckPassed] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(true);
  const [faceModel, setFaceModel] = useState<faceDetection.FaceDetector | null>(null);
  const [poseModel, setPoseModel] = useState<poseDetection.PoseDetector | null>(null);
  const [faceBenchmark, setFaceBenchmark] = useState<Float32Array | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const monitoringIntervalRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  // Initialize TensorFlow and load models
  useEffect(() => {
    const initializeTf = async () => {
      try {
        await tf.ready();
        
        // Load face detection model
        const faceModel = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'tfjs',
            maxFaces: 4,
          }
        );
        setFaceModel(faceModel);
        
        // Load pose detection model
        const poseModel = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true,
          }
        );
        setPoseModel(poseModel);
        
        setLoadingModels(false);
      } catch (error) {
        console.error('Error loading TensorFlow models:', error);
        toast({
          title: "Error",
          description: "Failed to initialize AI proctoring models.",
          variant: "destructive"
        });
      }
    };
    
    initializeTf();
    
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
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
      
      // Check if face is clear and well-lit (using basic box dimensions)
      const face = faces[0];
      const boxWidth = face.box.width;
      const boxHeight = face.box.height;
      
      if (boxWidth < 10 || boxHeight < 10) {
        toast({
          title: "Face too small",
          description: "Please move closer to the camera.",
          variant: "destructive"
        });
        return false;
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
        
        // Face detection
        const faces = await faceModel.estimateFaces(video);
        
        // No face detected
        if (faces.length === 0) {
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
        if (faces.length > 1) {
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
        
        // Check if person has changed (identity verification)
        if (faceBenchmark) {
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
        
        // Pose detection
        const poses = await poseModel.estimatePoses(video);
        
        if (poses.length > 0) {
          const pose = poses[0];
          
          // Check if looking away (using simplified head position)
          const nose = pose.keypoints.find(kp => kp.name === 'nose');
          const leftEye = pose.keypoints.find(kp => kp.name === 'left_eye');
          const rightEye = pose.keypoints.find(kp => kp.name === 'right_eye');
          
          if (nose && leftEye && rightEye) {
            const centerX = video.videoWidth / 2;
            const deviation = Math.abs(nose.x - centerX);
            
            // If nose is too far from center, likely looking away
            if (deviation > video.videoWidth * 0.15) {
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
          }
        }
      } catch (error) {
        console.error('Error during AI monitoring:', error);
      }
    }, 2000);
  };

  return {
    videoRef,
    cameraAccess,
    environmentCheckPassed,
    isRecording,
    loadingModels,
    violations,
    requestCameraAccess,
    checkEnvironment,
    startRecording,
    stopRecording,
    getRecordedVideo,
    cameraStream,
  };
}
