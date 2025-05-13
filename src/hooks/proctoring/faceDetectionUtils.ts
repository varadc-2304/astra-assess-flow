
import * as faceapi from 'face-api.js';
import { ProctoringStatus, ProctoringOptions, FaceHistory } from './types';

// Configure face detector with options
export const createFaceDetectionOptions = () => {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 416, // Smaller size for better performance
    scoreThreshold: 0.5 // Lower threshold for better detection
  });
};

// Check if face is covered (low confidence or partial detection)
export const isFaceCovered = (
  detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>, 
  threshold: number
): boolean => {
  // If detection score is below threshold, consider it potentially covered
  return detection.detection.score < threshold;
};

// Check if face is centered in frame
export const isFaceCentered = (
  detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>,
  videoWidth: number,
  videoHeight: number,
  tolerance: number
): boolean => {
  const { box } = detection.detection;
  
  // Calculate center points
  const faceX = box.x + (box.width / 2);
  const faceY = box.y + (box.height / 2);
  const centerX = videoWidth / 2;
  const centerY = videoHeight / 2;
  
  // Calculate normalized distances from center (0-1 range)
  const distanceX = Math.abs(faceX - centerX) / (videoWidth / 2);
  const distanceY = Math.abs(faceY - centerY) / (videoHeight / 2);
  
  // Face is centered if distance is within tolerance
  return distanceX <= tolerance && distanceY <= tolerance;
};

// Check for rapid movements based on face position history
export const checkForRapidMovements = (
  box: faceapi.Box, 
  faceHistory: FaceHistory,
  threshold: number
): boolean => {
  if (faceHistory.positions.length < 2) {
    return false; // Need at least 2 positions to detect movement
  }
  
  // Get previous position
  const prevPos = faceHistory.positions[faceHistory.positions.length - 1];
  
  // Calculate movement distance (normalized by face size)
  const normalizedXMove = Math.abs(box.x - prevPos.x) / box.width;
  const normalizedYMove = Math.abs(box.y - prevPos.y) / box.height;
  
  // Movement is rapid if it exceeds threshold
  return normalizedXMove > threshold || normalizedYMove > threshold;
};

// Draw detection results on canvas
export const drawFaceDetectionResults = (
  canvas: HTMLCanvasElement,
  detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>[],
  options: ProctoringOptions,
  status: ProctoringStatus,
  violations?: Record<string, number>
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Clear previous drawings
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw debug info if enabled
  if (options.showDebugInfo) {
    // Draw status text
    ctx.font = '16px Arial';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    
    // Status display
    ctx.strokeText(`Status: ${status}`, 10, 30);
    ctx.fillText(`Status: ${status}`, 10, 30);
    
    // Faces count
    ctx.strokeText(`Faces: ${detections.length}`, 10, 60);
    ctx.fillText(`Faces: ${detections.length}`, 10, 60);
    
    // Draw violations if tracking enabled and available
    if (violations && options.trackViolations) {
      let yPos = 90;
      Object.entries(violations).forEach(([key, count]) => {
        if (count > 0) {
          const text = `${key}: ${count}`;
          ctx.strokeText(text, 10, yPos);
          ctx.fillText(text, 10, yPos);
          yPos += 25;
        }
      });
    }
  }
  
  // Draw each detection
  detections.forEach(detection => {
    const { box } = detection.detection;

    // Determine box color based on status
    let boxColor = 'green';
    if (status === 'multipleFacesDetected') boxColor = 'red';
    else if (status === 'noFaceDetected') boxColor = 'yellow';
    else if (status === 'faceCovered' || status === 'faceNotCentered' || status === 'rapidMovement') boxColor = 'orange';
    
    // Draw detection box
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = boxColor;
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.stroke();
    
    // Draw landmarks if enabled
    if (options.drawLandmarks && detection.landmarks) {
      const points = detection.landmarks.positions;
      ctx.fillStyle = boxColor;
      
      points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    
    // Draw expressions if enabled and available
    if (options.drawExpressions && 'expressions' in detection) {
      const expressions = detection.expressions;
      if (expressions) {
        // Find dominant expression
        let dominantExpression = 'neutral';
        let maxScore = 0;
        
        Object.entries(expressions).forEach(([expression, score]) => {
          if (score > maxScore) {
            dominantExpression = expression;
            maxScore = score;
          }
        });
        
        // Draw expression text
        ctx.font = '14px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeText(dominantExpression, box.x, box.y - 5);
        ctx.fillText(dominantExpression, box.x, box.y - 5);
      }
    }
  });
};
