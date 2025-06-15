
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Custom hook to record webcam, upload the recording to Supabase Storage,
 * and update the recording_url on the submissions table.
 */
export function useAssessmentRecording({
  submissionId,
  enabled,
}: {
  submissionId: string | null | undefined;
  enabled: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // Start camera and recording
  const startRecording = useCallback(async () => {
    if (isRecording || !enabled) return;
    try {
      // Prompt for camera access
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

      videoChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        toast({ title: "Camera recording started", description: "Your webcam is being recorded for proctoring purposes." });
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
        await uploadRecording(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      toast({ title: "Error starting camera", description: String((err as Error).message), variant: "destructive" });
    }
  }, [enabled, isRecording, toast]);

  // Stop recording and trigger upload
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  // Upload the blob to Supabase Storage and link to submission
  const uploadRecording = useCallback(async (blob: Blob) => {
    if (!submissionId) {
      toast({ title: "Error", description: "Submission ID not set. Video not uploaded.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      // Unique path: recordings/{submissionId}.webm
      const filePath = `recordings/${submissionId}.webm`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("proctering_recordings")
        .upload(filePath, blob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "video/webm",
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("proctering_recordings").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl ?? null;
      setVideoUrl(publicUrl);

      // Store URL in submission
      const { error: updateError } = await supabase
        .from("submissions")
        .update({ recording_url: publicUrl })
        .eq("id", submissionId);

      if (updateError) {
        throw updateError;
      }

      toast({ title: "Recording saved", description: "Your assessment session has been recorded and saved for review." });
    } catch (err) {
      toast({ title: "Recording upload failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [submissionId, toast]);

  // Auto-start/stop based on enabled flag
  useEffect(() => {
    if (enabled) {
      startRecording();
    }
    // Don't auto-stop here, we want to control stop with API (call stopRecording())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]); 

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stopRecording]);

  return {
    isRecording,
    isUploading,
    videoUrl,
    stopRecording,
  };
}
