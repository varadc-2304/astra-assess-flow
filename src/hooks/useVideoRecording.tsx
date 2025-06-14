
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { uploadVideoBlob } from '@/utils/storageUtils';
import { createRecordingFileName, validateRecordingBlob, getSupportedMimeType } from '@/utils/recordingUtils';

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
    videoBitsPerSecond: 1000000,
    mimeType: getSupportedMimeType(),
    ...options
  };

  const startRecording = useCallback(async (videoElement?: HTMLVideoElement) => {
    try {
      setRecordingError(null);
      console.log('=== STARTING RECORDING ===');
      console.log('User ID:', user?.id);
      
      let stream: MediaStream;
      
      if (videoElement && videoElement.srcObject) {
        stream = videoElement.srcObject as MediaStream;
        console.log('Using existing stream');
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
          },
          audio: false
        });
        console.log('Created new stream');
      }

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: defaultOptions.mimeType,
        videoBitsPerSecond: defaultOptions.videoBitsPerSecond
      });

      recordedChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log(`Chunk added, size: ${event.data.size} bytes, total chunks: ${recordedChunksRef.current.length}`);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setRecordingError('Recording error occurred');
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      
      console.log('Recording started successfully');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingError(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [defaultOptions, user]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      console.log('=== STOPPING RECORDING ===');
      
      if (!mediaRecorderRef.current || !isRecording) {
        console.warn('No active recording');
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        console.log('Creating blob from chunks:', recordedChunksRef.current.length);
        
        const totalSize = recordedChunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
        console.log('Total recorded data:', totalSize, 'bytes');
        
        if (totalSize === 0) {
          console.error('No data recorded');
          setRecordingError('No video data was recorded');
          resolve(null);
          return;
        }

        const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
        const recordedBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        
        console.log('Blob created:', {
          size: recordedBlob.size,
          type: recordedBlob.type
        });
        
        setIsRecording(false);
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
    console.log('=== UPLOAD RECORDING ===');
    
    if (!user) {
      setRecordingError('User not authenticated');
      return null;
    }

    if (!validateRecordingBlob(blob)) {
      setRecordingError('Invalid recording data');
      return null;
    }

    try {
      setUploadProgress(0);
      
      const filePath = createRecordingFileName(user.id, assessmentId);
      console.log('Uploading to path:', filePath);
      
      const uploadedPath = await uploadVideoBlob(blob, filePath, setUploadProgress);
      
      if (!uploadedPath) {
        throw new Error('Upload failed - no path returned');
      }
      
      // Create proctoring session record
      const recordingDuration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      const fileSizeMB = blob.size / (1024 * 1024);
      
      const { data: sessionData, error: sessionError } = await supabase
        .from('proctoring_sessions')
        .insert({
          user_id: user.id,
          assessment_id: assessmentId,
          submission_id: submissionId,
          recording_path: uploadedPath,
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
      } else {
        console.log('Proctoring session created:', sessionData);
        
        // Update submission
        await supabase
          .from('submissions')
          .update({ proctoring_session_id: sessionData.id })
          .eq('id', submissionId);
      }
      
      console.log('Upload completed successfully:', uploadedPath);
      return uploadedPath;
      
    } catch (error) {
      console.error('Upload failed:', error);
      setRecordingError(`Failed to upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }, [user]);

  const cleanup = useCallback(() => {
    console.log('=== CLEANUP ===');
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
