
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MOBILE_BREAKPOINT } from './hooks/use-mobile.tsx'
import * as tf from '@tensorflow/tfjs';

// Initialize TensorFlow with proper error handling and performance monitoring
async function initializeTensorFlow() {
  console.log("Initializing TensorFlow...");
  
  try {
    // Try WebGL first for best performance
    await tf.setBackend('webgl');
    await tf.ready();
    console.log("TensorFlow initialized with WebGL backend");
    return true;
  } catch (err) {
    console.warn("WebGL initialization failed, trying CPU fallback", err);
    
    try {
      // Fall back to CPU
      await tf.setBackend('cpu');
      await tf.ready();
      console.log("TensorFlow initialized with CPU fallback");
      
      // Print memory info to help with debugging
      const memInfo = await tf.memory();
      console.log("TensorFlow memory info:", memInfo);
      return true;
    } catch (cpuErr) {
      console.error("Failed to initialize TensorFlow with CPU fallback", cpuErr);
      return false;
    }
  }
}

// Initialize TensorFlow before rendering
initializeTensorFlow().then(success => {
  if (!success) {
    console.error("TensorFlow initialization failed completely. Face detection may not work.");
  }
  
  // Make MOBILE_BREAKPOINT accessible globally
  window.MOBILE_BREAKPOINT = MOBILE_BREAKPOINT;
  
  // Create the root and render the app
  createRoot(document.getElementById("root")!).render(<App />);
}).catch(err => {
  console.error("Critical error during TensorFlow initialization", err);
  // Still render the app, but face detection won't work
  createRoot(document.getElementById("root")!).render(<App />);
});
