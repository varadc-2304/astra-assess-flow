
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AlertTriangle, Camera, MicOff, Mic, VideoOff, Video } from 'lucide-react';

interface WebcamProctorProps {
  assessmentId: string;
  submissionId?: string;
}

const WebcamProctor: React.FC<WebcamProctorProps> = ({ assessmentId, submissionId }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize camera when component mounts
  useEffect(() => {
    initializeCamera();
    return () => {
      stopRecording();
      cleanupMedia();
    };
  }, []);

  // Update timer while recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const initializeCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsMicActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      toast({
        title: "Camera access granted",
        description: "Proctoring system is now active",
      });
      
      // Start recording automatically once camera is initialized
      startRecording(mediaStream);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setRecordingError("Could not access camera or microphone. Please ensure permissions are granted.");
      toast({
        title: "Camera access denied",
        description: "Cannot proceed with assessment without camera access",
        variant: "destructive",
      });
    }
  };

  const startRecording = async (mediaStreamToUse: MediaStream) => {
    try {
      recordedChunksRef.current = [];
      const options = { mimeType: 'video/webm' };
      const recorder = new MediaRecorder(mediaStreamToUse, options);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = handleRecordingStopped;
      
      recorder.start(1000); // Capture in 1-second chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      // Create proctoring session record in database
      if (user) {
        try {
          const { data, error } = await supabase
            .from('proctoring_sessions')
            .insert({
              user_id: user.id,
              assessment_id: assessmentId,
              submission_id: submissionId || null,
              recording_path: `${user.id}/${assessmentId}/${new Date().toISOString()}.webm`
            })
            .select()
            .single();
            
          if (error) {
            console.error("Error creating proctoring session:", error);
          } else if (data) {
            setSessionId(data.id);
            console.log("Proctoring session created with ID:", data.id);
          }
        } catch (error) {
          console.error("Error creating proctoring session:", error);
        }
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      setRecordingError("Failed to start recording");
      toast({
        title: "Recording error",
        description: "Failed to start recording. Please try refreshing the page.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleRecordingStopped = async () => {
    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    await uploadRecording(blob);
    recordedChunksRef.current = [];
  };

  const uploadRecording = async (blob: Blob) => {
    if (!user || !sessionId) return;
    
    try {
      setIsUploading(true);
      const fileName = `${user.id}/${assessmentId}/${new Date().toISOString()}.webm`;
      
      const { data, error } = await supabase.storage
        .from('proctoring')
        .upload(fileName, blob, {
          contentType: 'video/webm',
          upsert: true
        });
        
      if (error) {
        console.error("Error uploading recording:", error);
        toast({
          title: "Upload error",
          description: "Failed to upload recording. Assessment will continue.",
          variant: "destructive",
        });
      } else {
        console.log("Recording uploaded successfully:", data.path);
        // Update the proctoring session with the actual path
        await supabase
          .from('proctoring_sessions')
          .update({ recording_path: data.path })
          .eq('id', sessionId);
      }
    } catch (err) {
      console.error("Error in upload process:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleCamera = () => {
    if (!stream) return;
    
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    
    const isEnabled = videoTracks[0].enabled;
    videoTracks[0].enabled = !isEnabled;
    setIsCameraActive(!isEnabled);
    
    toast({
      title: !isEnabled ? "Camera enabled" : "Camera disabled",
      description: !isEnabled 
        ? "Proctoring camera is now active" 
        : "Warning: Disabling camera during assessment may be flagged",
      variant: !isEnabled ? "default" : "destructive",
    });
  };
  
  const toggleMicrophone = () => {
    if (!stream) return;
    
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    const isEnabled = audioTracks[0].enabled;
    audioTracks[0].enabled = !isEnabled;
    setIsMicActive(!isEnabled);
    
    toast({
      title: !isEnabled ? "Microphone enabled" : "Microphone disabled",
      description: !isEnabled 
        ? "Proctoring microphone is now active" 
        : "Warning: Disabling microphone during assessment may be flagged",
      variant: !isEnabled ? "default" : "destructive",
    });
  };

  const cleanupMedia = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (sessionId) {
      // Update the session to mark it as ended
      supabase
        .from('proctoring_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .then(() => {
          console.log("Proctoring session ended");
        })
        .catch(err => {
          console.error("Error ending proctoring session:", err);
        });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (recordingError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg p-4 mb-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <h3 className="text-red-800 dark:text-red-300 font-medium">Camera access error</h3>
        </div>
        <p className="text-red-700 dark:text-red-400 mt-1 text-sm">{recordingError}</p>
        <Button 
          variant="destructive" 
          size="sm" 
          className="mt-2"
          onClick={initializeCamera}
        >
          Retry Camera Access
        </Button>
      </div>
    );
  }

  return (
    <div className="webcam-container aspect-video bg-gray-900">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
      
      <div className="webcam-overlay">
        <div className="webcam-status">
          <span className={`h-2 w-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></span>
          {isRecording ? (
            <span>Recording • {formatTime(recordingTime)}</span>
          ) : (
            <span>Not Recording</span>
          )}
        </div>
        
        <div className="webcam-controls">
          <button 
            className="webcam-control-button" 
            onClick={toggleMicrophone}
            title={isMicActive ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isMicActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          
          <button 
            className="webcam-control-button" 
            onClick={toggleCamera}
            title={isCameraActive ? "Turn Off Camera" : "Turn On Camera"}
          >
            {isCameraActive ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
        </div>
      </div>
      
      {isUploading && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="text-white text-xs font-medium">Uploading recording...</div>
        </div>
      )}
    </div>
  );
};

export default WebcamProctor;
