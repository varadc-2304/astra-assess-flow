
// Common type declarations for the useProctoring hook and its related hooks

export interface FaceDetectionOptions {
  inputSize?: number;
  scoreThreshold?: number;
}

export interface FaceMatcher {
  labeledDescriptors: any[];
  distanceThreshold: number;
}

export interface FaceLandmarkPosition {
  x: number;
  y: number;
}

export interface FaceExpression {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
}

export interface FacePosition {
  x: number; 
  y: number;
  width: number;
  height: number;
}

export interface FaceData {
  detection?: FacePosition;
  landmarks?: FaceLandmarkPosition[];
  expressions?: FaceExpression;
  descriptor?: Float32Array;
  age?: number;
  gender?: string;
  genderProbability?: number;
}
