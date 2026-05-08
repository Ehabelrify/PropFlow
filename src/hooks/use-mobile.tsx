import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    // Use mql.matches instead of window.innerWidth to prevent unnecessary re-renders.
    // The media query listener only fires when the match state actually changes,
    // which is more reliable and prevents cascading re-renders through SidebarProvider.
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);  // Set initial value using mql.matches
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
