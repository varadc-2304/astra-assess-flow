
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add a constant to make the mobile breakpoint accessible globally
const MOBILE_BREAKPOINT = 768;
window.MOBILE_BREAKPOINT = MOBILE_BREAKPOINT;

createRoot(document.getElementById("root")!).render(<App />);
