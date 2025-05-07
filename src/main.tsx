
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MOBILE_BREAKPOINT } from './hooks/use-mobile.tsx'

// Make MOBILE_BREAKPOINT accessible globally
window.MOBILE_BREAKPOINT = MOBILE_BREAKPOINT;

// Create the root and render the app
createRoot(document.getElementById("root")!).render(<App />);
