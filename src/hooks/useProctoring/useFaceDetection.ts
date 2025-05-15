
import { useState, useEffect, useCallback, useRef, RefObject } from 'react';
import * as faceapi from 'face-api.js';
import { ProctoringStatus, ProctoringOptions } from './index';
import { useFaceRenderer } from './useFaceRenderer';

interface UseFaceDetectionProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  detectionOptions: {
    faceDetectionThreshold: number;
    faceCenteredTolerance: number;
    rapidMovementThreshold: number;
  };
  setStatus: (status: ProctoringStatus) => void;
  isModelLoaded: boolean;
  options: ProctoringOptions;
}

export const useFaceDetection = ({
  videoRef,
  canvasRef,
  detectionOptions,
  setStatus,
  isModelLoaded,
  options
}: UseFaceDetectionProps) => {
  const [faceDetectionActive, setFaceDetectionActive] = useState(false);
  const detectionInterval = useRef<number | null>(null);
  const prevFacePosition = useRef<{ x: number, y: number } | null>(null);
  const { renderFaceDetection } = useFaceRenderer(options);

  // Function to handle the video when it starts playing
  const handleVideoOnPlay = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Reset canvas dimensions to match video
    const displaySize = { 
      width: videoRef.current.videoWidth, 
      height: videoRef.current.videoHeight 
    };
    
    // Match canvas to video dimensions
    faceapi.matchDimensions(canvasRef.current, displaySize);
    
    // Display success message
    console.log('Video is ready to display');
  }, [videoRef, canvasRef]);
  
  // Function to start face detection
  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded) {
      console.log("Cannot start face detection: video, canvas or models not ready");
      return;
    }
    
    if (faceDetectionActive) {
      console.log("Face detection is already active");
      return;
    }
    
    console.log("Starting face detection");
    setFaceDetectionActive(true);
    
    // Create TinyFaceDetector options
    const tinyFaceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 512,
      scoreThreshold: detectionOptions.faceDetectionThreshold
    });
    
    // Set up detection timer
    const detect = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      try {
        // Detect all faces with landmarks, expressions, etc.
        const detectionOptions = {
          withLandmarks: true,
          withFaceExpressions: options.detectExpressions,
          withAgeAndGender: false
        };
        
        // Perform face detection
        const detections = await faceapi
          .detectAllFaces(videoRef.current, tinyFaceDetectorOptions)
          .withFaceLandmarks()
          .withFaceExpressions();
        
        // Get video dimensions
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        };
        
        // Resize detections to match display size
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Check face detection status
        if (resizedDetections.length === 0) {
          // No face detected
          setStatus('noFaceDetected');
        } else if (resizedDetections.length > 1) {
          // Multiple faces detected
          setStatus('multipleFacesDetected');
        } else {
          // One face detected
          const face = resizedDetections[0];
          const { detection } = face;
          
          // Check if face is detected with high enough confidence
          if (detection.score < detectionOptions.faceDetectionThreshold) {
            setStatus('noFaceDetected');
            prevFacePosition.current = null;
            return;
          }
          
          // Get face box
          const { box } = detection;
          const faceX = box.x + box.width / 2;
          const faceY = box.y + box.height / 2;
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;
          
          // Check if face is centered
          const isFaceCentered = 
            Math.abs(faceX - videoWidth / 2) < videoWidth * detectionOptions.faceCenteredTolerance &&
            Math.abs(faceY - videoHeight / 2) < videoHeight * detectionOptions.faceCenteredTolerance;
          
          // Check face movement
          let isMovingRapidly = false;
          if (prevFacePosition.current) {
            const dx = faceX - prevFacePosition.current.x;
            const dy = faceY - prevFacePosition.current.y;
            const distanceMoved = Math.sqrt(dx * dx + dy * dy);
            const movementThreshold = Math.min(videoWidth, videoHeight) * detectionOptions.rapidMovementThreshold;
            
            isMovingRapidly = distanceMoved > movementThreshold;
          }
          
          // Update previous face position
          prevFacePosition.current = { x: faceX, y: faceY };
          
          // Check if face is covered (based on low detection score or landmarks)
          const isFaceCovered = detection.score < 0.7;  // Adjust threshold as needed
          
          // Determine status
          if (isMovingRapidly) {
            setStatus('rapidMovement');
          } else if (!isFaceCentered) {
            setStatus('faceNotCentered');
          } else if (isFaceCovered) {
            setStatus('faceCovered');
          } else {
            setStatus('faceDetected');
          }
        }
        
        // Render the detection results
        renderFaceDetection(canvasRef.current, resizedDetections);
      } catch (error) {
        console.error('Error in face detection:', error);
      }
    };
    
    // Start detection loop
    const intervalId = window.setInterval(detect, 100); // Run detection 10 times per second
    detectionInterval.current = intervalId;
    
  }, [
    videoRef, 
    canvasRef, 
    isModelLoaded, 
    faceDetectionActive, 
    detectionOptions, 
    options.detectExpressions,
    setStatus,
    renderFaceDetection
  ]);
  
  // Function to stop face detection
  const stopFaceDetection = useCallback(() => {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    
    setFaceDetectionActive(false);
    prevFacePosition.current = null;
    
    // Clear canvas if it exists
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [canvasRef]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (detectionInterval.current) {
        clearInterval(detectionInterval.current);
      }
    };
  }, []);
  
  return {
    handleVideoOnPlay,
    startFaceDetection,
    stopFaceDetection,
    faceDetectionActive,
  };
};
