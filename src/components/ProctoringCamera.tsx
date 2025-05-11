import React, { useEffect, useState, useRef } from 'react';
import { useProctoring, ProctoringStatus, ViolationType } from '@/hooks/useProctoring';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, CheckCircle2, AlertCircle, Users, X, Eye, EyeOff, RefreshCw, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/types/database';

interface ProctoringCameraProps {
  onVerificationComplete?: (success: boolean) => void;
  showControls?: boolean;
  showStatus?: boolean;
  trackViolations?: boolean;
  assessmentId?: string;
  submissionId?: string;
  autoStart?: boolean;
  onViolation?: (violationText: string) => void; // Add this new prop
  className?: string;
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
  objectDetected: {
    message: 'Prohibited electronic device detected. Please remove from view.',
    icon: <Smartphone className="mr-2 h-5 w-5" />,
    color: 'text-red-500'
  },
  error: { 
    message: 'Error initializing camera. Please check permissions and try again.', 
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
  autoStart = true,
  onViolation,
  className
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [violationCount, setViolationCount] = useState<Record<ViolationType, number>>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0,
    frequentDisappearance: 0,
    identityMismatch: 0,
    objectDetected: 0
  });
  const [violationLog, setViolationLog] = useState<string[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [cameraLoading, setCameraLoading] = useState(true);
  const autoInitRef = useRef(false);
  
  const {
    videoRef,
    canvasRef,
    status,
    violations,
    detectedObjects,
    isCameraReady,
    isModelLoaded,
    isInitializing,
    switchCamera,
    resetViolationFlags,
    startCamera,
    reinitialize,
    stopDetection
  } = useProctoring({
    showDebugInfo: false,
    drawLandmarks: false,
    drawExpressions: false,
    detectExpressions: true,
    trackViolations: trackViolations,
    autoStart: autoStart,
    // Improved parameters for more accurate face detection
    detectionOptions: {
      faceDetectionThreshold: 0.5, // Lower threshold for face detection
      faceCenteredTolerance: 0.3, // More tolerance for face not being centered
      rapidMovementThreshold: 0.3, // Higher threshold for rapid movement detection
    }
  });

  // Initialize the camera when component mounts, only if autoStart is true
  useEffect(() => {
    if (autoStart && !autoInitRef.current) {
      console.log("Auto-initializing camera...");
      autoInitRef.current = true;
    }
    
    // Cleanup function that will run when component unmounts
    return () => {
      console.log("Stopping camera detection...");
      stopDetection();
    };
  }, [autoStart, stopDetection]);
  
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

  // Add a reference to track what violations have been reported
  const reportedViolationsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (trackViolations && violations) {
      // Update violation counts
      const newViolationCount = { ...violationCount };
      let newViolationsDetected = false;
      
      // Process new violations
      Object.entries(violations).forEach(([type, count]) => {
        const violationType = type as ViolationType;
        if (count > newViolationCount[violationType]) {
          // New violation occurred
          newViolationsDetected = true;
          const timestamp = new Date().toLocaleTimeString();
          const violationMessage = `[${timestamp}] ${getViolationMessage(violationType)}`;
          
          // Only log this violation if we haven't reported it yet
          if (!reportedViolationsRef.current.has(violationMessage)) {
            reportedViolationsRef.current.add(violationMessage);
            setViolationLog(prev => [...prev, violationMessage]);
            
            // Report the violation to parent component if callback provided
            if (onViolation) {
              onViolation(violationMessage);
            }
          }
        }
        newViolationCount[violationType] = count;
      });
      
      if (newViolationsDetected) {
        setViolationCount(newViolationCount);
        // Reset violation flags after some time to allow for future detection of the same type
        setTimeout(() => {
          resetViolationFlags();
        }, 60000); // Reset flags after 1 minute
      }
      
      // Check for total violations exceeding threshold
      const totalViolations = Object.values(newViolationCount).reduce((sum, count) => sum + count, 0);
      if (totalViolations >= 3 && trackViolations && user && submissionId) {
        const violationSummary = formatViolationSummary(newViolationCount);
        
        // Also report the violation summary if not already reported
        if (!reportedViolationsRef.current.has(violationSummary)) {
          reportedViolationsRef.current.add(violationSummary);
          
          if (onViolation) {
            onViolation(violationSummary);
          }
        }
      }
    }
  }, [violations, trackViolations, user, submissionId, resetViolationFlags, onViolation]);

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
        return 'Prohibited electronic device detected';
      default:
        return 'Unknown violation';
    }
  };
  
  const formatViolationSummary = (violations: Record<ViolationType, number>): string => {
    const violationEntries = Object.entries(violations)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${getViolationMessage(type as ViolationType)}: ${count} times`);
      
    return `VIOLATION SUMMARY: ${violationEntries.join(', ')}`;
  };

  // We're not updating the database in real-time anymore
  // Instead, we're just collecting violations and will submit them at the end
  // So this function is now primarily for logging purposes
  const updateViolationInDatabase = async (violationText: string, isFinal: boolean = false) => {
    console.log(`Violation detected: ${violationText}${isFinal ? ' (Final)' : ''}`);
    
    // If this is a final violation that terminates the session, still show a toast
    if (isFinal) {
      toast({
        title: "Assessment Terminated",
        description: "Multiple violations detected. Your session has been flagged.",
        variant: "destructive"
      });
    }
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

  const handleStartCamera = () => {
    setCameraLoading(true);
    startCamera();
  };

  const statusConfig = statusMessages[status] || statusMessages.initializing;

  return (
    <div className={cn("proctoring-camera-container", className)}>
      <div className="relative w-full max-w-md mx-auto">
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
        {showControls && (
          <div className="flex justify-between mt-4">
            {!autoStart && !isCameraReady ? (
              <Button 
                className="w-full"
                onClick={handleStartCamera}
                disabled={isInitializing}
                type="button"
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
            ) : (
              <>
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
                
                {onVerificationComplete && (
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
                )}
              </>
            )}
          </div>
        )}
        
        {/* Violation counts (only in tracking mode) */}
        {trackViolations && Object.values(violationCount).some(count => count > 0) && (
          <Card className="mt-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-2">Proctoring Violations:</h3>
              <ul className="text-xs space-y-1 text-amber-700 dark:text-amber-300">
                {Object.entries(violationCount).map(([type, count]) => (
                  count > 0 && (
                    <li key={type} className="flex items-center justify-between">
                      <span>{getViolationMessage(type as ViolationType)}</span>
                      <span className="font-medium">{count}</span>
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
