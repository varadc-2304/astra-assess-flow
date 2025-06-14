
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
    console.log('AssessmentRecording: Configuration check:', {
      isAssessmentStarted,
      assessmentId,
      submissionId,
      hasConfig: !!recordingConfig
    });
    
    if (isAssessmentStarted && assessmentId && submissionId) {
      const config = {
        assessmentId,
        submissionId
      };
      console.log('AssessmentRecording: Setting recording config:', config);
      setRecordingConfig(config);
      
      // Show immediate feedback that recording setup is starting
      toast({
        title: "Recording Setup",
        description: "Initializing assessment recording...",
      });
    } else {
      console.log('AssessmentRecording: Clearing recording config - missing requirements');
      setRecordingConfig(undefined);
    }
  }, [isAssessmentStarted, assessmentId, submissionId, toast]);

  const handleRecordingStart = (success: boolean) => {
    console.log('AssessmentRecording: Recording start result:', success);
    if (success) {
      console.log('Assessment recording started successfully');
      onRecordingStatusChange?.(true);
      toast({
        title: "Recording Started",
        description: "Your assessment is now being recorded for proctoring purposes.",
      });
    } else {
      console.warn('Failed to start assessment recording');
      onRecordingStatusChange?.(false);
      toast({
        title: "Recording Warning",
        description: "Assessment recording could not be started. The assessment will continue, but this may be flagged.",
        variant: "destructive",
      });
    }
  };

  const handleRecordingStop = (recordingUrl: string | null) => {
    console.log('AssessmentRecording: Recording stop result:', recordingUrl);
    if (recordingUrl) {
      console.log('Assessment recording completed successfully:', recordingUrl);
      toast({
        title: "Recording Complete",
        description: "Assessment recording has been saved successfully.",
      });
    } else {
      console.warn('Assessment recording failed to save');
      toast({
        title: "Recording Issue",
        description: "There was an issue saving the recording. Please contact support if this affects your assessment.",
        variant: "destructive",
      });
    }
    onRecordingStatusChange?.(false);
  };

  // Always render the camera when we have the required props, regardless of recording config
  if (!isAssessmentStarted) {
    console.log('AssessmentRecording: Not rendering - assessment not started');
    return null;
  }

  console.log('AssessmentRecording: Rendering camera with recording enabled');

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
