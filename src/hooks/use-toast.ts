
// Update the default toast duration to 1 second
import { useToast as useToastOriginal } from "@/components/ui/toast"

export const useToast = () => {
  const toast = useToastOriginal()
  
  const originalToast = toast.toast
  
  // Override the toast function to set a default duration of 1 second
  toast.toast = (props) => {
    return originalToast({
      ...props,
      duration: props.duration || 1000,
    })
  }
  
  return toast
}
