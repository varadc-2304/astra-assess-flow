
import * as faceapi from 'face-api.js';
import { ProctoringOptions, FacePosition } from './types';

// Configure face detector with options
export const createFaceDetectionOptions = () => 
  new faceapi.TinyFaceDetectorOptions({ 
    inputSize: 224, 
    scoreThreshold: 0.5 
  });

// Check if face is centered with configurable tolerance
export const isFaceCentered = (
  detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>, 
  videoWidth: number, 
  videoHeight: number,
  tolerance: number
): boolean => {
  const box = detection.detection.box;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  
  const videoCenter = { x: videoWidth / 2, y: videoHeight / 2 };
  
  // Calculate how far (as a percentage of frame dimensions) the face is from center
  const offsetX = Math.abs(centerX - videoCenter.x) / videoWidth;
  const offsetY = Math.abs(centerY - videoCenter.y) / videoHeight;
  
  // Face should be within configurable % of center in both directions
  return offsetX < tolerance && offsetY < tolerance;
};

// Check if face is partially covered/occluded with improved detection
export const isFaceCovered = (
  detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>,
  threshold: number
): boolean => {
  // Use low landmark detection confidence as a proxy for occlusion
  const landmarks = detection.landmarks;
  if (!landmarks) return false;
  
  // Check if landmarks have unusually low confidence score
  // or if certain key landmarks are missing/have low confidence
  
  // A heuristic approach: if key facial landmarks deviate too much from expected positions
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const mouth = landmarks.getMouth();
  
  // Check if important facial features are detected
  if (nose.length < 3 || leftEye.length < 3 || rightEye.length < 3 || mouth.length < 5) {
    return true;
  }
  
  // Use detection score as an indicator of face quality with configurable threshold
  const detectionScore = detection.detection.score;
  
  // Use configurable threshold
  return detectionScore < threshold;
};

// Check for rapid head movements with improved threshold
export const checkForRapidMovements = (
  currentBox: faceapi.Box,
  faceHistory: {positions: FacePosition[], timestamps: number[]},
  movementThreshold: number
): boolean => {
  const { positions, timestamps } = faceHistory;
  
  // Need at least 3 positions for movement detection
  if (positions.length >= 3) {
    const recentPositions = positions.slice(-3);
    
    // Calculate movement distance
    let totalMovement = 0;
    for (let i = 1; i < recentPositions.length; i++) {
      const prev = recentPositions[i-1];
      const curr = recentPositions[i];
      
      // Calculate center points
      const prevCenterX = prev.x + prev.width/2;
      const prevCenterY = prev.y + prev.height/2;
      const currCenterX = curr.x + curr.width/2;
      const currCenterY = curr.y + curr.height/2;
      
      // Calculate distance between centers
      const distance = Math.sqrt(
        Math.pow(currCenterX - prevCenterX, 2) + 
        Math.pow(currCenterY - prevCenterY, 2)
      );
      
      // Normalize by face width to account for distance from camera
      totalMovement += distance / curr.width;
    }
    
    // Check recent timestamps to ensure this is a rapid movement
    const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
    const averageMovement = totalMovement / (recentPositions.length - 1);
    
    // Use configurable threshold for rapid movement detection
    if (averageMovement > movementThreshold && timeSpan < 1500) {
      return true;
    }
  }
  
  return false;
};

// Draw functions for visualization
export const drawFaceDetectionResults = (
  canvas: HTMLCanvasElement,
  detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection, expressions?: faceapi.FaceExpressions }>[],
  options: ProctoringOptions,
  status: string,
  violations?: Record<string, number>
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear previous drawings
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (detections.length > 0) {
    // Draw each detected face
    detections.forEach((detection) => {
      const box = detection.detection.box;
      
      // Define a border color based on status
      const borderColor = 
        detections.length > 1 
          ? "rgb(239, 68, 68)" // red
          : "rgb(245, 158, 11)"; // amber
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = borderColor;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      // Add corner marks for better visibility
      const cornerLength = Math.min(25, Math.min(box.width, box.height) / 4);
      ctx.lineWidth = 4;
      
      // Draw corner marks (top-left, top-right, bottom-left, bottom-right)
      // Top-left
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + cornerLength);
      ctx.lineTo(box.x, box.y);
      ctx.lineTo(box.x + cornerLength, box.y);
      ctx.stroke();
      
      // Top-right
      ctx.beginPath();
      ctx.moveTo(box.x + box.width - cornerLength, box.y);
      ctx.lineTo(box.x + box.width, box.y);
      ctx.lineTo(box.x + box.width, box.y + cornerLength);
      ctx.stroke();
      
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + box.height - cornerLength);
      ctx.lineTo(box.x, box.y + box.height);
      ctx.lineTo(box.x + cornerLength, box.y + box.height);
      ctx.stroke();
      
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(box.x + box.width - cornerLength, box.y + box.height);
      ctx.lineTo(box.x + box.width, box.y + box.height);
      ctx.lineTo(box.x + box.width, box.y + box.height - cornerLength);
      ctx.stroke();

      // Optionally draw landmarks
      if (options.drawLandmarks) {
        faceapi.draw.drawFaceLandmarks(canvas, detection);
      }
      
      // Optionally draw expressions
      if (options.drawExpressions && 'expressions' in detection) {
        const expressions = detection.expressions;
        if (expressions) {
          const sorted = Object.entries(expressions)
            .sort((a, b) => b[1] - a[1]);
            
          if (sorted.length > 0) {
            const [emotion, confidence] = sorted[0];
            const text = `${emotion}: ${Math.round(confidence * 100)}%`;
            
            ctx.font = '16px Arial';
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(text, box.x, box.y - 5);
            ctx.fillText(text, box.x, box.y - 5);
          }
        }
      }
    });
    
    // Show debug info if enabled
    if (options.showDebugInfo) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, 180, 80);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Faces: ${detections.length}`, 10, 20);
      ctx.fillText(`Status: ${status}`, 10, 40);
      
      if (options.trackViolations && violations) {
        const totalViolations = Object.values(violations).reduce((sum, val) => sum + val, 0);
        ctx.fillText(`Violations: ${totalViolations}`, 10, 60);
      }
    }
  }
};
