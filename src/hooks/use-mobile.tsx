
import * as React from "react"

// Define the breakpoint as a constant in the file scope
export const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)
  const [screenWidth, setScreenWidth] = React.useState<number | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      setScreenWidth(window.innerWidth)
    }
    
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    setScreenWidth(window.innerWidth)
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  // Return just the boolean value instead of an object
  return isMobile === undefined ? false : isMobile
}

// Also export as a separate hook if we need the screen width
export function useMobileInfo() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)
  const [screenWidth, setScreenWidth] = React.useState<number | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      setScreenWidth(window.innerWidth)
    }
    
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    setScreenWidth(window.innerWidth)
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return { isMobile: !!isMobile, screenWidth };
}
