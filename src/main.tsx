
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Set up the environment for TensorFlow.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/tf-serviceworker.js').then(
      (registration) => {
        console.log('TensorFlow.js ServiceWorker registration successful');
      },
      (error) => {
        console.log('TensorFlow.js ServiceWorker registration failed:', error);
      }
    );
  });
}

// Create the root and render the app
createRoot(document.getElementById("root")!).render(<App />);
