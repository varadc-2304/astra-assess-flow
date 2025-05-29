
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useProctoring, ProctoringStatus, ViolationType } from '@/hooks/useProctoring';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, CheckCircle2, AlertCircle, Users, X, Eye, EyeOff, RefreshCw } from 'lucide-react';
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
  size?: 'default' | 'small' | 'large';
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
  }
};

export const ProctoringCamera: React.FC<ProctoringCameraProps> = ({
  onVerificationComplete,
  showControls = true,
  showStatus = true,
  trackViolations = false,
  assessmentId,
  submissionId,
  size = 'default'
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [violationLog, setViolationLog] = useState<string[]>([]);
  const [cameraLoading, setCameraLoading] = useState(true);
  const autoInitRef = useRef(false);
  
  // Database update function
  const updateViolationInDatabase = useCallback(async (violationType: ViolationType, totalCount: number) => {
    if (!submissionId || !user) return;
    
    try {
      console.log(`Updating database: ${violationType} = ${totalCount}`);
      
      // Get current violations
      const { data: submission, error: fetchError } = await supabase
        .from('submissions')
        .select('face_violations')
        .eq('id', submissionId)
        .single();
      
      if (fetchError) {
        console.error("Error fetching submission:", fetchError);
        return;
      }
      
      // Initialize or update violations array
      let currentViolations: string[] = [];
      
      if (submission && submission.face_violations) {
        // Handle both string and JSON array formats
        if (Array.isArray(submission.face_violations)) {
          currentViolations = (submission.face_violations as Json[]).map(item => String(item));
        } else {
          try {
            const parsedViolations = typeof submission.face_violations === 'string'
              ? JSON.parse(submission.face_violations)
              : submission.face_violations;
            
            currentViolations = Array.isArray(parsedViolations)
              ? parsedViolations.map(item => String(item))
              : [];
          } catch (e) {
            console.error("Error parsing face_violations:", e);
            currentViolations = [];
          }
        }
      }
      
      // Create violation message with timestamp
      const timestamp = new Date().toLocaleTimeString();
      const violationMessage = `[${timestamp}] ${getViolationMessage(violationType)} (Total: ${totalCount})`;
      
      // Add new violation to log
      currentViolations.push(violationMessage);
      setViolationLog(prev => [...prev, violationMessage]);
      
      // Update submission with new violations
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ 
          face_violations: currentViolations,
          is_terminated: totalCount >= 5 ? true : undefined // Terminate after 5 violations
        })
        .eq('id', submissionId);
      
      if (updateError) {
        console.error("Error updating face violations:", updateError);
      } else {
        console.log("Successfully updated face violations in database");
      }
      
      // Show warning for multiple violations
      if (totalCount >= 3) {
        toast({
          title: "Multiple Violations Detected",
          description: `${getViolationMessage(violationType)} detected ${totalCount} times. Please maintain proper exam conduct.`,
          variant: "destructive",
        });
      }
      
      // Terminate session if too many violations
      if (totalCount >= 5) {
        toast({
          title: "Assessment Terminated",
          description: "Too many proctoring violations detected. Your session has been terminated.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error updating face violations:", err);
    }
  }, [submissionId, user, toast]);

  // Handle violation recording callback
  const handleViolationRecorded = useCallback((violationType: ViolationType, totalCount: number) => {
    console.log(`Violation recorded: ${violationType}, total count: ${totalCount}`);
    updateViolationInDatabase(violationType, totalCount);
  }, [updateViolationInDatabase]);
  
  const {
    videoRef,
    canvasRef,
    status,
    violations,
    currentViolationCounts,
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
    trackViolations: trackViolations,
    detectionOptions: {
      faceDetectionThreshold: 0.5,
      faceCenteredTolerance: 0.3,
      rapidMovementThreshold: 0.3,
    },
    onViolationRecorded: handleViolationRecorded
  });

  // Initialize the camera when component mounts
  useEffect(() => {
    if (!autoInitRef.current) {
      console.log("Initializing camera...");
      reinitialize();
      autoInitRef.current = true;
    }
    
    // Cleanup function that will run when component unmounts
    return () => {
      console.log("Stopping camera detection...");
      stopDetection();
    };
  }, [reinitialize, stopDetection]);
  
  // Update camera loading state
  useEffect(() => {
    if (isInitializing) {
      setCameraLoading(true);
    } else if (isCameraReady && isModelLoaded) {
      const timer = setTimeout(() => {
        setCameraLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, isCameraReady, isModelLoaded]);

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
      default:
        return 'Unknown violation';
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

  const statusConfig = statusMessages[status] || statusMessages.initializing;
  
  // Determine container size based on the size prop
  const containerSizeClass = size === 'small' ? 'max-w-[180px]' : 
                            size === 'large' ? 'max-w-lg' : 'max-w-md';

  return (
    <div className="proctoring-camera-container">
      <div className={`relative w-full ${containerSizeClass} mx-auto`}>
        {/* Video feed container with improved aesthetics */}
        <div className="relative overflow-hidden rounded-lg bg-gray-900 mb-4 border border-gray-700/50 shadow-lg">
          <video
            ref={videoRef}
            className={cn(
              "w-full h-full object-cover",
              isCameraReady ? "animate-fade-in" : "opacity-0"
            )}
            autoPlay
            playsInline
            muted
          />
          <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 w-full h-full pointer-events-none" 
          />
          
          {/* Loading overlay with improved animation */}
          {cameraLoading && (
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black bg-opacity-80 flex flex-col items-center justify-center z-10">
              <div className="text-center">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full border-2 border-gray-300 border-opacity-20 border-t-white animate-spin mx-auto mb-2"></div>
                  <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
                    <Camera className="h-4 w-4 text-gray-300 animate-pulse" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-100 mt-3">Initializing camera...</p>
                <p className="text-xs text-gray-400 mt-1">Please allow camera access if prompted</p>
              </div>
            </div>
          )}

          {/* Status indicator with animation */}
          {showStatus && isCameraReady && isModelLoaded && (
            <div className={cn(
              "absolute bottom-0 left-0 right-0 p-2",
              "bg-gradient-to-t from-gray-900 to-transparent",
              "transition-opacity duration-300",
              status === 'faceDetected' ? "opacity-50" : "opacity-90"
            )}>
              <div className={cn(
                "flex items-center px-2 py-1 rounded-md",
                "backdrop-blur-sm",
                "transition-colors duration-300",
                status === 'faceDetected' ? "bg-green-500/20" : 
                status === 'error' ? "bg-red-500/20" : "bg-amber-500/20"
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full mr-2",
                  status === 'faceDetected' ? "bg-green-500 animate-pulse" : 
                  status === 'error' ? "bg-red-500 animate-pulse" : "bg-amber-500 animate-pulse"
                )}></div>
                <p className={cn(
                  "text-xs font-medium truncate",
                  status === 'faceDetected' ? "text-green-300" : 
                  status === 'error' ? "text-red-300" : "text-amber-300"
                )}>
                  {statusMessages[status]?.message || "Monitoring..."}
                </p>
              </div>
            </div>
          )}

          {/* Violation counter display */}
          {trackViolations && currentViolationCounts && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs p-2 rounded">
              <div className="text-center">
                <div className="font-semibold">Violations</div>
                {Object.entries(currentViolationCounts).map(([type, count]) => (
                  count > 0 && (
                    <div key={type} className="flex justify-between gap-2">
                      <span className="truncate">{getViolationMessage(type as ViolationType)}</span>
                      <span className="font-bold text-red-400">{count}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls with improved aesthetics */}
        {showControls && (
          <div className="flex justify-between mt-3 gap-2">
            <Button
              variant="outline"
              onClick={handleRestartCamera}
              disabled={isInitializing}
              type="button"
              className={cn(
                "hover:bg-gray-100 dark:hover:bg-gray-700 transition-all",
                "border-gray-300 dark:border-gray-600",
                "hover:shadow-md",
                isInitializing && "opacity-50",
                size === 'small' ? "text-xs px-2 py-1 h-7" : ""
              )}
            >
              <RefreshCw className={cn(
                "mr-2",
                size === 'small' ? "h-3 w-3" : "h-4 w-4",
                isInitializing && "animate-spin"
              )} />
              Restart
            </Button>
            
            <Button
              variant="outline"
              onClick={switchCamera}
              disabled={isInitializing}
              type="button"
              className={cn(
                "hover:bg-gray-100 dark:hover:bg-gray-700 transition-all",
                "border-gray-300 dark:border-gray-600",
                "hover:shadow-md",
                isInitializing && "opacity-50",
                size === 'small' ? "text-xs px-2 py-1 h-7" : ""
              )}
            >
              <Camera className={cn(
                "mr-2",
                size === 'small' ? "h-3 w-3" : "h-4 w-4"
              )} />
              Switch
            </Button>
            
            <Button
              onClick={handleVerificationComplete}
              disabled={status !== 'faceDetected' || isInitializing}
              className={cn(
                "transition-all duration-300",
                status === 'faceDetected' 
                  ? "bg-green-600 hover:bg-green-700 text-white shadow hover:shadow-md" 
                  : "bg-gray-400 text-white",
                size === 'small' ? "text-xs px-2 py-1 h-7" : ""
              )}
              type="button"
            >
              <CheckCircle2 className={cn(
                "mr-2",
                size === 'small' ? "h-3 w-3" : "h-4 w-4",
                status === 'faceDetected' && "animate-pulse"
              )} />
              Verify
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProctoringCamera;
