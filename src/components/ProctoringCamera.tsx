
import React, { useEffect, useState, useRef } from 'react';
import { useProctoring, ProctoringStatus, ViolationType, ObjectViolationType } from '@/hooks/useProctoring';
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
  autoStart = false
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [violationCount, setViolationCount] = useState<Record<ViolationType | ObjectViolationType, number>>({
    // Face violations
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0,
    frequentDisappearance: 0,
    identityMismatch: 0,
    // Object violations
    phoneDetected: 0,
    multiplePersonsDetected: 0,
    unknownObjectDetected: 0
  });
  const [violationLog, setViolationLog] = useState<string[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [cameraLoading, setCameraLoading] = useState(true);
  
  // Track which violations have already been flagged
  const flaggedViolationsRef = useRef<Set<ViolationType | ObjectViolationType>>(new Set());
  
  const {
    videoRef,
    canvasRef,
    status,
    violations,
    objectViolations,
    isCameraReady,
    isModelLoaded,
    isInitializing,
    isPhoneDetected,
    switchCamera,
    initialize,
    reinitialize,
    stopDetection
  } = useProctoring({
    autoStart,
    showDebugInfo: false,
    drawLandmarks: false,
    drawExpressions: false,
    detectExpressions: true,
    trackViolations: trackViolations,
    // Improved parameters for more accurate face detection
    detectionOptions: {
      faceDetectionThreshold: 0.5, // Lower threshold for face detection
      faceCenteredTolerance: 0.3, // More tolerance for face not being centered
      rapidMovementThreshold: 0.3, // Higher threshold for rapid movement detection
    }
  });

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

  useEffect(() => {
    if (trackViolations && violations) {
      // Update violation counts
      const newViolationCount = { ...violationCount };
      let newViolationsDetected = false;
      const currentTime = Date.now();
      
      // Process face violations
      Object.entries(violations).forEach(([type, count]) => {
        const violationType = type as ViolationType;
        if (count > newViolationCount[violationType]) {
          newViolationsDetected = true;
          const timestamp = new Date().toLocaleTimeString();
          const violationMessage = `[${timestamp}] ${getViolationMessage(violationType)}`;
          setViolationLog(prev => [...prev, violationMessage]);
          
          if (trackViolations && user && submissionId) {
            updateViolationInDatabase(violationMessage, 'face_violations');
          }
        }
        newViolationCount[violationType] = count;
      });
      
      // Process object violations
      Object.entries(objectViolations).forEach(([type, count]) => {
        const violationType = type as ObjectViolationType;
        if (count > newViolationCount[violationType]) {
          newViolationsDetected = true;
          const timestamp = new Date().toLocaleTimeString();
          const violationMessage = `[${timestamp}] ${getViolationMessage(violationType)}`;
          setViolationLog(prev => [...prev, violationMessage]);
          
          if (trackViolations && user && submissionId) {
            updateViolationInDatabase(violationMessage, 'object_violations');
          }
        }
        newViolationCount[violationType] = count;
      });
      
      if (newViolationsDetected) {
        setViolationCount(newViolationCount);
      }
      
      // Check for total violations exceeding threshold (5 for face violations, 3 for object violations)
      const totalFaceViolations = Object.entries(newViolationCount)
        .filter(([type]) => ['noFaceDetected', 'multipleFacesDetected', 'faceNotCentered', 'faceCovered', 'rapidMovement']
          .includes(type))
        .reduce((sum, [_, count]) => sum + count, 0);
        
      const totalObjectViolations = Object.entries(newViolationCount)
        .filter(([type]) => ['phoneDetected', 'multiplePersonsDetected', 'unknownObjectDetected']
          .includes(type))
        .reduce((sum, [_, count]) => sum + count, 0);
      
      if ((totalFaceViolations >= 5 || totalObjectViolations >= 3) && trackViolations && user && submissionId) {
        const violationSummary = formatViolationSummary(newViolationCount);
        updateViolationInDatabase(violationSummary, 'face_violations', true);
      }
    }
  }, [violations, objectViolations, trackViolations, user, submissionId]);

  const getViolationMessage = (violationType: ViolationType | ObjectViolationType): string => {
    switch (violationType) {
      // Face violations
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
      // Object violations
      case 'phoneDetected':
        return 'Phone or electronic device detected';
      case 'multiplePersonsDetected':
        return 'Multiple persons detected in frame';
      case 'unknownObjectDetected':
        return 'Unknown object detected';
      default:
        return 'Unknown violation';
    }
  };
  
  const formatViolationSummary = (violations: Record<ViolationType | ObjectViolationType, number>): string => {
    const violationEntries = Object.entries(violations)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${getViolationMessage(type as ViolationType | ObjectViolationType)}: ${count} times`);
      
    return `VIOLATION SUMMARY: ${violationEntries.join(', ')}`;
  };

  const updateViolationInDatabase = async (violationText: string, violationType: 'face_violations' | 'object_violations', isFinal: boolean = false) => {
    if (!submissionId || !user) return;
    
    try {
      // Get current violations
      const { data: submission, error: fetchError } = await supabase
        .from('submissions')
        .select(`${violationType}`)
        .eq('id', submissionId)
        .single();
      
      if (fetchError) {
        console.error(`Error fetching submission ${violationType}:`, fetchError);
        return;
      }
      
      // Initialize or update violations array
      let currentViolations: string[] = [];
      
      if (submission && submission[violationType]) {
        // Handle both string and JSON array formats
        if (Array.isArray(submission[violationType])) {
          // Fix the type error here: Convert any non-string items to strings
          currentViolations = (submission[violationType] as Json[]).map(item => String(item));
        } else {
          try {
            // If it's stored as a JSON string, parse it
            const parsedViolations = typeof submission[violationType] === 'string'
              ? JSON.parse(submission[violationType] as string)
              : submission[violationType];
            
            // Convert the parsed violations to strings
            currentViolations = Array.isArray(parsedViolations)
              ? parsedViolations.map(item => String(item))
              : [];
          } catch (e) {
            console.error(`Error parsing ${violationType}:`, e);
            currentViolations = [];
          }
        }
      }
      
      // Add new violation
      currentViolations.push(violationText);
      
      // Update submission with new violations
      const updateData: any = {
        [violationType]: currentViolations
      };
      
      if (isFinal) {
        updateData.is_terminated = true;
      }
      
      const { error: updateError } = await supabase
        .from('submissions')
        .update(updateData)
        .eq('id', submissionId);
      
      if (updateError) {
        console.error(`Error updating ${violationType}:`, updateError);
      }
      
    } catch (err) {
      console.error(`Error updating ${violationType}:`, err);
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

  const handleStartCamera = () => {
    setCameraLoading(true);
    setTimeout(() => {
      initialize();
    }, 100);
  };

  const handleRestartCamera = () => {
    setCameraLoading(true);
    setTimeout(() => {
      reinitialize();
    }, 100);
  };

  const statusConfig = statusMessages[status] || statusMessages.initializing;

  return (
    <div className="proctoring-camera-container">
      <div className="relative w-full max-w-md mx-auto">
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
          
          {/* Phone detection warning */}
          {isPhoneDetected && (
            <div className="absolute top-0 left-0 right-0 p-2 bg-red-500/80 flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-white mr-2" />
              <p className="text-sm font-medium text-white">Phone detected - this will be flagged</p>
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
        </div>

        {/* Controls with improved aesthetics */}
        {showControls && (
          <div className="flex justify-between mt-3 gap-2">
            {!isCameraReady && !isInitializing ? (
              <Button
                className="w-full bg-primary hover:bg-primary-600 shadow hover:shadow-md"
                onClick={handleStartCamera}
                disabled={isInitializing}
                type="button"
              >
                <Camera className="h-4 w-4 mr-2" />
                Enable Camera
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleRestartCamera}
                  disabled={isInitializing}
                  type="button"
                  className={cn(
                    "hover:bg-gray-100 dark:hover:bg-gray-700 transition-all",
                    "border-gray-300 dark:border-gray-600",
                    "hover:shadow-md",
                    isInitializing && "opacity-50"
                  )}
                >
                  <RefreshCw className={cn(
                    "h-4 w-4 mr-2",
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
                    isInitializing && "opacity-50"
                  )}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Switch
                </Button>
                
                <Button
                  onClick={handleVerificationComplete}
                  disabled={status !== 'faceDetected' || isInitializing}
                  className={cn(
                    "transition-all duration-300",
                    status === 'faceDetected' 
                      ? "bg-green-600 hover:bg-green-700 text-white shadow hover:shadow-md" 
                      : "bg-gray-400 text-white"
                  )}
                  type="button"
                >
                  <CheckCircle2 className={cn(
                    "h-4 w-4 mr-2",
                    status === 'faceDetected' && "animate-pulse"
                  )} />
                  Verify
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProctoringCamera;
