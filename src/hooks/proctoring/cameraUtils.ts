
import { useToast } from '@/hooks/use-toast';

// Initialize camera with improved error handling
export const initializeCamera = async (
  videoRef: React.RefObject<HTMLVideoElement>,
  toast: ReturnType<typeof useToast>,
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream | null> => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast({
      title: 'Camera Error',
      description: 'Your browser does not support camera access.',
      variant: 'destructive',
    });
    return null;
  }

  try {
    // Request camera access with optimized settings for performance
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 640 }, // Lower resolution for better performance
        height: { ideal: 480 },
        frameRate: { ideal: 15 } // Lower framerate to reduce CPU usage
      }
    });

    // Set the stream to the video element
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      // Add event listener for when video is ready to play
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) videoRef.current.play();
      };
    }
    
    return stream;
  } catch (error) {
    console.error('Error accessing camera:', error);
    toast({
      title: 'Camera Permission Denied',
      description: 'Please allow camera access for proctoring.',
      variant: 'destructive',
    });
    return null;
  }
};

// Stop the camera stream
export const stopCameraStream = (stream: MediaStream | null): void => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

// Clear canvas
export const clearCanvas = (canvas: HTMLCanvasElement | null): void => {
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
};
