
import { useToast } from "@/hooks/use-toast";

// Define constants
const CAMERA_CONSTRAINTS = {
  video: { 
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: { ideal: 'user' }
  }
};

// Initialize camera with better error handling
export const initializeCamera = async (
  videoRef: React.RefObject<HTMLVideoElement>,
  toastUtils: ReturnType<typeof useToast>, // Changed parameter type
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream | null> => {
  try {
    if (!videoRef.current) {
      return null;
    }
    
    // Update constraints based on facing mode
    const constraints = {
      video: {
        ...CAMERA_CONSTRAINTS.video,
        facingMode: { ideal: facingMode }
      }
    };
    
    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Set video source
    videoRef.current.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => resolve();
      } else {
        resolve(); // Resolve anyway if video ref is gone
      }
    });
    
    return stream;
  } catch (error) {
    console.error('Error accessing camera:', error);
    
    // Show appropriate error message
    toastUtils.toast({  // Fixed toast call
      title: 'Camera Access Error',
      description: 'Please ensure you have granted camera permission in browser settings.',
      variant: 'destructive',
    });
    
    return null;
  }
};

// Stop camera stream
export const stopCameraStream = (stream: MediaStream): void => {
  stream.getTracks().forEach(track => track.stop());
};

// Clear canvas
export const clearCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};
