
import { useState, useRef, useCallback, useEffect } from 'react';
import * as faceapi from 'face-api.js';

interface UseCameraSetupProps {
  autoStart?: boolean;
}

export const useCameraSetup = ({ autoStart = false }: UseCameraSetupProps = {}) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRunningRef = useRef(false);
  
  // Get available cameras
  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      return cameras;
    } catch (error) {
      console.error('Error getting cameras:', error);
      setError('Failed to enumerate cameras');
      return [];
    }
  }, []);
  
  // Initialize camera
  const initializeCamera = useCallback(async () => {
    if (isInitializing || isCameraReady || !videoRef.current) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const cameras = await getAvailableCameras();
      if (cameras.length === 0) {
        throw new Error('No cameras found');
      }
      
      const cameraIndex = Math.min(currentCameraIndex, cameras.length - 1);
      const cameraId = cameras[cameraIndex]?.deviceId;
      
      const constraints = {
        video: {
          deviceId: cameraId ? { exact: cameraId } : undefined,
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        isRunningRef.current = true;
        
        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve();
          } else {
            resolve();
          }
        });
        
        setIsCameraReady(true);
      }
    } catch (error: any) {
      console.error('Error initializing camera:', error);
      setError(`Failed to initialize camera: ${error.message || 'Unknown error'}`);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, isCameraReady, currentCameraIndex, getAvailableCameras]);
  
  // Load face API models
  const loadModels = useCallback(async () => {
    try {
      if (!isModelLoaded) {
        const MODEL_URL = '/models';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ]);
        
        setIsModelLoaded(true);
        console.log('Face-API models loaded successfully');
      }
    } catch (error) {
      console.error('Error loading face-api models:', error);
      setError('Failed to load face detection models');
    }
  }, [isModelLoaded]);
  
  // Initialize camera and models
  const initialize = useCallback(async () => {
    setIsInitializing(true);
    await loadModels();
    await initializeCamera();
    isRunningRef.current = true;
    setIsInitializing(false);
  }, [loadModels, initializeCamera]);
  
  // Switch camera
  const switchCamera = useCallback(async () => {
    if (availableCameras.length <= 1) return;
    
    const nextCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextCameraIndex);
    
    // Re-initialize with new camera
    setIsCameraReady(false);
    await initializeCamera();
  }, [availableCameras, currentCameraIndex, initializeCamera]);
  
  // Stop detection and camera
  const stopDetection = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    isRunningRef.current = false;
    setIsCameraReady(false);
  }, []);
  
  // Auto-initialize on mount if autoStart is true
  useEffect(() => {
    if (autoStart) {
      initialize();
    }
    
    return () => {
      stopDetection();
    };
  }, [autoStart, initialize, stopDetection]);
  
  return {
    videoRef,
    canvasRef,
    isCameraReady,
    isModelLoaded,
    isInitializing,
    error,
    isRunningRef,
    streamRef,
    initialize,
    switchCamera,
    stopDetection
  };
};
