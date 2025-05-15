
import { useMemo } from 'react';
import { ProctoringOptions } from './index';

interface DetectionOptions {
  faceDetectionThreshold: number;
  faceCenteredTolerance: number;
  rapidMovementThreshold: number;
}

export const useDetectionOptions = (options: ProctoringOptions) => {
  const detectionOptions = useMemo<DetectionOptions>(() => ({
    faceDetectionThreshold: options.detectionOptions?.faceDetectionThreshold ?? 0.5,
    faceCenteredTolerance: options.detectionOptions?.faceCenteredTolerance ?? 0.25,
    rapidMovementThreshold: options.detectionOptions?.rapidMovementThreshold ?? 0.25,
  }), [options.detectionOptions]);

  return { detectionOptions };
};
