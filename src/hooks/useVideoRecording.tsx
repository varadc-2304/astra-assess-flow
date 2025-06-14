
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RecordingOptions {
  videoBitsPerSecond?: number;
  mimeType?: string;
}

export function useVideoRecording(options: RecordingOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user } = useAuth();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const defaultOptions: RecordingOptions = {
    videoBitsPerSecond: 1000000, // 1 Mbps for good quality but manageable file size
    mimeType: 'video/webm;codecs=vp9',
    ...options
  };

  const startRecording = useCallback(async (videoElement?: HTMLVideoElement) => {
    try {
      setRecordingError(null);
      
      let stream: MediaStream;
      
      if (videoElement && videoElement.srcObject) {
        // Use existing stream from video element
        stream = videoElement.srcObject as MediaStream;
        streamRef.current = stream;
      } else {
        // Create new stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
          },
          audio: false // Don't record audio for privacy
        });
        streamRef.current = stream;
      }

      // Check if the browser supports the preferred mime type
      let mimeType = defaultOptions.mimeType!;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to more widely supported format
        mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: defaultOptions.videoBitsPerSecond
      });

      recordedChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setRecordingError('Recording error occurred');
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(10000); // Record in 10-second chunks
      setIsRecording(true);
      
      console.log('Video recording started');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingError('Failed to start recording');
    }
  }, [defaultOptions]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const recordedBlob = new Blob(recordedChunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'video/webm'
        });
        
        setIsRecording(false);
        console.log('Video recording stopped, blob size:', recordedBlob.size);
        resolve(recordedBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [isRecording]);

  const uploadRecording = useCallback(async (
    blob: Blob, 
    assessmentId: string, 
    submissionId: string
  ): Promise<string | null> => {
    if (!user) {
      setRecordingError('User not authenticated');
      return null;
    }

    try {
      setUploadProgress(0);
      
      const recordingDuration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      const fileSizeMB = blob.size / (1024 * 1024);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${user.id}/${assessmentId}/${submissionId}/recording-${timestamp}.webm`;

      console.log(`Uploading recording: ${fileName}, Size: ${fileSizeMB.toFixed(2)}MB, Duration: ${recordingDuration}s`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proctoring-recordings')
        .upload(fileName, blob, {
          contentType: blob.type,
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      setUploadProgress(50);

      // Create proctoring session record
      const { data: sessionData, error: sessionError } = await supabase
        .from('proctoring_sessions')
        .insert({
          user_id: user.id,
          assessment_id: assessmentId,
          submission_id: submissionId,
          recording_path: fileName,
          recording_status: 'completed',
          recording_size_mb: fileSizeMB,
          recording_duration_seconds: recordingDuration,
          started_at: new Date(recordingStartTimeRef.current).toISOString(),
          ended_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating proctoring session:', sessionError);
        // Don't throw here, upload was successful
      }

      setUploadProgress(75);

      // Update submission with proctoring session reference
      if (sessionData) {
        const { error: updateError } = await supabase
          .from('submissions')
          .update({ proctoring_session_id: sessionData.id })
          .eq('id', submissionId);

        if (updateError) {
          console.error('Error updating submission with proctoring session:', updateError);
        }
      }

      setUploadProgress(100);
      
      console.log('Recording uploaded successfully:', uploadData.path);
      return uploadData.path;
      
    } catch (error) {
      console.error('Error uploading recording:', error);
      setRecordingError('Failed to upload recording');
      return null;
    }
  }, [user]);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current && streamRef.current !== null) {
      // Only stop the stream if we created it (not if it came from an existing video element)
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }
    
    recordedChunksRef.current = [];
    setIsRecording(false);
    setRecordingError(null);
    setUploadProgress(0);
  }, [isRecording]);

  return {
    isRecording,
    recordingError,
    uploadProgress,
    startRecording,
    stopRecording,
    uploadRecording,
    cleanup
  };
}
