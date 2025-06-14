
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
      console.log('=== STARTING VIDEO RECORDING ===');
      console.log('User ID:', user?.id);
      console.log('Video element provided:', !!videoElement);
      
      let stream: MediaStream;
      
      if (videoElement && videoElement.srcObject) {
        // Use existing stream from video element
        stream = videoElement.srcObject as MediaStream;
        streamRef.current = stream;
        console.log('Using existing video stream from element');
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
        console.log('New video stream created successfully');
      }

      // Verify stream is active
      const videoTracks = stream.getVideoTracks();
      console.log('Video tracks:', videoTracks.length);
      videoTracks.forEach((track, index) => {
        console.log(`Track ${index}:`, {
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label
        });
      });

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

      console.log('Final mime type selected:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: defaultOptions.videoBitsPerSecond
      });

      recordedChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        console.log('=== DATA AVAILABLE EVENT ===');
        console.log('Event data size:', event.data.size, 'bytes');
        console.log('Event data type:', event.data.type);
        
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log(`Recording chunk added. Total chunks: ${recordedChunksRef.current.length}`);
          console.log('Total size so far:', recordedChunksRef.current.reduce((total, chunk) => total + chunk.size, 0), 'bytes');
        } else {
          console.warn('Received empty data chunk!');
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('=== MEDIA RECORDER ERROR ===');
        console.error('Error event:', event);
        setRecordingError('Recording error occurred');
        setIsRecording(false);
      };

      mediaRecorder.onstart = () => {
        console.log('=== MEDIA RECORDER STARTED ===');
        console.log('State:', mediaRecorder.state);
      };

      mediaRecorder.onstop = () => {
        console.log('=== MEDIA RECORDER STOPPED ===');
        console.log('Final chunks count:', recordedChunksRef.current.length);
        console.log('Final total size:', recordedChunksRef.current.reduce((total, chunk) => total + chunk.size, 0), 'bytes');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Record in 1-second chunks for better data collection
      setIsRecording(true);
      
      console.log('Video recording started successfully');
      console.log('MediaRecorder state:', mediaRecorder.state);
      
    } catch (error) {
      console.error('=== ERROR STARTING RECORDING ===');
      console.error('Error details:', error);
      setRecordingError(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [defaultOptions, user]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      console.log('=== STOPPING VIDEO RECORDING ===');
      
      if (!mediaRecorderRef.current || !isRecording) {
        console.warn('No active recording to stop');
        resolve(null);
        return;
      }

      console.log('Current MediaRecorder state:', mediaRecorderRef.current.state);
      console.log('Current chunks count:', recordedChunksRef.current.length);

      mediaRecorderRef.current.onstop = () => {
        console.log('=== CREATING BLOB FROM CHUNKS ===');
        console.log('Total chunks to process:', recordedChunksRef.current.length);
        
        const totalSize = recordedChunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
        console.log('Total data size:', totalSize, 'bytes');
        
        if (totalSize === 0) {
          console.error('ERROR: No data recorded! All chunks are empty.');
          setRecordingError('No video data was recorded');
          resolve(null);
          return;
        }

        const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
        console.log('Creating blob with mime type:', mimeType);
        
        const recordedBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        
        setIsRecording(false);
        console.log('=== BLOB CREATED SUCCESSFULLY ===');
        console.log('Blob size:', recordedBlob.size, 'bytes');
        console.log('Blob type:', recordedBlob.type);
        
        if (recordedBlob.size === 0) {
          console.error('ERROR: Created blob is empty despite having chunks!');
          setRecordingError('Created recording file is empty');
          resolve(null);
          return;
        }
        
        // Create a test URL to verify the blob
        const testUrl = URL.createObjectURL(recordedBlob);
        console.log('Test blob URL created:', testUrl.substring(0, 50) + '...');
        
        resolve(recordedBlob);
      };

      mediaRecorderRef.current.stop();
      console.log('Stop command sent to MediaRecorder');
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
      const fileName = `recording-${timestamp}.webm`;
      const filePath = `${user.id}/${assessmentId}/${fileName}`;

      console.log(`Uploading file: ${filePath}`);
      console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);
      console.log(`Duration: ${recordingDuration}s`);

      setUploadProgress(10);

      // Test bucket access first
      console.log('Testing bucket access...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('Error accessing buckets:', bucketsError);
        throw new Error(`Cannot access storage: ${bucketsError.message}`);
      }
      
      console.log('Available buckets:', buckets?.map(b => b.name));
      const targetBucket = buckets?.find(b => b.name === 'proctoring-recordings');
      
      if (!targetBucket) {
        console.error('Target bucket "proctoring-recordings" not found!');
        throw new Error('Storage bucket not found');
      }
      
      console.log('Target bucket found:', targetBucket);
      setUploadProgress(20);

      // Try to list existing files in the bucket to verify access
      console.log('Testing bucket read access...');
      const { data: existingFiles, error: listError } = await supabase.storage
        .from('proctoring-recordings')
        .list('', { limit: 1 });
      
      if (listError) {
        console.error('Cannot read from bucket:', listError);
      } else {
        console.log('Bucket read test successful. Existing files count:', existingFiles?.length || 0);
      }
      
      setUploadProgress(30);

      // Convert blob to ArrayBuffer for upload (sometimes helps with compatibility)
      console.log('Converting blob to ArrayBuffer...');
      const arrayBuffer = await blob.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
      
      setUploadProgress(40);

      // Upload to Supabase Storage with explicit options
      console.log('Starting upload to Supabase Storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proctoring-recordings')
        .upload(filePath, arrayBuffer, {
          contentType: 'video/webm',
          upsert: false,
          duplex: 'half'
        });

      if (uploadError) {
        console.error('=== UPLOAD ERROR DETAILS ===');
        console.error('Error message:', uploadError.message);
        console.error('Error details:', uploadError);
        console.error('File path attempted:', filePath);
        console.error('Content type:', 'video/webm');
        console.error('File size:', arrayBuffer.byteLength, 'bytes');
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('=== UPLOAD SUCCESSFUL ===');
      console.log('Upload result:', uploadData);
      setUploadProgress(60);

      // Verify the upload by checking if file exists
      console.log('Verifying uploaded file...');
      const { data: uploadedFile, error: verifyError } = await supabase.storage
        .from('proctoring-recordings')
        .list(user.id + '/' + assessmentId);
      
      if (verifyError) {
        console.error('Error verifying upload:', verifyError);
      } else {
        console.log('Files in upload directory:', uploadedFile?.map(f => f.name));
        const ourFile = uploadedFile?.find(f => f.name === fileName);
        if (ourFile) {
          console.log('Upload verified! File found:', ourFile);
        } else {
          console.warn('Upload may have failed - file not found in directory listing');
        }
      }
      
      setUploadProgress(70);

      // Create proctoring session record
      console.log('Creating proctoring session record...');
      const { data: sessionData, error: sessionError } = await supabase
        .from('proctoring_sessions')
        .insert({
          user_id: user.id,
          assessment_id: assessmentId,
          submission_id: submissionId,
          recording_path: filePath,
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

      setUploadProgress(80);

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
    console.log('=== CLEANING UP VIDEO RECORDING ===');
    
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
