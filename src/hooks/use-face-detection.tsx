
import { useState, useCallback, useRef, useEffect } from 'react';

export const useFaceDetection = () => {
  const [faceDetected, setFaceDetected] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [violations, setViolations] = useState(0);
  const [faceViolations, setFaceViolations] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startDetection = useCallback(async () => {
    console.log('Starting face detection...');
    setIsInitializing(true);
    
    try {
      // Request camera permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      setStream(mediaStream);
      setFaceDetected(true); // For now, assume face is detected when camera starts
      console.log('Face detection started successfully');
      
      // If video element exists, set the stream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
    } catch (error) {
      console.error('Failed to start camera:', error);
      setFaceDetected(false);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const stopDetection = useCallback(() => {
    console.log('Stopping face detection...');
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setFaceDetected(false);
  }, [stream]);

  const enterFullScreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullScreenMode(true);
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    }
  }, []);

  const exitFullScreen = useCallback(() => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullScreenMode(false);
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreenMode(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return {
    startDetection,
    stopDetection,
    faceDetected,
    isFullScreenMode,
    enterFullScreen,
    exitFullScreen,
    violations,
    setViolations,
    faceViolations,
    setFaceViolations,
    isInitializing,
    videoRef,
  };
};
