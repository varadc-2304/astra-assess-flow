
import { useState, useEffect, useCallback, RefObject } from 'react';

interface UseCameraSetupProps {
  videoRef: RefObject<HTMLVideoElement>;
  videoStream: RefObject<MediaStream | null>;
}

export const useCameraSetup = ({ videoRef, videoStream }: UseCameraSetupProps) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  
  // Function to setup camera
  const setupCamera = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      setIsInitializing(true);
      
      // Stop any existing video stream
      if (videoStream.current) {
        videoStream.current.getTracks().forEach(track => track.stop());
      }
      
      // Get available video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // If no camera is found, throw an error
      if (videoDevices.length === 0) {
        throw new Error('No camera found');
      }
      
      // Use environment camera by default (back camera) if available
      let selectedDeviceId = currentDeviceId;
      if (!selectedDeviceId) {
        // Try to find environment camera (back camera) first
        const environmentCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('environment')
        );
        
        selectedDeviceId = environmentCamera?.deviceId || videoDevices[0].deviceId;
      }
      
      // Request access to the camera
      console.log("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: selectedDeviceId ? undefined : "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      
      // Store the stream reference
      videoStream.current = stream;
      setCurrentDeviceId(selectedDeviceId);
      
      // Set the video source to the stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("Video playing");
                setIsCameraReady(true);
              })
              .catch(error => {
                console.error("Error playing video:", error);
              });
          }
        };
      }
    } catch (error) {
      console.error("Error setting up camera:", error);
      setIsCameraReady(false);
      throw error;
    } finally {
      setIsInitializing(false);
    }
  }, [currentDeviceId, videoRef, videoStream]);
  
  // Function to switch camera
  const switchCamera = useCallback(async () => {
    try {
      setIsInitializing(true);
      
      // Get all video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // If there's only one camera, don't do anything
      if (videoDevices.length <= 1) {
        console.log("Only one camera available, cannot switch");
        return;
      }
      
      // Find the index of the current device
      const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
      
      // Select the next device in the list or go back to the first one
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDeviceId = videoDevices[nextIndex].deviceId;
      
      // Set the new device id and reinitialize the camera
      setCurrentDeviceId(nextDeviceId);
      
      // Stop the current stream
      if (videoStream.current) {
        videoStream.current.getTracks().forEach(track => track.stop());
      }
      
      // Request access to the new camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: nextDeviceId },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      
      // Store the new stream reference
      videoStream.current = stream;
      
      // Set the video source to the new stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("Video playing after camera switch");
                setIsCameraReady(true);
              })
              .catch(error => {
                console.error("Error playing video after camera switch:", error);
              });
          }
        };
      }
    } catch (error) {
      console.error("Error switching camera:", error);
    } finally {
      setIsInitializing(false);
    }
  }, [currentDeviceId, videoRef, videoStream]);
  
  // Function to stop camera
  const stopCamera = useCallback(() => {
    if (videoStream.current) {
      videoStream.current.getTracks().forEach(track => track.stop());
      videoStream.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraReady(false);
  }, [videoRef, videoStream]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);
  
  return {
    isCameraReady,
    isInitializing,
    setupCamera,
    stopCamera,
    switchCamera
  };
};
