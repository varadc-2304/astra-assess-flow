
import React, { useEffect, useState, useRef } from 'react';
import { useProctoring, ProctoringStatus, ViolationType } from '@/hooks/useProctoring';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, CheckCircle2, AlertCircle, Users, X, Eye, EyeOff, RefreshCw, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ProctoringCameraProps {
  onVerificationComplete?: (success: boolean) => void;
  showControls?: boolean;
  showStatus?: boolean;
  trackViolations?: boolean;
  assessmentId?: string;
  submissionId?: string;
  enableOnMount?: boolean;
  className?: string;
  isDraggable?: boolean;
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
  faceCovered: {
    message: 'Face appears to be partially covered. Please improve lighting or reposition.', 
    icon: <EyeOff className="mr-2 h-5 w-5" />,
    color: 'text-amber-500' 
  },
  faceNotCentered: {
    message: 'Face not centered. Please position yourself in the middle of the frame.',
    icon: <X className="mr-2 h-5 w-5" />,
    color: 'text-amber-500'
  },
  rapidMovement: {
    message: 'Rapid head movement detected. Please stay still.',
    icon: <AlertCircle className="mr-2 h-5 w-5" />,
    color: 'text-amber-500'
  },
  error: { 
    message: 'Error initializing camera. Please check permissions and try again.', 
    icon: <AlertCircle className="mr-2 h-5 w-5" />,
    color: 'text-red-500'
  },
  objectDetected: {
    message: 'Unauthorized object detected. Please remove it from view.',
    icon: <AlertCircle className="mr-2 h-5 w-5" />,
    color: 'text-red-500'
  }
};

export const ProctoringCamera: React.FC<ProctoringCameraProps> = ({
  onVerificationComplete,
  showControls = true,
  showStatus = true,
  trackViolations = false,
  assessmentId,
  submissionId,
  enableOnMount = false,
  className = '',
  isDraggable = false
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  // Track violations without duplicates
  const [violationMap, setViolationMap] = useState<Record<ViolationType, boolean>>({
    noFaceDetected: false,
    multipleFacesDetected: false,
    faceNotCentered: false,
    faceCovered: false,
    rapidMovement: false,
    frequentDisappearance: false,
    identityMismatch: false,
    objectDetected: false
  });
  const [violationLog, setViolationLog] = useState<string[]>([]);
  const [cameraLoading, setCameraLoading] = useState(true);
  const autoInitRef = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(enableOnMount);
  
  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    videoRef,
    canvasRef,
    status,
    violations,
    isCameraReady,
    isModelLoaded,
    isInitializing,
    switchCamera,
    reinitialize,
    stopDetection
  } = useProctoring({
    showDebugInfo: false,
    drawLandmarks: false,
    drawExpressions: false,
    detectExpressions: true,
    trackViolations: trackViolations && cameraEnabled,
    detectObjects: true,
    enabled: cameraEnabled,
    // Improved parameters for more accurate face detection
    detectionOptions: {
      faceDetectionThreshold: 0.5, // Lower threshold for face detection
      faceCenteredTolerance: 0.3, // More tolerance for face not being centered
      rapidMovementThreshold: 0.3, // Higher threshold for rapid movement detection
    }
  });

  // Initialize the camera when component mounts and enabled
  useEffect(() => {
    if (cameraEnabled && !autoInitRef.current) {
      console.log("Initializing camera...");
      reinitialize();
      autoInitRef.current = true;
    }
    
    // Cleanup function that will run when component unmounts
    return () => {
      if (cameraEnabled) {
        console.log("Stopping camera detection...");
        stopDetection();
      }
    };
  }, [cameraEnabled, reinitialize, stopDetection]);
  
  // Update camera loading state
  useEffect(() => {
    if (isInitializing) {
      setCameraLoading(true);
    } else if (isCameraReady && isModelLoaded) {
      // Add a small delay to ensure the UI updates smoothly
      const timer = setTimeout(() => {
        setCameraLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, isCameraReady, isModelLoaded]);

  // Process violations without duplicates
  useEffect(() => {
    if (trackViolations && violations && cameraEnabled) {
      // Check for new violations
      let newViolationsDetected = false;
      let newViolationLog: string[] = [...violationLog];
      const newViolationMap = { ...violationMap };
      
      // Process new violations
      Object.entries(violations).forEach(([type, count]) => {
        const violationType = type as ViolationType;
        if (count > 0 && !newViolationMap[violationType]) {
          // Only log each violation type once
          newViolationMap[violationType] = true;
          newViolationsDetected = true;
          
          const timestamp = new Date().toLocaleTimeString();
          const violationMessage = `[${timestamp}] ${getViolationMessage(violationType)}`;
          newViolationLog.push(violationMessage);
        }
      });
      
      if (newViolationsDetected) {
        setViolationMap(newViolationMap);
        setViolationLog(newViolationLog);
      }
    }
  }, [violations, trackViolations, cameraEnabled]);

  const getViolationMessage = (violationType: ViolationType): string => {
    switch (violationType) {
      case 'noFaceDetected':
        return 'No face detected';
      case 'multipleFacesDetected':
        return 'Multiple faces detected';
      case 'faceNotCentered':
        return 'Face not centered in frame';
      case 'faceCovered':
        return 'Face may be partially obstructed';
      case 'rapidMovement':
        return 'Rapid head movement detected';
      case 'frequentDisappearance':
        return 'Face frequently disappearing';
      case 'identityMismatch':
        return 'Face identity mismatch';
      case 'objectDetected':
        return 'Unauthorized object detected (phone/tablet)';
      default:
        return 'Unknown violation';
    }
  };
  
  // Log violations without duplicate entries
  const getViolationData = (): string[] => {
    return violationLog;
  };

  const handleVerificationComplete = () => {
    // Only allow completion if face is detected
    if (status === 'faceDetected' && onVerificationComplete) {
      onVerificationComplete(true);
    } else if (status !== 'faceDetected' && onVerificationComplete) {
      toast({
        title: "Verification Failed",
        description: "Please ensure your face is clearly visible and centered before verifying.",
        variant: "destructive",
      });
    }
  };

  const handleRestartCamera = () => {
    setCameraLoading(true);
    setTimeout(() => {
      reinitialize();
    }, 100);
  };
  
  const handleEnableCamera = () => {
    setCameraEnabled(true);
  };

  const statusConfig = statusMessages[status] || statusMessages.initializing;
  
  // Drag functionality
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggable) return;
    
    setIsDragging(true);
    
    if ('touches' in e) {
      // Touch event
      dragStartPos.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      };
    } else {
      // Mouse event
      dragStartPos.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      
      e.preventDefault();
    }
  };
  
  const handleDragMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | MouseEvent | TouchEvent) => {
    if (!isDragging || !isDraggable) return;
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    setPosition({
      x: clientX - dragStartPos.current.x,
      y: clientY - dragStartPos.current.y
    });
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
  };
  
  // Add event listeners for drag
  useEffect(() => {
    if (isDraggable) {
      const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
      const handleTouchMove = (e: TouchEvent) => handleDragMove(e);
      const handleUp = () => handleDragEnd();
      
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('mouseup', handleUp);
        document.addEventListener('touchend', handleUp);
      }
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('mouseup', handleUp);
        document.removeEventListener('touchend', handleUp);
      };
    }
  }, [isDragging, isDraggable]);

  // Only show one of these based on conditions
  if (!cameraEnabled && !enableOnMount) {
    return (
      <div className="flex justify-center">
        <Button
          onClick={handleEnableCamera}
          className="bg-astra-red hover:bg-red-600 text-white"
        >
          <Camera className="h-4 w-4 mr-2" />
          Enable Camera
        </Button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`proctoring-camera-container ${className}`}
      style={isDraggable ? {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        cursor: isDragging ? 'grabbing' : 'grab'
      } : {}}
    >
      <div 
        className={`relative w-full ${isDraggable ? 'max-w-[240px]' : 'max-w-md'} mx-auto`}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        {/* Move handle for draggable mode */}
        {isDraggable && (
          <div className="absolute top-0 left-0 right-0 p-2 bg-black/50 flex justify-center z-20 cursor-move">
            <Move className="h-4 w-4 text-white/80" />
          </div>
        )}
        
        {/* Video feed container */}
        <div className="relative overflow-hidden rounded-lg bg-black mb-4 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
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
          {cameraLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
              <div className="text-center text-white">
                <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Initializing camera...</p>
                <p className="text-xs text-gray-300 mt-2">Please allow camera access if prompted</p>
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
        {showControls && !isDraggable && (
          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              onClick={handleRestartCamera}
              disabled={isInitializing}
              type="button"
              className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Restart Camera
            </Button>
            
            <Button
              variant="outline"
              onClick={switchCamera}
              disabled={isInitializing}
              type="button"
              className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Camera className="h-4 w-4 mr-2" />
              Switch Camera
            </Button>
            
            <Button
              onClick={handleVerificationComplete}
              disabled={status !== 'faceDetected' || isInitializing}
              className={cn(
                "transition-colors",
                status === 'faceDetected' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-400'
              )}
              type="button"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify
            </Button>
          </div>
        )}
        
        {/* Violation counts (only in tracking mode and not draggable) */}
        {trackViolations && !isDraggable && Object.values(violationMap).some(Boolean) && (
          <Card className="mt-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-2">Proctoring Violations:</h3>
              <ul className="text-xs space-y-1 text-amber-700 dark:text-amber-300">
                {Object.entries(violationMap).map(([type, hasViolation]) => (
                  hasViolation && (
                    <li key={type} className="flex items-center justify-between">
                      <span>{getViolationMessage(type as ViolationType)}</span>
                      <span className="font-medium">Detected</span>
                    </li>
                  )
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProctoringCamera;
