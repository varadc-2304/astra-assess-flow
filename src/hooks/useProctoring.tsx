import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import { supabase } from '@/integrations/supabase/client';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Maximum violations before terminating the assessment
export const MAX_FACE_VIOLATIONS = 3;

export const useProctoring = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [faceOutOfFrame, setFaceOutOfFrame] = useState(false);
  const [faceViolations, setFaceViolations] = useState(0);
  const [showFaceWarning, setShowFaceWarning] = useState(false);
  const [lastPrediction, setLastPrediction] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<blazeface.BlazeFaceModel | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Counter for consecutive frames with violations
  const noFaceFramesRef = useRef(0);
  const multipleFacesFramesRef = useRef(0);
  const faceOutOfFrameFramesRef = useRef(0);
  
  const { assessment, endAssessment } = useAssessment();
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize TensorFlow and load the BlazeFace model
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("Starting TensorFlow initialization and model loading");
        
        // Initialize TensorFlow.js
        await tf.ready();
        console.log("TensorFlow ready");
        
        // Specify backends (CPU fallback if WebGL not available)
        if (tf.getBackend() !== 'webgl') {
          try {
            await tf.setBackend('webgl');
            console.log("Using WebGL backend");
          } catch (err) {
            console.warn("WebGL backend not available, falling back to CPU", err);
            await tf.setBackend('cpu');
            console.log("Using CPU backend");
          }
        }
        
        console.log("TensorFlow backend:", tf.getBackend());
        
        // Load BlazeFace model with improved configuration for better detection
        console.log("Loading BlazeFace model...");
        modelRef.current = await blazeface.load({
          maxFaces: 3,             // Allow detection of up to 3 faces
          scoreThreshold: 0.5,     // Lower threshold for better detection (default is 0.75)
          iouThreshold: 0.3        // Adjust intersection over union threshold
        });
        
        console.log("BlazeFace model loaded successfully");
        await modelRef.current.estimateFaces(tf.zeros([128, 128, 3]));
        console.log("Model warmed up");

        setIsModelLoaded(true);
      } catch (error) {
        console.error("Error loading TensorFlow model:", error);
        toast({
          title: "Error",
          description: "Failed to load face detection model. Please refresh the page.",
          variant: "destructive",
        });
        
        // Fall back to CPU if WebGL fails
        try {
          await tf.setBackend('cpu');
          modelRef.current = await blazeface.load({
            maxFaces: 3,
            scoreThreshold: 0.5,
            iouThreshold: 0.3
          });
          setIsModelLoaded(true);
          console.log("BlazeFace model loaded on CPU backend as fallback");
        } catch (fallbackError) {
          console.error("Failed to load model on CPU as well:", fallbackError);
        }
      }
    };
    
    loadModel();
    
    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [toast]);

  // Initialize camera
  const initCamera = useCallback(async () => {
    if (!videoRef.current) {
      console.error("Video element reference not available");
      return;
    }
    
    try {
      console.log("Initializing camera...");
      // Define video constraints properly according to MediaStreamConstraints type
      const constraints: MediaStreamConstraints = {
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
          // Removed advanced property as it was causing type errors
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      console.log("Camera stream obtained successfully");
      
      // Wait for video to be ready
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play().then(() => {
            setIsCameraReady(true);
            console.log("Camera initialized and playing successfully");
          }).catch(err => {
            console.error("Error playing video:", err);
          });
        }
      };
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Access Error",
        description: "Please allow camera access for proctoring. Without camera access, you cannot continue the assessment.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Record face violation in database
  const recordFaceViolation = useCallback(async (violationType: string) => {
    if (!assessment || !user) return;
    
    try {
      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessment.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (submissionError || !submissions || submissions.length === 0) {
        console.error('Error finding submission to update:', submissionError);
        return;
      }
      
      const submission = submissions[0];
      const newViolationCount = faceViolations + 1;
      const isTerminated = newViolationCount >= MAX_FACE_VIOLATIONS;
      
      // Update the submission with the violation
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          fullscreen_violations: (submission.fullscreen_violations || 0) + 1,
          is_terminated: isTerminated
        })
        .eq('id', submission.id);
        
      if (updateError) {
        console.error('Error updating submission with face violation:', updateError);
      }
      
      // Update results table if terminated
      if (isTerminated) {
        const { error: resultError } = await supabase
          .from('results')
          .update({
            isTerminated: true,
            completed_at: new Date().toISOString(),
            terminationReason: 'Face violation limit reached'
          })
          .eq('assessment_id', assessment.id)
          .eq('user_id', user.id);
          
        if (resultError) {
          console.error('Error updating result termination status:', resultError);
        }
      }
    } catch (error) {
      console.error('Error recording face violation:', error);
    }
  }, [assessment, user, faceViolations]);

  // Face detection process with improved accuracy
  const detectFace = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || !canvasRef.current || !detectionActive) {
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Match canvas dimensions to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    try {
      // Draw video frame on canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert the video frame to a tensor for the model
      // Using tensor operations directly instead of tf.browser.fromPixels for better performance
      const videoTensor = tf.browser.fromPixels(video);
      
      // Get predictions with better error handling
      const predictions = await modelRef.current.estimateFaces(videoTensor, false);
      videoTensor.dispose(); // Clean up the tensor to prevent memory leaks
      
      console.log("Face detection predictions:", predictions.length > 0 ? "Face detected" : "No face detected");
      setLastPrediction(predictions.length > 0 ? predictions[0] : null);
      
      // Process detection results
      const faceCount = predictions.length;
      
      // Update face detection state
      setFaceDetected(faceCount > 0);
      setMultipleFaces(faceCount > 1);
      
      // Check if face is properly positioned (if any face is detected)
      let isFaceProperlyPositioned = false;
      
      if (faceCount > 0) {
        // For each detected face
        for (let i = 0; i < faceCount; i++) {
          const face = predictions[i];
          const start = face.topLeft;
          const end = face.bottomRight;
          const size = [end[0] - start[0], end[1] - start[1]];
          
          // Calculate face position relative to frame
          const faceCenterX = start[0] + size[0] / 2;
          const faceCenterY = start[1] + size[1] / 2;
          
          // Check if face is centered enough (within middle 70% of frame - more lenient)
          const isCenteredX = faceCenterX > canvas.width * 0.15 && faceCenterX < canvas.width * 0.85;
          const isCenteredY = faceCenterY > canvas.height * 0.15 && faceCenterY < canvas.height * 0.85;
          
          // Check face size (not too small) - more lenient size requirements
          const faceAreaRatio = (size[0] * size[1]) / (canvas.width * canvas.height);
          const isFaceLargeEnough = faceAreaRatio > 0.03; // Face should occupy at least 3% of the frame
          
          isFaceProperlyPositioned = isCenteredX && isCenteredY && isFaceLargeEnough;
          
          // Improve visibility of the face detection rectangle
          const borderColor = isFaceProperlyPositioned ? "rgb(16, 185, 129)" : "rgb(245, 158, 11)"; // Green if properly positioned, amber if not
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 3;
          ctx.strokeRect(start[0], start[1], size[0], size[1]);
          
          // Add corners to make rectangle more visible
          const cornerLength = Math.min(25, Math.min(size[0], size[1]) / 4);
          
          // Drawing corner marks for better visibility
          ctx.lineWidth = 4;
          
          // Top-left corner
          ctx.beginPath();
          ctx.moveTo(start[0], start[1] + cornerLength);
          ctx.lineTo(start[0], start[1]);
          ctx.lineTo(start[0] + cornerLength, start[1]);
          ctx.stroke();
          
          // Top-right corner
          ctx.beginPath();
          ctx.moveTo(end[0] - cornerLength, start[1]);
          ctx.lineTo(end[0], start[1]);
          ctx.lineTo(end[0], start[1] + cornerLength);
          ctx.stroke();
          
          // Bottom-left corner
          ctx.beginPath();
          ctx.moveTo(start[0], end[1] - cornerLength);
          ctx.lineTo(start[0], end[1]);
          ctx.lineTo(start[0] + cornerLength, end[1]);
          ctx.stroke();
          
          // Bottom-right corner
          ctx.beginPath();
          ctx.moveTo(end[0] - cornerLength, end[1]);
          ctx.lineTo(end[0], end[1]);
          ctx.lineTo(end[0], end[1] - cornerLength);
          ctx.stroke();
          
          // Draw landmarks (eyes, ears, nose, mouth) if available
          if (face.landmarks && Array.isArray(face.landmarks)) {
            ctx.fillStyle = "#ffffff";
            face.landmarks.forEach((landmark: number[]) => {
              ctx.beginPath();
              ctx.arc(landmark[0], landmark[1], 3, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
            });
          }
        }
        await tf.nextFrame();  // Prevents browser freezing
      } else {
        // If no face detected, add guiding text
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillRect(canvas.width/2 - 100, canvas.height/2 - 15, 200, 30);
        ctx.fillStyle = "#000000";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Position your face in the camera", canvas.width/2, canvas.height/2);
      }
      
      setFaceOutOfFrame(!isFaceProperlyPositioned && faceCount > 0);
      
      // Track consecutive violations
      if (!faceDetected) {
        noFaceFramesRef.current += 1;
      } else {
        noFaceFramesRef.current = 0;
      }
      
      if (multipleFaces) {
        multipleFacesFramesRef.current += 1;
      } else {
        multipleFacesFramesRef.current = 0;
      }
      
      if (faceOutOfFrame) {
        faceOutOfFrameFramesRef.current += 1;
      } else {
        faceOutOfFrameFramesRef.current = 0;
      }
      
      // Check for sustained violations (30 frames ≈ 1 second at 30fps)
      const VIOLATION_THRESHOLD = 30;
      let violationType = null;
      
      if (noFaceFramesRef.current >= VIOLATION_THRESHOLD) {
        violationType = 'no_face';
        noFaceFramesRef.current = 0;
      } else if (multipleFacesFramesRef.current >= VIOLATION_THRESHOLD) {
        violationType = 'multiple_faces';
        multipleFacesFramesRef.current = 0;
      } else if (faceOutOfFrameFramesRef.current >= VIOLATION_THRESHOLD) {
        violationType = 'face_out_of_frame';
        faceOutOfFrameFramesRef.current = 0;
      }
      
      // If we have a sustained violation, show warning and record it
      if (violationType) {
        setFaceViolations(prev => prev + 1);
        setShowFaceWarning(true);
        
        const violationMessages = {
          no_face: "No face detected",
          multiple_faces: "Multiple faces detected",
          face_out_of_frame: "Face not properly positioned"
        };
        
        toast({
          title: "Proctoring Warning",
          description: `${violationMessages[violationType as keyof typeof violationMessages]}. This is violation ${faceViolations + 1}/${MAX_FACE_VIOLATIONS}`,
          variant: "destructive",
        });
        
        await recordFaceViolation(violationType);
        
        // If max violations reached, end assessment
        if (faceViolations + 1 >= MAX_FACE_VIOLATIONS) {
          endAssessment();
        }
      }
    } catch (error) {
      console.error("Error during face detection:", error);
    }
    
    // Continue detection loop
    animationRef.current = requestAnimationFrame(detectFace);
  }, [
    detectionActive, 
    faceDetected, 
    faceOutOfFrame, 
    multipleFaces, 
    faceViolations, 
    recordFaceViolation, 
    endAssessment,
    toast
  ]);

  // Start face detection
  const startDetection = useCallback(() => {
    if (isModelLoaded && isCameraReady && !detectionActive) {
      setDetectionActive(true);
      console.log("Starting face detection");
      detectFace();
    }
  }, [isModelLoaded, isCameraReady, detectionActive, detectFace]);

  // Stop face detection
  const stopDetection = useCallback(() => {
    setDetectionActive(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      console.log("Face detection stopped");
    }
  }, []);

  // Clear warning modal
  const clearFaceWarning = useCallback(() => {
    setShowFaceWarning(false);
  }, []);

  return {
    videoRef,
    canvasRef,
    isModelLoaded,
    isCameraReady,
    detectionActive,
    faceDetected,
    multipleFaces,
    faceOutOfFrame,
    faceViolations,
    showFaceWarning,
    lastPrediction,
    initCamera,
    startDetection,
    stopDetection,
    clearFaceWarning
  };
};

export default useProctoring;
