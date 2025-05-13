
// Common types for the proctoring system

export type ProctoringStatus = 
  'initializing' | 
  'noFaceDetected' | 
  'faceDetected' | 
  'multipleFacesDetected' | 
  'faceCovered' |
  'faceNotCentered' |
  'rapidMovement' |
  'error';

export type ViolationType = 
  'noFaceDetected' | 
  'multipleFacesDetected' | 
  'faceNotCentered' | 
  'faceCovered' | 
  'rapidMovement' | 
  'frequentDisappearance' |
  'identityMismatch';

export interface ProctoringOptions {
  showDebugInfo?: boolean;
  drawLandmarks?: boolean;
  drawExpressions?: boolean;
  detectExpressions?: boolean;
  trackViolations?: boolean;
  detectionOptions?: {
    faceDetectionThreshold?: number;
    faceCenteredTolerance?: number;
    rapidMovementThreshold?: number;
  };
}

export interface DetectionResult {
  status: ProctoringStatus;
  facesCount: number;
  expressions?: Record<string, number>;
  message?: string;
}

export interface FacePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceHistory {
  positions: Array<FacePosition>;
  timestamps: number[];
}

export interface ViolationCounts {
  noFaceDetected: number;
  multipleFacesDetected: number;
  faceNotCentered: number;
  faceCovered: number;
  rapidMovement: number;
  frequentDisappearance: number;
  identityMismatch: number;
}
