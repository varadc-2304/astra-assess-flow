
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
    console.log('AssessmentRecording: isAssessmentStarted:', isAssessmentStarted, 'assessmentId:', assessmentId, 'submissionId:', submissionId);
    
    if (isAssessmentStarted && assessmentId && submissionId) {
      const config = {
        assessmentId,
        submissionId
      };
      console.log('Setting recording config:', config);
      setRecordingConfig(config);
    } else {
      console.log('Clearing recording config');
      setRecordingConfig(undefined);
    }
  }, [isAssessmentStarted, assessmentId, submissionId]);

  const handleRecordingStart = (success: boolean) => {
    console.log('Recording start result:', success);
    if (success) {
      console.log('Assessment recording started successfully');
      onRecordingStatusChange?.(true);
      toast({
        title: "Recording Started",
        description: "Assessment recording has begun.",
      });
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
    console.log('Recording stop result:', recordingUrl);
    if (recordingUrl) {
      console.log('Assessment recording completed:', recordingUrl);
    } else {
      console.warn('Assessment recording failed to save');
      toast({
        title: "Recording Issue",
        description: "There was an issue saving the recording.",
        variant: "destructive",
      });
    }
    onRecordingStatusChange?.(false);
  };

  if (!isAssessmentStarted || !recordingConfig) {
    console.log('AssessmentRecording: Not rendering camera - assessment not started or no config');
    return null;
  }

  console.log('AssessmentRecording: Rendering camera with config:', recordingConfig);

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
