
import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Maximum violations before terminating the assessment
export const MAX_FACE_VIOLATIONS = 3;

// Models path
const MODEL_URL = '/models/face-api';

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
  const [modelLoadingError, setModelLoadingError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Counter for consecutive frames with violations
  const noFaceFramesRef = useRef(0);
  const multipleFacesFramesRef = useRef(0);
  const faceOutOfFrameFramesRef = useRef(0);
  
  const { assessment, endAssessment } = useAssessment();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("Starting face-api.js model loading");
        
        // Load models from the specified URL
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        console.log("Tiny face detector model loaded");
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log("Face landmark model loaded");
        
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        console.log("Face expression model loaded");
        
        console.log("All face-api.js models loaded successfully");
        setIsModelLoaded(true);
        setModelLoadingError(null);
      } catch (error) {
        console.error("Error loading face-api.js models:", error);
        setModelLoadingError(`Failed to load face detection models: ${error}`);
        toast({
          title: "Error",
          description: "Failed to load face detection models. Please refresh the page.",
          variant: "destructive",
        });
      }
    };
    
    loadModels();
    
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

  // Face detection process using face-api.js
  const detectFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !detectionActive || !isModelLoaded) {
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    
    if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
      faceapi.matchDimensions(canvas, displaySize);
    }
    
    try {
      // Detect faces with options for better accuracy
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,    // Larger input size for better detection (default: 416)
        scoreThreshold: 0.3 // Lower threshold for better detection sensitivity (default: 0.5)
      });
      
      // Run detection with landmarks and expressions
      const detections = await faceapi.detectAllFaces(video, detectionOptions)
        .withFaceLandmarks()
        .withFaceExpressions();
      
      console.log("Face detection results:", 
        detections.length > 0 ? `${detections.length} face(s) detected` : "No face detected");
      
      // Clear previous drawings
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw detections onto the canvas
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      
      // Update face detection state
      const faceCount = detections.length;
      setFaceDetected(faceCount > 0);
      setMultipleFaces(faceCount > 1);
      setLastPrediction(faceCount > 0 ? detections[0] : null);
      
      // Check if face is properly positioned (if any face is detected)
      let isFaceProperlyPositioned = false;
      
      if (faceCount > 0) {
        // Draw all detections
        resizedDetections.forEach((detection, i) => {
          // Get face box dimensions
          const box = detection.detection.box;
          
          // Calculate face position relative to frame
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          
          // Check if face is centered enough (within middle 70% of frame - more lenient)
          const isCenteredX = faceCenterX > canvas.width * 0.15 && faceCenterX < canvas.width * 0.85;
          const isCenteredY = faceCenterY > canvas.height * 0.15 && faceCenterY < canvas.height * 0.85;
          
          // Check face size (not too small) - more lenient size requirements
          const faceAreaRatio = (box.width * box.height) / (canvas.width * canvas.height);
          const isFaceLargeEnough = faceAreaRatio > 0.03; // Face should occupy at least 3% of the frame
          
          // Update positioned state for the first face
          if (i === 0) {
            isFaceProperlyPositioned = isCenteredX && isCenteredY && isFaceLargeEnough;
          }
          
          // Draw custom rectangle with color based on position
          const borderColor = i === 0 && isFaceProperlyPositioned 
            ? "rgb(16, 185, 129)" // green
            : "rgb(245, 158, 11)"; // amber
          
          if (ctx) {
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
            
            // Draw landmarks
            ctx.fillStyle = "#ffffff";
            detection.landmarks.positions.forEach(point => {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
              ctx.fill();
            });
          }
        });
      } else {
        // If no face detected, add guiding text
        if (ctx) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.fillRect(canvas.width/2 - 100, canvas.height/2 - 15, 200, 30);
          ctx.fillStyle = "#000000";
          ctx.font = "14px Arial";
          ctx.textAlign = "center";
          ctx.fillText("Position your face in the camera", canvas.width/2, canvas.height/2);
        }
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
    isModelLoaded, 
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
    } else {
      console.log("Cannot start detection:", { isModelLoaded, isCameraReady, detectionActive });
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
    modelLoadingError,
    initCamera,
    startDetection,
    stopDetection,
    clearFaceWarning
  };
};

export default useProctoring;
