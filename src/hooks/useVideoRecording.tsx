
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
      console.log('Starting video recording...');
      
      let stream: MediaStream;
      
      if (videoElement && videoElement.srcObject) {
        // Use existing stream from video element
        stream = videoElement.srcObject as MediaStream;
        streamRef.current = stream;
        console.log('Using existing video stream');
      } else {
        // Create new stream
        console.log('Creating new video stream...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
          },
          audio: false // Don't record audio for privacy
        });
        streamRef.current = stream;
        console.log('New video stream created');
      }

      // Check if the browser supports the preferred mime type
      let mimeType = defaultOptions.mimeType!;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn(`${mimeType} not supported, trying fallbacks...`);
        // Fallback to more widely supported format
        mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
          console.warn('Using video/mp4 as final fallback');
        } else {
          console.log('Using video/webm fallback');
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
          console.log(`Recording chunk received, size: ${event.data.size} bytes. Total chunks: ${recordedChunksRef.current.length}`);
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
      
      console.log('Video recording started with mime type:', mimeType);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingError(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [defaultOptions]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        console.warn('No active recording to stop');
        resolve(null);
        return;
      }

      console.log('Stopping video recording...');

      mediaRecorderRef.current.onstop = () => {
        console.log(`Creating blob from ${recordedChunksRef.current.length} chunks`);
        const recordedBlob = new Blob(recordedChunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'video/webm'
        });
        
        setIsRecording(false);
        console.log('Video recording stopped, blob size:', recordedBlob.size, 'bytes');
        console.log('Blob type:', recordedBlob.type);
        
        if (recordedBlob.size === 0) {
          console.error('WARNING: Recorded blob is empty!');
        }
        
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
    console.log('=== UPLOAD RECORDING START ===');
    console.log('User:', user?.id);
    console.log('Assessment ID:', assessmentId);
    console.log('Submission ID:', submissionId);
    console.log('Blob size:', blob.size, 'bytes');
    console.log('Blob type:', blob.type);

    if (!user) {
      const error = 'User not authenticated';
      console.error('Upload failed:', error);
      setRecordingError(error);
      return null;
    }

    if (blob.size === 0) {
      const error = 'Recording is empty';
      console.error('Upload failed:', error);
      setRecordingError(error);
      return null;
    }

    try {
      setUploadProgress(0);
      
      const recordingDuration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      const fileSizeMB = blob.size / (1024 * 1024);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create a simple, clean file path
      const fileName = `${user.id}/${assessmentId}/${submissionId}-${timestamp}.webm`;

      console.log(`Uploading file: ${fileName}`);
      console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);
      console.log(`Duration: ${recordingDuration}s`);

      setUploadProgress(10);

      // First, let's check if the bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      console.log('Available buckets:', buckets?.map(b => b.name));
      
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
      }

      // Upload to Supabase Storage with explicit content type
      console.log('Starting upload to Supabase Storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proctoring-recordings')
        .upload(fileName, blob, {
          contentType: blob.type || 'video/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error details:', {
          message: uploadError.message,
          error: uploadError,
          fileName,
          blobSize: blob.size,
          blobType: blob.type
        });
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('Upload successful! Data:', uploadData);
      setUploadProgress(50);

      // Verify the upload by listing files in the bucket
      const { data: files, error: listError } = await supabase.storage
        .from('proctoring-recordings')
        .list(user.id, { limit: 10 });
      
      if (listError) {
        console.error('Error listing files after upload:', listError);
      } else {
        console.log('Files in bucket after upload:', files?.map(f => f.name));
      }

      // Create proctoring session record
      console.log('Creating proctoring session record...');
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
      } else {
        console.log('Proctoring session created successfully:', sessionData);
      }

      setUploadProgress(75);

      // Update submission with proctoring session reference
      if (sessionData) {
        console.log('Updating submission with proctoring session ID...');
        const { error: updateError } = await supabase
          .from('submissions')
          .update({ proctoring_session_id: sessionData.id })
          .eq('id', submissionId);

        if (updateError) {
          console.error('Error updating submission with proctoring session:', updateError);
        } else {
          console.log('Submission updated with proctoring session ID');
        }
      }

      setUploadProgress(100);
      
      console.log('=== UPLOAD RECORDING COMPLETE ===');
      console.log('Final file path:', uploadData.path);
      return uploadData.path;
      
    } catch (error) {
      console.error('=== UPLOAD RECORDING FAILED ===');
      console.error('Error details:', error);
      const errorMessage = `Failed to upload recording: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      setRecordingError(errorMessage);
      return null;
    }
  }, [user]);

  const cleanup = useCallback(() => {
    console.log('Cleaning up video recording resources...');
    
    if (mediaRecorderRef.current && isRecording) {
      console.log('Stopping active recording...');
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current && streamRef.current !== null) {
      console.log('Stopping media stream tracks...');
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      streamRef.current = null;
    }
    
    recordedChunksRef.current = [];
    setIsRecording(false);
    setRecordingError(null);
    setUploadProgress(0);
    console.log('Video recording cleanup complete');
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
