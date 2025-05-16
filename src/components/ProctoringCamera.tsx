
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
  size?: 'default' | 'small' | 'large'; // Size prop
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
  size = 'default' // Default size if not specified
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
    electronicDeviceDetected: 0
  });
  const [violationLog, setViolationLog] = useState<string[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [cameraLoading, setCameraLoading] = useState(true);
  const [deviceDetected, setDeviceDetected] = useState(false);
  const autoInitRef = useRef(false);
  
  // Track which violations have already been flagged
  const flaggedViolationsRef = useRef<Set<ViolationType>>(new Set());
  
  // Track the last time each violation type was flagged (for 60-second cooldown)
  const lastViolationTimeRef = useRef<Record<ViolationType, number>>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0,
    frequentDisappearance: 0,
    identityMismatch: 0,
    electronicDeviceDetected: 0
  });
  
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
    reinitialize,
    stopDetection
  } = useProctoring({
    showDebugInfo: false,
    drawLandmarks: false,
    drawExpressions: false,
    detectExpressions: true,
    trackViolations: trackViolations,
    detectObjects: true,
    // Improved parameters for more accurate face detection
    detectionOptions: {
      faceDetectionThreshold: 0.5, // Lower threshold for face detection (was 0.65)
      faceCenteredTolerance: 0.3, // More tolerance for face not being centered (was 0.25)
      rapidMovementThreshold: 0.3, // Higher threshold for rapid movement detection (was 0.25)
    }
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
      // Add a small delay to ensure the UI updates smoothly
      const timer = setTimeout(() => {
        setCameraLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, isCameraReady, isModelLoaded]);

  // Check for electronic devices
  useEffect(() => {
    if (detectedObjects && detectedObjects.length > 0) {
      const electronicDevices = detectedObjects.filter(obj => {
        const electronicClasses = [
          'cell phone', 'laptop', 'tv', 'remote', 'keyboard', 
          'mouse', 'microwave', 'oven', 'toaster'
        ];
        return electronicClasses.includes(obj.class) && obj.score > 0.6;
      });
      
      if (electronicDevices.length > 0) {
        setDeviceDetected(true);
        
        // Show a toast notification when an electronic device is first detected
        if (!flaggedViolationsRef.current.has('electronicDeviceDetected')) {
          flaggedViolationsRef.current.add('electronicDeviceDetected');
          
          toast({
            title: "Electronic Device Detected",
            description: `${electronicDevices[0].class} detected. This may be considered a violation.`,
            variant: "destructive",
          });
        }
      } else {
        setDeviceDetected(false);
      }
    }
  }, [detectedObjects, toast]);

  useEffect(() => {
    if (trackViolations && violations) {
      // Update violation counts
      const newViolationCount = { ...violationCount };
      let newViolationsDetected = false;
      const currentTime = Date.now();
      
      // Process new violations
      Object.entries(violations).forEach(([type, count]) => {
        const violationType = type as ViolationType;
        if (count > newViolationCount[violationType]) {
          // Check if 60 seconds have passed since the last time this violation type was flagged
          const timeSinceLastViolation = currentTime - lastViolationTimeRef.current[violationType];
          const shouldFlag = timeSinceLastViolation >= 60000; // 60 seconds in milliseconds
          
          if (shouldFlag) {
            // Update the last violation time for this type
            lastViolationTimeRef.current[violationType] = currentTime;
            
            // New violation occurred
            newViolationsDetected = true;
            const timestamp = new Date().toLocaleTimeString();
            const violationMessage = `[${timestamp}] ${getViolationMessage(violationType)}`;
            setViolationLog(prev => [...prev, violationMessage]);
            
            if (trackViolations && user && submissionId) {
              updateViolationInDatabase(violationMessage);
            }
          }
        }
        newViolationCount[violationType] = count;
      });
      
      if (newViolationsDetected) {
        setViolationCount(newViolationCount);
      }
      
      // Check for total violations exceeding threshold
      const totalViolations = Object.values(newViolationCount).reduce((sum, count) => sum + count, 0);
      if (totalViolations >= 3 && trackViolations && user && submissionId) {
        const violationSummary = formatViolationSummary(newViolationCount);
        updateViolationInDatabase(violationSummary, true);
      }
    }
  }, [violations, trackViolations, user, submissionId]);

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
      case 'electronicDeviceDetected':
        return 'Electronic device detected';
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

  const updateViolationInDatabase = async (violationText: string, isFinal: boolean = false) => {
    if (!submissionId || !user) return;
    
    try {
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
          // Fix the type error here: Convert any non-string items to strings
          currentViolations = (submission.face_violations as Json[]).map(item => String(item));
        } else {
          try {
            // If it's stored as a JSON string, parse it
            const parsedViolations = typeof submission.face_violations === 'string'
              ? JSON.parse(submission.face_violations)
              : submission.face_violations;
            
            // Convert the parsed violations to strings
            currentViolations = Array.isArray(parsedViolations)
              ? parsedViolations.map(item => String(item))
              : [];
          } catch (e) {
            console.error("Error parsing face_violations:", e);
            currentViolations = [];
          }
        }
      }
      
      // Add new violation
      currentViolations.push(violationText);
      
      // Update submission with new violations
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ 
          face_violations: currentViolations,
          is_terminated: isFinal ? true : undefined
        })
        .eq('id', submissionId);
      
      if (updateError) {
        console.error("Error updating face violations:", updateError);
      }
    } catch (err) {
      console.error("Error updating face violations:", err);
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

          {/* Electronic device detection warning */}
          {deviceDetected && !cameraLoading && (
            <div className="absolute top-0 left-0 right-0 p-2 bg-red-500/80 text-white text-sm flex items-center justify-center animate-pulse">
              <Smartphone className="mr-2 h-4 w-4" />
              Electronic device detected!
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
