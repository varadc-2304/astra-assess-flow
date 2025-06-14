
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface RecordingConfig {
  assessmentId: string;
  submissionId: string;
}

export const useVideoRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const startRecording = useCallback(async (videoElement: HTMLVideoElement, config: RecordingConfig) => {
    if (!videoElement.srcObject || !user) {
      console.error('No video stream available or user not authenticated');
      return false;
    }

    try {
      const stream = videoElement.srcObject as MediaStream;
      streamRef.current = stream;
      
      // Configure MediaRecorder with optimized settings
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 1000000, // 1 Mbps for reasonable quality/size balance
      };

      // Fallback to vp8 if vp9 is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
      }

      // Additional fallback if webm is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('Recording chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      console.log('Recording started for assessment:', config.assessmentId, 'user:', user.id);
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Assessment will continue without recording.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast]);

  const stopRecording = useCallback(async (config: RecordingConfig): Promise<string | null> => {
    if (!mediaRecorderRef.current || !isRecording || !user) {
      console.log('Cannot stop recording - no recorder, not recording, or no user');
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      mediaRecorder.onstop = async () => {
        try {
          setIsRecording(false);
          setIsUploading(true);

          console.log('Recording stopped, processing chunks:', recordedChunksRef.current.length);

          if (recordedChunksRef.current.length === 0) {
            console.warn('No recorded chunks available');
            setIsUploading(false);
            resolve(null);
            return;
          }

          // Create blob from recorded chunks
          const recordedBlob = new Blob(recordedChunksRef.current, {
            type: 'video/webm'
          });

          console.log('Recording blob created:', Math.round(recordedBlob.size / 1024 / 1024), 'MB');

          // Generate filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `${user.id}/${config.assessmentId}/${config.submissionId}/recording-${timestamp}.webm`;

          console.log('Uploading recording to:', fileName);

          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('proctoring_recordings')
            .upload(fileName, recordedBlob, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'video/webm'
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            toast({
              title: "Upload Failed",
              description: `Failed to upload recording: ${uploadError.message}`,
              variant: "destructive",
            });
            setIsUploading(false);
            resolve(null);
            return;
          }

          console.log('Upload successful:', uploadData);

          // Get the file path for the recording URL
          const recordingUrl = `${supabase.supabaseUrl}/storage/v1/object/proctoring_recordings/${fileName}`;

          // Update submission with recording URL
          const { error: updateError } = await supabase
            .from('submissions')
            .update({ recording_url: recordingUrl })
            .eq('id', config.submissionId);

          if (updateError) {
            console.error('Error updating submission:', updateError);
            toast({
              title: "Database Update Failed",
              description: "Recording uploaded but failed to update submission record.",
              variant: "destructive",
            });
          } else {
            console.log('Recording successfully saved:', recordingUrl);
            toast({
              title: "Recording Complete",
              description: "Assessment recording has been saved successfully.",
            });
          }

          setIsUploading(false);
          resolve(recordingUrl);

        } catch (error) {
          console.error('Error processing recording:', error);
          setIsUploading(false);
          toast({
            title: "Processing Error",
            description: "Failed to process recording. Please contact support.",
            variant: "destructive",
          });
          resolve(null);
        }
      };

      console.log('Stopping media recorder...');
      mediaRecorder.stop();
    });
  }, [isRecording, user, toast]);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('Cleaning up recording...');
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setIsRecording(false);
    setIsUploading(false);
  }, [isRecording]);

  return {
    isRecording,
    isUploading,
    startRecording,
    stopRecording,
    cleanup
  };
};
