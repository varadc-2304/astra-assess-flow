
import React, { useEffect, useState } from 'react';
import { ProctoringCamera } from '@/components/ProctoringCamera';
import { RecordingConfig } from '@/hooks/useVideoRecording';
import { useToast } from '@/hooks/use-toast';

interface AssessmentRecordingProps {
  assessmentId: string;
  submissionId: string;
  isAssessmentStarted: boolean;
  onRecordingStatusChange?: (isRecording: boolean) => void;
}

export const AssessmentRecording: React.FC<AssessmentRecordingProps> = ({
  assessmentId,
  submissionId,
  isAssessmentStarted,
  onRecordingStatusChange
}) => {
  const [recordingConfig, setRecordingConfig] = useState<RecordingConfig | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    if (isAssessmentStarted && assessmentId && submissionId) {
      setRecordingConfig({
        assessmentId,
        submissionId
      });
    } else {
      setRecordingConfig(undefined);
    }
  }, [isAssessmentStarted, assessmentId, submissionId]);

  const handleRecordingStart = (success: boolean) => {
    if (success) {
      console.log('Assessment recording started successfully');
      onRecordingStatusChange?.(true);
    } else {
      console.warn('Failed to start assessment recording');
      toast({
        title: "Recording Warning",
        description: "Assessment recording could not be started. The assessment will continue.",
        variant: "destructive",
      });
    }
  };

  const handleRecordingStop = (recordingUrl: string | null) => {
    if (recordingUrl) {
      console.log('Assessment recording completed:', recordingUrl);
      toast({
        title: "Recording Complete",
        description: "Assessment recording has been saved successfully.",
      });
    } else {
      console.warn('Assessment recording failed to save');
    }
    onRecordingStatusChange?.(false);
  };

  if (!isAssessmentStarted) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="w-48 h-36 rounded-lg overflow-hidden shadow-lg border-2 border-gray-300">
        <ProctoringCamera
          showControls={false}
          showStatus={false}
          showWarnings={false}
          trackViolations={true}
          assessmentId={assessmentId}
          submissionId={submissionId}
          size="small"
          enableRecording={true}
          recordingConfig={recordingConfig}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
        />
      </div>
    </div>
  );
};
