
import * as React from "react"

// Define the breakpoint as a constant in the file scope
export const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)
  const [screenWidth, setScreenWidth] = React.useState<number | undefined>(undefined)
  const [hasCamera, setHasCamera] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      setScreenWidth(window.innerWidth)
    }
    
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    setScreenWidth(window.innerWidth)
    
    // Check for camera capability
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setHasCamera(true))
        .catch(() => setHasCamera(false))
    } else {
      setHasCamera(false)
    }
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return { 
    isMobile: !!isMobile, 
    screenWidth, 
    hasCamera 
  };
}
