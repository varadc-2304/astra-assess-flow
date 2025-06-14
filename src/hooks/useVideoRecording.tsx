
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
      console.error('useVideoRecording: No video stream available or user not authenticated');
      toast({
        title: "Recording Error",
        description: "Camera not ready or user not authenticated",
        variant: "destructive",
      });
      return false;
    }

    try {
      const stream = videoElement.srcObject as MediaStream;
      streamRef.current = stream;
      
      console.log('useVideoRecording: Setting up MediaRecorder with stream:', stream);
      
      // Configure MediaRecorder with optimized settings
      let options: MediaRecorderOptions = {
        videoBitsPerSecond: 1000000, // 1 Mbps for reasonable quality/size balance
      };

      // Try different MIME types in order of preference
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4'
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          options.mimeType = mimeType;
          break;
        }
      }

      console.log('useVideoRecording: Using MIME type:', selectedMimeType);

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('useVideoRecording: Recording chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstart = () => {
        console.log('useVideoRecording: MediaRecorder started');
        setIsRecording(true);
        toast({
          title: "Recording Active",
          description: "Assessment recording is now active",
        });
      };

      mediaRecorder.onerror = (event) => {
        console.error('useVideoRecording: MediaRecorder error:', event);
        toast({
          title: "Recording Error",
          description: "An error occurred during recording",
          variant: "destructive",
        });
      };

      mediaRecorder.start(1000); // Collect data every second
      
      console.log('useVideoRecording: Recording started for assessment:', config.assessmentId, 'user:', user.id);
      return true;
    } catch (error) {
      console.error('useVideoRecording: Error starting recording:', error);
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
      console.log('useVideoRecording: Cannot stop recording - no recorder, not recording, or no user');
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      mediaRecorder.onstop = async () => {
        try {
          setIsRecording(false);
          setIsUploading(true);

          console.log('useVideoRecording: Recording stopped, processing chunks:', recordedChunksRef.current.length);

          if (recordedChunksRef.current.length === 0) {
            console.warn('useVideoRecording: No recorded chunks available');
            toast({
              title: "Recording Warning",
              description: "No recording data was captured",
              variant: "destructive",
            });
            setIsUploading(false);
            resolve(null);
            return;
          }

          // Create blob from recorded chunks
          const recordedBlob = new Blob(recordedChunksRef.current, {
            type: 'video/webm'
          });

          const sizeInMB = Math.round(recordedBlob.size / 1024 / 1024);
          console.log('useVideoRecording: Recording blob created:', sizeInMB, 'MB');

          // Generate filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `${user.id}/${config.assessmentId}/${config.submissionId}/recording-${timestamp}.webm`;

          console.log('useVideoRecording: Uploading recording to:', fileName);

          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('proctoring_recordings')
            .upload(fileName, recordedBlob, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'video/webm'
            });

          if (uploadError) {
            console.error('useVideoRecording: Upload error:', uploadError);
            toast({
              title: "Upload Failed",
              description: `Failed to upload recording: ${uploadError.message}`,
              variant: "destructive",
            });
            setIsUploading(false);
            resolve(null);
            return;
          }

          console.log('useVideoRecording: Upload successful:', uploadData);

          // Get the file path for the recording URL using the hardcoded Supabase URL
          const recordingUrl = `https://tafvjwurzgpugcfidbfv.supabase.co/storage/v1/object/public/proctoring_recordings/${fileName}`;

          // Update submission with recording URL
          const { error: updateError } = await supabase
            .from('submissions')
            .update({ recording_url: recordingUrl })
            .eq('id', config.submissionId);

          if (updateError) {
            console.error('useVideoRecording: Error updating submission:', updateError);
            toast({
              title: "Database Update Failed",
              description: "Recording uploaded but failed to update submission record.",
              variant: "destructive",
            });
          } else {
            console.log('useVideoRecording: Recording successfully saved:', recordingUrl);
            toast({
              title: "Recording Complete",
              description: "Assessment recording has been saved successfully.",
            });
          }

          setIsUploading(false);
          resolve(recordingUrl);

        } catch (error) {
          console.error('useVideoRecording: Error processing recording:', error);
          setIsUploading(false);
          toast({
            title: "Processing Error",
            description: "Failed to process recording. Please contact support.",
            variant: "destructive",
          });
          resolve(null);
        }
      };

      console.log('useVideoRecording: Stopping media recorder...');
      mediaRecorder.stop();
    });
  }, [isRecording, user, toast]);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('useVideoRecording: Cleaning up recording...');
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    streamRef.current = null;
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
