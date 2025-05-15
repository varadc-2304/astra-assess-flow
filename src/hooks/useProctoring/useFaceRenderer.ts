
import { useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { ProctoringOptions } from './index';

export const useFaceRenderer = (options: ProctoringOptions) => {
  const renderFaceDetection = useCallback((
    canvas: HTMLCanvasElement, 
    detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[]
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Don't draw if we've disabled debug drawing
    if (!options.showDebugInfo) return;
    
    // Draw bounding boxes
    faceapi.draw.drawDetections(canvas, detections);
    
    // Draw landmarks if enabled
    if (options.drawLandmarks) {
      faceapi.draw.drawFaceLandmarks(canvas, detections);
    }
    
    // Draw expressions if enabled and available
    if (options.drawExpressions && 
        detections[0] && 
        'expressions' in detections[0]) {
      faceapi.draw.drawFaceExpressions(
        canvas, 
        detections as faceapi.WithFaceExpressions<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>[]
      );
    }
    
    // Add custom drawing for face centered indicator
    detections.forEach(detection => {
      const { box } = detection.detection;
      const faceX = box.x + box.width / 2;
      const faceY = box.y + box.height / 2;
      
      // Draw center point of face
      ctx.beginPath();
      ctx.arc(faceX, faceY, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
      
      // Draw center point of canvas
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'green';
      ctx.fill();
      
      // Draw line between the two points
      ctx.beginPath();
      ctx.moveTo(faceX, faceY);
      ctx.lineTo(canvas.width / 2, canvas.height / 2);
      ctx.strokeStyle = 'blue';
      ctx.stroke();
      
      // Draw tolerance zone
      const toleranceX = canvas.width * (options.detectionOptions?.faceCenteredTolerance ?? 0.25);
      const toleranceY = canvas.height * (options.detectionOptions?.faceCenteredTolerance ?? 0.25);
      
      ctx.beginPath();
      ctx.rect(
        canvas.width / 2 - toleranceX,
        canvas.height / 2 - toleranceY,
        toleranceX * 2,
        toleranceY * 2
      );
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.stroke();
    });
  }, [options]);
  
  return { renderFaceDetection };
};
