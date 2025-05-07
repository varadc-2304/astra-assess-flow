
import { useIsMobile } from './use-mobile';

// This is a wrapper hook to adapt the useIsMobile return value to work with the sidebar component
export function useSidebarMobile(): boolean {
  const { isMobile } = useIsMobile();
  return isMobile;
}
