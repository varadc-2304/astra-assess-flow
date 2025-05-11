
import React, { useEffect, useState, useRef } from 'react';
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
    message: 'Face appears to be partially covered. Please improve lighting or reposition.', // Updated message
    icon: <EyeOff className="mr-2 h-5 w-5" />,
    color: 'text-amber-500' // Changed from red to amber to be less alarming
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
  submissionId
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
    identityMismatch: 0
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
    isCameraReady,
    isModelLoaded,
    isInitializing,
    switchCamera,
    reinitialize,
  } = useProctoring({
    showDebugInfo: false,
    drawLandmarks: false,
    drawExpressions: false,
    detectExpressions: true,
    trackViolations: trackViolations,
    // Added parameters to reduce sensitivity of face covering detection
    detectionOptions: {
      faceDetectionThreshold: 0.65, // Lower threshold for face detection (default 0.8)
      faceCenteredTolerance: 0.25, // More tolerance for face not being centered (default 0.2)
      rapidMovementThreshold: 0.25, // Higher threshold for rapid movement detection (default 0.2)
    }
  });

  // Auto-initialize the camera when component mounts
  useEffect(() => {
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      if (!autoInitRef.current) {
        console.log("Auto-initializing camera...");
        reinitialize();
        autoInitRef.current = true;
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [reinitialize]);
  
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
      
      // Process new violations
      Object.entries(violations).forEach(([type, count]) => {
        const violationType = type as ViolationType;
        if (count > newViolationCount[violationType]) {
          // New violation occurred
          newViolationsDetected = true;
          const timestamp = new Date().toLocaleTimeString();
          const violationMessage = `[${timestamp}] ${getViolationMessage(violationType)}`;
          setViolationLog(prev => [...prev, violationMessage]);
          
          if (trackViolations && user && submissionId) {
            // Only log if we're past the cooldown period (5 seconds)
            const now = Date.now();
            if (now - lastUpdateTime > 5000) {
              updateViolationInDatabase(violationMessage);
              setLastUpdateTime(now);
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
      
      // If this is the final violation that terminates the session
      if (isFinal) {
        toast({
          title: "Assessment Terminated",
          description: "Multiple violations detected. Your session has been flagged.",
          variant: "destructive"
        });
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

  return (
    <div className="proctoring-camera-container">
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
