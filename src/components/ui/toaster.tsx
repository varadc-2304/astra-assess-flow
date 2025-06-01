
"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastIcon,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        // Determine toast variant based on title or explicit variant
        const toastVariant = variant || 
          (title?.toString().toLowerCase().includes('error') ? 'destructive' : 
           title?.toString().toLowerCase().includes('success') ? 'success' :
           title?.toString().toLowerCase().includes('warning') ? 'warning' :
           'default');

        return (
          <Toast key={id} variant={toastVariant} {...props}>
            <div className="flex items-start gap-3 flex-1">
              <ToastIcon variant={toastVariant} />
              <div className="flex-1 space-y-1 min-w-0">
                {title && (
                  <ToastTitle className="truncate pr-6">{title}</ToastTitle>
                )}
                {description && (
                  <ToastDescription className="pr-6 break-words">
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
