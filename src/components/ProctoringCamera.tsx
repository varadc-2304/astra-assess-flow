
import React, { useEffect, useState, useRef } from 'react';
import { useProctoring, ProctoringStatus, ViolationType } from '@/hooks/useProctoring';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, CheckCircle2, AlertCircle, Users, X, Eye, EyeOff, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/types/database';

interface ProctoringCameraProps {
  onVerificationComplete?: (success: boolean) => void;
  showControls?: boolean;
  showStatus?: boolean;
  showWarnings?: boolean;
  trackViolations?: boolean;
  assessmentId?: string;
  submissionId?: string;
  size?: 'default' | 'small' | 'large';
  onWarning?: (type: string, message: string) => void;
  assessmentStartTime?: Date;
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
  showWarnings = true,
  trackViolations = false,
  assessmentId,
  submissionId,
  size = 'default',
  onWarning,
  assessmentStartTime
}) => {
  const { user } = useAuth();
  const [violationCount, setViolationCount] = useState<Record<ViolationType, number>>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0
  });
  const [violationLog, setViolationLog] = useState<string[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [cameraLoading, setCameraLoading] = useState(true);
  const autoInitRef = useRef(false);
  
  // Track which violations have already been flagged
  const flaggedViolationsRef = useRef<Set<ViolationType>>(new Set());
  
  // Track the last time each violation type was flagged (for 60-second cooldown)
  const lastViolationTimeRef = useRef<Record<ViolationType, number>>({
    noFaceDetected: 0,
    multipleFacesDetected: 0,
    faceNotCentered: 0,
    faceCovered: 0,
    rapidMovement: 0
  });
  
  const {
    videoRef,
    canvasRef,
    status,
    violations,
    activeWarning,
    dismissWarning,
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
    // Improved parameters for more accurate face detection
    detectionOptions: {
      faceDetectionThreshold: 0.5,
      faceCenteredTolerance: 0.3,
      rapidMovementThreshold: 0.3,
    }
  });

  // Helper function to get assessment time
  const getAssessmentTime = () => {
    if (!assessmentStartTime) return new Date().toLocaleTimeString();
    
    const now = new Date();
    const startTime = new Date(assessmentStartTime);
    const elapsedMs = now.getTime() - startTime.getTime();
    
    // Convert to minutes:seconds format
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

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
            const assessmentTime = getAssessmentTime();
            const violationMessage = `[${assessmentTime}] ${getViolationMessage(violationType)}`;
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
      
      // Check for total violations exceeding threshold - but don't send summary, just mark as terminated
      const totalViolations = Object.values(newViolationCount).reduce((sum, count) => sum + count, 0);
      if (totalViolations >= 3 && trackViolations && user && submissionId) {
        // Just mark as terminated without sending a summary
        markSubmissionAsTerminated();
      }
    }
  }, [violations, trackViolations, user, submissionId, assessmentStartTime]);

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
      default:
        return 'Unknown violation';
    }
  };

  const updateViolationInDatabase = async (violationText: string) => {
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
          face_violations: currentViolations
        })
        .eq('id', submissionId);
      
      if (updateError) {
        console.error("Error updating face violations:", updateError);
      }
    } catch (err) {
      console.error("Error updating face violations:", err);
    }
  };

  const markSubmissionAsTerminated = async () => {
    if (!submissionId || !user) return;
    
    try {
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ 
          is_terminated: true
        })
        .eq('id', submissionId);
      
      if (updateError) {
        console.error("Error marking submission as terminated:", updateError);
      }
    } catch (err) {
      console.error("Error marking submission as terminated:", err);
    }
  };

  const handleVerificationComplete = () => {
    // Only allow completion if face is detected
    if (status === 'faceDetected' && onVerificationComplete) {
      onVerificationComplete(true);
    } else if (status !== 'faceDetected' && onVerificationComplete) {
      // Silently fail for verification if face not detected
      return;
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

  // Forward warnings to parent component
  useEffect(() => {
    if (activeWarning && onWarning && trackViolations) {
      onWarning(activeWarning.type, activeWarning.message);
    }
  }, [activeWarning, onWarning, trackViolations]);

  return (
    <div className="proctoring-camera-container">
      {/* Violation Warning Display - Only show if showWarnings is true */}
      {showWarnings && activeWarning && (
        <div className="mb-4 relative">
          <div className={cn(
            "p-4 rounded-lg border-2 animate-pulse",
            "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
          )}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                    Proctoring Alert
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {activeWarning.message}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissWarning}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 p-1 h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                Assessment Time: {getAssessmentTime()}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={`relative w-full ${containerSizeClass} mx-auto`}>
        {/* Enhanced video feed container with modern aesthetics */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-800 to-black mb-4 border-2 border-gray-600/30 shadow-2xl backdrop-blur-sm">
          {/* Subtle animated border glow effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-green-500/20 opacity-50 animate-pulse"></div>
          
          <video
            ref={videoRef}
            className={cn(
              "w-full h-full object-cover relative z-10 rounded-xl",
              isCameraReady ? "animate-fade-in" : "opacity-0"
            )}
            autoPlay
            playsInline
            muted
          />
          <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 rounded-xl" 
          />
          
          {/* Enhanced loading overlay */}
          {cameraLoading && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-800/95 backdrop-blur-md flex flex-col items-center justify-center z-30 rounded-xl">
              <div className="text-center">
                <div className="relative mb-4">
                  {/* Outer spinning ring */}
                  <div className="h-16 w-16 rounded-full border-4 border-gray-600/30 border-t-blue-500 animate-spin mx-auto"></div>
                  {/* Inner pulsing circle */}
                  <div className="absolute top-2 left-2 right-2 bottom-2 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 animate-pulse"></div>
                  {/* Camera icon in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="h-6 w-6 text-blue-400 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-white">Initializing Camera</p>
                  <p className="text-sm text-gray-300">Please allow camera access if prompted</p>
                  <div className="flex justify-center space-x-1 mt-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced status indicator with glassmorphism */}
          {showStatus && isCameraReady && isModelLoaded && (
            <div className={cn(
              "absolute bottom-0 left-0 right-0 p-3",
              "bg-gradient-to-t from-black/80 via-black/60 to-transparent",
              "transition-all duration-500 ease-in-out",
              status === 'faceDetected' ? "opacity-70" : "opacity-95"
            )}>
              <div className={cn(
                "flex items-center px-3 py-2 rounded-lg backdrop-blur-md border",
                "transition-all duration-300 ease-in-out transform",
                "shadow-lg",
                status === 'faceDetected' 
                  ? "bg-green-500/10 border-green-400/30 scale-95" 
                  : status === 'error' 
                    ? "bg-red-500/10 border-red-400/30" 
                    : "bg-amber-500/10 border-amber-400/30"
              )}>
                {/* Status indicator dot with enhanced animation */}
                <div className={cn(
                  "w-3 h-3 rounded-full mr-3 relative",
                  status === 'faceDetected' ? "bg-green-400" : 
                  status === 'error' ? "bg-red-400" : "bg-amber-400"
                )}>
                  <div className={cn(
                    "absolute inset-0 rounded-full animate-ping",
                    status === 'faceDetected' ? "bg-green-400" : 
                    status === 'error' ? "bg-red-400" : "bg-amber-400"
                  )}></div>
                </div>
                
                <p className={cn(
                  "text-sm font-medium truncate flex-1",
                  status === 'faceDetected' ? "text-green-200" : 
                  status === 'error' ? "text-red-200" : "text-amber-200"
                )}>
                  {statusMessages[status]?.message || "Monitoring..."}
                </p>
              </div>
            </div>
          )}

          {/* Corner accent elements for modern look */}
          <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-blue-400/50 rounded-tl-lg"></div>
          <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-blue-400/50 rounded-tr-lg"></div>
          <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-blue-400/50 rounded-bl-lg"></div>
          <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-blue-400/50 rounded-br-lg"></div>
        </div>

        {/* Enhanced controls with better styling */}
        {showControls && (
          <div className="flex justify-between items-center mt-4 gap-2">
            <Button
              variant="outline"
              onClick={handleRestartCamera}
              disabled={isInitializing}
              type="button"
              className={cn(
                "group relative overflow-hidden",
                "hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100",
                "dark:hover:from-gray-800 dark:hover:to-gray-700",
                "transition-all duration-300 ease-in-out",
                "border-gray-300/50 dark:border-gray-600/50",
                "hover:shadow-lg hover:shadow-gray-500/10",
                "hover:scale-105 transform",
                isInitializing && "opacity-50 cursor-not-allowed",
                size === 'small' ? "text-xs px-2 py-1 h-7" : "h-9"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <RefreshCw className={cn(
                "mr-2 relative z-10",
                size === 'small' ? "h-3 w-3" : "h-4 w-4",
                isInitializing && "animate-spin"
              )} />
              <span className="relative z-10">Restart</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={switchCamera}
              disabled={isInitializing}
              type="button"
              className={cn(
                "group relative overflow-hidden",
                "hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100",
                "dark:hover:from-gray-800 dark:hover:to-gray-700",
                "transition-all duration-300 ease-in-out",
                "border-gray-300/50 dark:border-gray-600/50",
                "hover:shadow-lg hover:shadow-gray-500/10",
                "hover:scale-105 transform",
                isInitializing && "opacity-50 cursor-not-allowed",
                size === 'small' ? "text-xs px-2 py-1 h-7" : "h-9"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Camera className={cn(
                "mr-2 relative z-10",
                size === 'small' ? "h-3 w-3" : "h-4 w-4"
              )} />
              <span className="relative z-10">Switch</span>
            </Button>
            
            <Button
              onClick={handleVerificationComplete}
              disabled={status !== 'faceDetected' || isInitializing}
              className={cn(
                "group relative overflow-hidden",
                "transition-all duration-300 ease-in-out",
                "hover:scale-105 transform",
                status === 'faceDetected' 
                  ? "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-green-500/25" 
                  : "bg-gray-400 text-white cursor-not-allowed",
                size === 'small' ? "text-xs px-2 py-1 h-7" : "h-9"
              )}
              type="button"
            >
              {status === 'faceDetected' && (
                <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 animate-pulse"></div>
              )}
              <CheckCircle2 className={cn(
                "mr-2 relative z-10",
                size === 'small' ? "h-3 w-3" : "h-4 w-4",
                status === 'faceDetected' && "animate-pulse"
              )} />
              <span className="relative z-10">Verify</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProctoringCamera;
