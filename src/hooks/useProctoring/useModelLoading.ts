
import { useState, useEffect, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

export const useModelLoading = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const modelsLoading = useRef(false);
  
  const loadModels = useCallback(async () => {
    if (isModelLoaded || modelsLoading.current) return;
    
    modelsLoading.current = true;
    
    try {
      console.log("Loading face-api.js models...");
      
      const modelPath = '/models';
      
      // Load all required face detection and recognition models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
        faceapi.nets.faceExpressionNet.loadFromUri(modelPath),
        faceapi.nets.ageGenderNet.loadFromUri(modelPath),
      ]);
      
      console.log("All models loaded successfully");
      setIsModelLoaded(true);
    } catch (error) {
      console.error("Error loading models:", error);
      throw error;
    } finally {
      modelsLoading.current = false;
    }
  }, [isModelLoaded]);
  
  return { isModelLoaded, loadModels, modelsLoading: modelsLoading.current };
};
