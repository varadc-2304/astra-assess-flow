
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAssessmentRecordingOptions {
  assessmentId: string;
  submissionId?: string;
  userId?: string;
}

export const useAssessmentRecording = ({
  assessmentId,
  submissionId,
  userId
}: UseAssessmentRecordingOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    if (!submissionId || !userId) {
      console.log('Cannot start recording: missing submissionId or userId');
      return;
    }

    try {
      console.log('Starting camera recording for assessment:', assessmentId);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('Recording started');
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
        setIsRecording(false);
        uploadRecording();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start camera recording. Please check your camera permissions.",
        variant: "destructive",
      });
    }
  }, [assessmentId, submissionId, userId, toast]);

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const uploadRecording = useCallback(async () => {
    if (chunksRef.current.length === 0 || !submissionId || !userId) {
      console.log('No recording data to upload or missing IDs');
      return null;
    }

    setIsUploading(true);
    
    try {
      console.log('Uploading recording with', chunksRef.current.length, 'chunks');
      
      const recordingBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `assessment_${assessmentId}_${submissionId}_${timestamp}.webm`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proctoring_recordings')
        .upload(fileName, recordingBlob, {
          contentType: 'video/webm',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('proctoring_recordings')
        .getPublicUrl(fileName);

      const recordingPublicUrl = urlData.publicUrl;
      console.log('Recording uploaded successfully:', recordingPublicUrl);

      // Update current submission with recording URL immediately
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ recording_url: recordingPublicUrl })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Error updating submission with recording URL:', updateError);
      } else {
        console.log('Successfully updated current submission with recording URL');
        setRecordingUrl(recordingPublicUrl);
      }

      toast({
        title: "Recording Saved",
        description: "Assessment recording has been saved successfully.",
      });

      return recordingPublicUrl;

    } catch (error) {
      console.error('Error uploading recording:', error);
      toast({
        title: "Upload Error",
        description: "Failed to save recording. Please contact support if this persists.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
      chunksRef.current = [];
    }
  }, [assessmentId, submissionId, userId, toast]);

  return {
    isRecording,
    isUploading,
    recordingUrl,
    startRecording,
    stopRecording,
    uploadRecording
  };
};
