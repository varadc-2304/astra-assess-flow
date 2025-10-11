
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    if (!submissionId || !userId) {
      return;
    }

    try {
      
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
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        uploadRecording();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second

    } catch (error) {
      toast({
        title: "Recording Error",
        description: "Failed to start camera recording. Please check your camera permissions.",
        variant: "destructive",
      });
    }
  }, [assessmentId, submissionId, userId, toast]);

  const stopRecording = useCallback(() => {
    
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
      return;
    }

    setIsUploading(true);
    
    try {
      
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

      const recordingUrl = urlData.publicUrl;

      // Update submission with recording URL
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ recording_url: recordingUrl })
        .eq('id', submissionId);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Recording Saved",
        description: "Assessment recording has been saved successfully.",
      });

    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to save recording. Please contact support if this persists.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      chunksRef.current = [];
    }
  }, [assessmentId, submissionId, userId, toast]);

  return {
    isRecording,
    isUploading,
    startRecording,
    stopRecording
  };
};
