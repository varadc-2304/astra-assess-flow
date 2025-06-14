
export function createRecordingFileName(userId: string, assessmentId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${userId}/${assessmentId}/recording-${timestamp}.webm`;
}

export function validateRecordingBlob(blob: Blob): boolean {
  if (!blob || blob.size === 0) {
    console.error('Invalid blob: empty or null');
    return false;
  }
  
  if (blob.size > 100 * 1024 * 1024) { // 100MB limit
    console.error('Blob too large:', blob.size, 'bytes');
    return false;
  }
  
  console.log('Blob validation passed:', {
    size: blob.size,
    type: blob.type
  });
  
  return true;
}

export function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log('Using mime type:', type);
      return type;
    }
  }
  
  console.warn('No supported mime type found, using default');
  return 'video/webm';
}
