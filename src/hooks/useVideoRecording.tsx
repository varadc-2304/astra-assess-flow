
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseVideoRecordingProps {
  submissionId?: string;
  userId?: string;
}

export const useVideoRecording = ({ submissionId, userId }: UseVideoRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    if (!submissionId || !userId) {
      console.error('Cannot start recording: missing submissionId or userId');
      return false;
    }

    try {
      // Get user media with video and audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      streamRef.current = stream;
      recordedChunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        await uploadRecording();
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      console.log('Video recording started for submission:', submissionId);
      return true;
    } catch (error) {
      console.error('Error starting video recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start video recording. Please check camera permissions.",
        variant: "destructive",
      });
      return false;
    }
  }, [submissionId, userId, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      console.log('Video recording stopped for submission:', submissionId);
    }
  }, [isRecording, submissionId]);

  const uploadRecording = useCallback(async () => {
    if (recordedChunksRef.current.length === 0 || !submissionId || !userId) {
      console.error('Cannot upload: no recording data or missing IDs');
      return;
    }

    setIsUploading(true);
    
    try {
      // Create blob from recorded chunks
      const recordingBlob = new Blob(recordedChunksRef.current, {
        type: 'video/webm'
      });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${userId}/${submissionId}_${timestamp}.webm`;

      console.log('Uploading recording:', filename, 'Size:', recordingBlob.size);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('assessment-recordings')
        .upload(filename, recordingBlob, {
          contentType: 'video/webm',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('assessment-recordings')
        .getPublicUrl(filename);

      // Update submission with recording URL
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ recording_url: urlData.publicUrl })
        .eq('id', submissionId);

      if (updateError) {
        throw updateError;
      }

      console.log('Recording uploaded successfully:', urlData.publicUrl);
      
      toast({
        title: "Recording Saved",
        description: "Assessment recording has been saved successfully.",
      });

    } catch (error) {
      console.error('Error uploading recording:', error);
      toast({
        title: "Upload Error",
        description: "Failed to save recording. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      recordedChunksRef.current = [];
    }
  }, [submissionId, userId, toast]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
  }, [isRecording, stopRecording]);

  return {
    isRecording,
    isUploading,
    startRecording,
    stopRecording,
    cleanup
  };
};
