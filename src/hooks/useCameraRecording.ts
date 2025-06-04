
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RecordingOptions {
  maxDuration?: number; // in minutes
  videoBitsPerSecond?: number;
}

interface ViolationTimestamp {
  timestamp: number;
  type: string;
  description: string;
}

export const useCameraRecording = (options: RecordingOptions = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [violationTimestamps, setViolationTimestamps] = useState<ViolationTimestamp[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  const {
    maxDuration = 180, // 3 hours default
    videoBitsPerSecond = 250000 // 250kbps for reasonable file size
  } = options;

  const startRecording = useCallback(async (stream: MediaStream): Promise<boolean> => {
    try {
      if (!stream) {
        throw new Error('No video stream available');
      }

      // Check if MediaRecorder is supported
      if (!MediaRecorder.isTypeSupported('video/webm')) {
        throw new Error('Video recording not supported in this browser');
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
        videoBitsPerSecond
      });

      chunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks collected:', chunksRef.current.length);
      };

      mediaRecorder.onerror = (event) => {
        console.error('Recording error:', event);
        setIsRecording(false);
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);
      setViolationTimestamps([]);

      // Start duration timer
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
        
        // Auto-stop if max duration reached
        if (elapsed >= maxDuration * 60) {
          stopRecording();
        }
      }, 1000);

      console.log('Camera recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start camera recording. Please check your camera permissions.",
        variant: "destructive",
      });
      return false;
    }
  }, [maxDuration, videoBitsPerSecond, toast]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      console.log('Camera recording stopped');
    });
  }, [isRecording]);

  const addViolationTimestamp = useCallback((type: string, description: string) => {
    if (!isRecording) return;
    
    const timestamp = Date.now() - recordingStartTimeRef.current;
    const violation: ViolationTimestamp = {
      timestamp,
      type,
      description
    };
    
    setViolationTimestamps(prev => [...prev, violation]);
    console.log('Violation recorded:', violation);
  }, [isRecording]);

  const uploadRecording = useCallback(async (
    blob: Blob, 
    userId: string, 
    assessmentId: string, 
    submissionId: string
  ): Promise<string | null> => {
    try {
      const fileName = `${userId}/${assessmentId}/${submissionId}_${Date.now()}.webm`;
      
      console.log('Uploading recording:', fileName, 'Size:', blob.size);
      
      const { data, error } = await supabase.storage
        .from('proctoring-recordings')
        .upload(fileName, blob, {
          contentType: 'video/webm',
          cacheControl: '3600'
        });

      if (error) {
        throw error;
      }

      console.log('Recording uploaded successfully:', data.path);
      return data.path;
    } catch (error) {
      console.error('Failed to upload recording:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload recording. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
    setViolationTimestamps([]);
    chunksRef.current = [];
  }, [isRecording]);

  return {
    isRecording,
    recordingDuration,
    violationTimestamps,
    startRecording,
    stopRecording,
    addViolationTimestamp,
    uploadRecording,
    cleanup
  };
};
