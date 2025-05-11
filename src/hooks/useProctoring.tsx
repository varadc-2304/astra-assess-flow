
import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useToast } from '@/hooks/use-toast';

// Define constants
const DETECTION_INTERVAL = 1000; // 1 second interval between detections
const MODEL_URL = '/models';
const FACE_DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({ 
  inputSize: 224, 
  scoreThreshold: 0.5 
});

// Types
export type ProctoringStatus = 'initializing' | 'noFaceDetected' | 'faceDetected' | 'multipleFacesDetected' | 'error';

export interface ProctoringOptions {
  showDebugInfo?: boolean;
  drawLandmarks?: boolean;
  drawExpressions?: boolean;
  detectExpressions?: boolean;
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Load models
  const loadModels = useCallback(async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      
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

  // Initialize camera
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

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      // Set the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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

  // Detect faces from video
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

    // Detect faces
    const detections = await faceapi
      .detectAllFaces(video, FACE_DETECTION_OPTIONS)
      .withFaceLandmarks()
      .withFaceExpressions();

    // Draw results
    const ctx = canvas.getContext('2d');
    
    // Clear previous drawings
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      setStatus('faceDetected');
      setDetectionResult({
        status: 'faceDetected',
        facesCount: 1,
        expressions: detections[0].expressions,
        message: 'Face detected successfully.'
      });
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
        const drawBox = index === 0; // Only draw box for the first face by default
        
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
        if (options.drawExpressions && ctx && detection.expressions) {
          const expressions = detection.expressions;
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
      });
      
      // Show debug info if enabled
      if (options.showDebugInfo && ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 180, 60);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Faces: ${detections.length}`, 10, 20);
        ctx.fillText(`Status: ${status}`, 10, 40);
      }
    }

  }, [isModelLoaded, isCameraReady, options, status]);

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
    isModelLoaded,
    isCameraReady,
    isCameraPermissionGranted,
    isInitializing,
    switchCamera,
    stopDetection,
    reinitialize: initializeCamera
  };
}
