
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
        // Initialize TensorFlow.js
        await tf.ready();
        
        // Specify backends (CPU fallback if WebGL not available)
        await tf.setBackend('webgl');
        console.log("TensorFlow backend:", tf.getBackend());
        
        // Load BlazeFace model
        modelRef.current = await blazeface.load();
        setIsModelLoaded(true);
        console.log("BlazeFace model loaded successfully");
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
          modelRef.current = await blazeface.load();
          setIsModelLoaded(true);
          console.log("BlazeFace model loaded on CPU backend");
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
    if (!videoRef.current) return;
    
    try {
      const constraints = {
        video: { 
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play();
          setIsCameraReady(true);
          console.log("Camera initialized successfully");
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
          face_violations: (submission.face_violations || 0) + 1,
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

  // Face detection process
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
      // Get predictions
      const predictions = await modelRef.current.estimateFaces(video, false);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video frame on canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
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
          
          // Check if face is centered enough (within middle 60% of frame)
          const isCenteredX = faceCenterX > canvas.width * 0.2 && faceCenterX < canvas.width * 0.8;
          const isCenteredY = faceCenterY > canvas.height * 0.2 && faceCenterY < canvas.height * 0.8;
          
          // Check face size (not too small)
          const faceAreaRatio = (size[0] * size[1]) / (canvas.width * canvas.height);
          const isFaceLargeEnough = faceAreaRatio > 0.05; // Face should occupy at least 5% of the frame
          
          isFaceProperlyPositioned = isCenteredX && isCenteredY && isFaceLargeEnough;
          
          // Draw rectangle around the face
          ctx.strokeStyle = isFaceProperlyPositioned ? "green" : "yellow";
          ctx.lineWidth = 2;
          ctx.strokeRect(start[0], start[1], size[0], size[1]);
          
          // Draw landmarks (eyes, ears, nose, mouth)
          if (face.landmarks) {
            face.landmarks.forEach((landmark, index) => {
              ctx.fillStyle = "blue";
              ctx.fillRect(landmark[0], landmark[1], 4, 4);
            });
          }
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
    if (isModelLoaded && isCameraReady) {
      setDetectionActive(true);
      detectFace();
    }
  }, [isModelLoaded, isCameraReady, detectFace]);

  // Stop face detection
  const stopDetection = useCallback(() => {
    setDetectionActive(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
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
    initCamera,
    startDetection,
    stopDetection,
    clearFaceWarning
  };
};

export default useProctoring;
