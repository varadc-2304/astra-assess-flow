
import * as faceapi from 'face-api.js';
import { useToast } from '@/hooks/use-toast';

// Define constants
const MODEL_URL = '/models';

// Load models with performance optimizations
export const loadModels = async (toast: ReturnType<typeof useToast>): Promise<boolean> => {
  try {
    // Check if models are already loaded to avoid reloading
    if (faceapi.nets.tinyFaceDetector.isLoaded && 
        faceapi.nets.faceLandmark68Net.isLoaded && 
        faceapi.nets.faceExpressionNet.isLoaded) {
      console.log('Face-API models already loaded');
      return true;
    }

    // Load models in parallel for better performance
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    
    console.log('Face-API models loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading face-api.js models:', error);
    toast({
      title: 'Error',
      description: 'Failed to load face detection models. Please refresh and try again.',
      variant: 'destructive',
    });
    return false;
  }
};
