
import React from 'react';
import { Video, Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordingIndicatorProps {
  isRecording: boolean;
  isUploading: boolean;
  size?: 'small' | 'default';
}

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  isRecording,
  isUploading,
  size = 'default'
}) => {
  if (!isRecording && !isUploading) return null;

  const iconSize = size === 'small' ? 'h-4 w-4' : 'h-5 w-5';
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-2 rounded-lg border",
      "bg-red-50 border-red-200 text-red-800",
      "dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
    )}>
      {isUploading ? (
        <>
          <Upload className={cn(iconSize, "animate-pulse")} />
          <span className={cn(textSize, "font-medium")}>
            Uploading recording...
          </span>
        </>
      ) : isRecording ? (
        <>
          <div className="relative">
            <Video className={iconSize} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </div>
          <span className={cn(textSize, "font-medium")}>
            Recording
          </span>
        </>
      ) : null}
    </div>
  );
};
