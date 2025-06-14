
import React, { useEffect } from 'react';
import { useVideoRecording } from '@/hooks/useVideoRecording';
import { useAuth } from '@/contexts/AuthContext';
import { Video, VideoOff, Upload } from 'lucide-react';

interface AssessmentRecorderProps {
  submissionId?: string;
  isAssessmentActive: boolean;
  onRecordingStatusChange?: (isRecording: boolean) => void;
}

export const AssessmentRecorder: React.FC<AssessmentRecorderProps> = ({
  submissionId,
  isAssessmentActive,
  onRecordingStatusChange
}) => {
  const { user } = useAuth();
  const { isRecording, isUploading, startRecording, stopRecording, cleanup } = useVideoRecording({
    submissionId,
    userId: user?.id
  });

  // Start recording when assessment becomes active
  useEffect(() => {
    if (isAssessmentActive && submissionId && user?.id && !isRecording) {
      console.log('Starting assessment recording...');
      startRecording();
    }
  }, [isAssessmentActive, submissionId, user?.id, isRecording, startRecording]);

  // Stop recording when assessment becomes inactive
  useEffect(() => {
    if (!isAssessmentActive && isRecording) {
      console.log('Stopping assessment recording...');
      stopRecording();
    }
  }, [isAssessmentActive, isRecording, stopRecording]);

  // Notify parent of recording status changes
  useEffect(() => {
    onRecordingStatusChange?.(isRecording);
  }, [isRecording, onRecordingStatusChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  if (!submissionId || !user?.id) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 flex items-center gap-2 text-white">
        {isRecording ? (
          <>
            <Video className="h-4 w-4 text-red-500 animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          </>
        ) : isUploading ? (
          <>
            <Upload className="h-4 w-4 text-blue-500 animate-spin" />
            <span className="text-sm font-medium">Uploading...</span>
          </>
        ) : (
          <>
            <VideoOff className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium">Not Recording</span>
          </>
        )}
      </div>
    </div>
  );
};

export default AssessmentRecorder;
