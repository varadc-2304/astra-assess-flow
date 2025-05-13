import * as faceapi from 'face-api.js';
import { ViolationType, ViolationCounts, FaceHistory } from './types';
import { isFaceCovered, isFaceCentered, checkForRapidMovements } from './faceDetectionUtils';

// Track violations for each detection result
export const trackViolations = (
  detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>[],
  videoWidth: number,
  videoHeight: number,
  options: {
    faceCenteredTolerance: number;
    faceDetectionThreshold: number;
    rapidMovementThreshold: number;
  },
  currentViolations: ViolationCounts,
  faceHistory: FaceHistory,
  noFaceCounter: number,
  lastFaceDetectionTime: number
): {
  updatedViolations: ViolationCounts;
  updatedNoFaceCounter: number;
  violationsDetected: boolean;
} => {
  const now = Date.now();
  let violationsDetected = false;
  const updatedViolations = { ...currentViolations };
  let updatedNoFaceCounter = noFaceCounter;

  if (detections.length === 0) {
    // No face detected
    updatedNoFaceCounter += 1;
    
    // Increase violation count if no face for 5 consecutive checks (5 seconds)
    if (updatedNoFaceCounter >= 5) {
      updatedViolations.noFaceDetected += 1;
      updatedNoFaceCounter = 0; // Reset counter after recording violation
      violationsDetected = true;
    }
    
    // Track frequent disappearance
    if (lastFaceDetectionTime > 0 && 
        now - lastFaceDetectionTime < 10000) {  // Within 10 seconds
      updatedViolations.frequentDisappearance += 1;
      violationsDetected = true;
    }
  } else {
    // Reset no-face counter
    updatedNoFaceCounter = 0;
    
    // Multiple faces detection
    if (detections.length > 1) {
      updatedViolations.multipleFacesDetected += 1;
      violationsDetected = true;
    }
    
    // Single face detection - check for other violations
    if (detections.length === 1) {
      const detection = detections[0];
      
      // Check if face is centered
      if (!isFaceCentered(detection, videoWidth, videoHeight, options.faceCenteredTolerance)) {
        updatedViolations.faceNotCentered += 1;
        violationsDetected = true;
      }
      
      // Check if face is covered
      if (isFaceCovered(detection, options.faceDetectionThreshold)) {
        updatedViolations.faceCovered += 1;
        violationsDetected = true;
      }
      
      // Check for rapid movements
      if (checkForRapidMovements(
        detection.detection.box, 
        faceHistory,
        options.rapidMovementThreshold
      )) {
        updatedViolations.rapidMovement += 1;
        violationsDetected = true;
      }
    }
  }

  return { 
    updatedViolations, 
    updatedNoFaceCounter, 
    violationsDetected 
  };
};

// Process face history to track movement
export const updateFaceHistory = (
  detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>[],
  faceHistory: FaceHistory
): FaceHistory => {
  const updatedHistory = { ...faceHistory };
  
  if (detections.length === 1) {
    const box = detections[0].detection.box;
    
    // Add current position
    updatedHistory.positions.push({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    });
    updatedHistory.timestamps.push(Date.now());
    
    // Keep only the last 5 positions
    if (updatedHistory.positions.length > 5) {
      updatedHistory.positions.shift();
      updatedHistory.timestamps.shift();
    }
  }
  
  return updatedHistory;
};
