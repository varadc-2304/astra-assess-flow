
import React from 'react';
import { useProctoring, ProctoringStatus } from '@/hooks/useProctoring';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProctoringCameraProps {
  onVerificationComplete?: (success: boolean) => void;
  showControls?: boolean;
  showStatus?: boolean;
}

const statusMessages: Record<ProctoringStatus, { message: string; icon: React.ReactNode; color: string }> = {
  initializing: { 
    message: 'Initializing camera...', 
    icon: <Loader2 className="animate-spin mr-2 h-5 w-5" />,
    color: 'text-blue-500'
  },
  noFaceDetected: { 
    message: 'No face detected. Please position yourself correctly.', 
    icon: <AlertCircle className="mr-2 h-5 w-5" />,
    color: 'text-amber-500'
  },
  faceDetected: { 
    message: 'Face detected successfully!', 
    icon: <CheckCircle2 className="mr-2 h-5 w-5" />,
    color: 'text-green-500'
  },
  multipleFacesDetected: { 
    message: 'Multiple faces detected. Please ensure only you are visible.', 
    icon: <Users className="mr-2 h-5 w-5" />,
    color: 'text-red-500'
  },
  error: { 
    message: 'Error initializing camera. Please check permissions.', 
    icon: <AlertCircle className="mr-2 h-5 w-5" />,
    color: 'text-red-500'
  }
};

export const ProctoringCamera: React.FC<ProctoringCameraProps> = ({
  onVerificationComplete,
  showControls = true,
  showStatus = true
}) => {
  const {
    videoRef,
    canvasRef,
    status,
    isCameraReady,
    isModelLoaded,
    isInitializing,
    switchCamera,
    reinitialize
  } = useProctoring({
    showDebugInfo: false,
    drawLandmarks: false,
    drawExpressions: false,
    detectExpressions: true
  });

  const handleVerificationComplete = () => {
    // Only allow completion if face is detected
    if (status === 'faceDetected' && onVerificationComplete) {
      onVerificationComplete(true);
    }
  };

  const statusConfig = statusMessages[status];

  return (
    <div className="proctoring-camera-container">
      <div className="relative w-full max-w-md mx-auto">
        {/* Video feed container */}
        <div className="relative overflow-hidden rounded-lg bg-black mb-4">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 w-full h-full pointer-events-none" 
          />
          
          {/* Loading overlay */}
          {isInitializing && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Loading camera...</p>
              </div>
            </div>
          )}

          {/* Status indicator */}
          {showStatus && isCameraReady && isModelLoaded && (
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gray-900/80">
              <div className={`flex items-center ${statusConfig.color}`}>
                {statusConfig.icon}
                <span className="text-white text-sm">{statusConfig.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              onClick={reinitialize}
              disabled={isInitializing}
              type="button"
            >
              <Camera className="h-4 w-4 mr-2" />
              Restart Camera
            </Button>
            
            <Button
              variant="outline"
              onClick={switchCamera}
              disabled={isInitializing}
              type="button"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 16L21 12M21 12L17 8M21 12H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 6.5C13.5 6.5 15 8 15 12C15 16 13.5 17.5 11 17.5C8.5 17.5 7 16 7 12C7 8 8.5 6.5 11 6.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Switch Camera
            </Button>
            
            <Button
              onClick={handleVerificationComplete}
              disabled={status !== 'faceDetected' || isInitializing}
              className={cn(
                status === 'faceDetected' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400',
              )}
              type="button"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProctoringCamera;
