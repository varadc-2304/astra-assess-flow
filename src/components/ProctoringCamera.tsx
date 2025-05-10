
import React, { useEffect } from 'react';
import { useProctoring, MAX_FACE_VIOLATIONS } from '@/hooks/useProctoring';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface ProctoringCameraProps {
  active: boolean;
}

export const ProctoringCamera: React.FC<ProctoringCameraProps> = ({ active }) => {
  const {
    videoRef,
    canvasRef,
    isModelLoaded,
    isCameraReady,
    detectionActive,
    faceDetected,
    multipleFaces,
    faceOutOfFrame,
    faceViolations,
    showFaceWarning,
    initCamera,
    startDetection,
    stopDetection,
    clearFaceWarning
  } = useProctoring();

  useEffect(() => {
    if (active && isModelLoaded && !isCameraReady) {
      initCamera();
    }
  }, [active, isModelLoaded, isCameraReady, initCamera]);

  useEffect(() => {
    if (active && isModelLoaded && isCameraReady && !detectionActive) {
      startDetection();
    } else if (!active && detectionActive) {
      stopDetection();
    }
  }, [active, isModelLoaded, isCameraReady, detectionActive, startDetection, stopDetection]);

  return (
    <>
      <div className="proctoring-container">
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className={`proctoring-canvas ${active ? 'opacity-100' : 'opacity-0'}`}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '160px',
            height: '120px',
            border: '2px solid',
            borderColor: faceDetected 
              ? multipleFaces 
                ? 'rgb(239 68 68)' // red
                : faceOutOfFrame 
                  ? 'rgb(234 179 8)' // yellow
                  : 'rgb(34 197 94)' // green
              : 'rgb(239 68 68)', // red
            borderRadius: '8px',
            zIndex: 999,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transform: 'scaleX(-1)', // Mirror image
          }}
        />
      </div>

      <AlertDialog open={showFaceWarning}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
              Face Detection Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">
                {!faceDetected 
                  ? "No face detected in camera."
                  : multipleFaces
                  ? "Multiple faces detected in camera."
                  : faceOutOfFrame
                  ? "Your face is not properly positioned in the frame."
                  : "Face detection issue."
                }
              </p>
              <p className="font-semibold">
                This is violation {faceViolations}/{MAX_FACE_VIOLATIONS}.
              </p>
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                Please ensure your face is clearly visible and centered in the camera frame at all times.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={clearFaceWarning}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Continue Assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProctoringCamera;
