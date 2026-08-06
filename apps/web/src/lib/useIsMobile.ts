import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if current viewport width is below 761px (i.e. <= 760px),
 * matching the JS breakpoint specified in DESIGN-NOTES.md §4 & §6.
 */
export function useIsMobile(breakpoint = 761): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();

    let mediaQuery: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', checkMobile);
      } else if ('addListener' in mediaQuery) {
        (mediaQuery as any).addListener(checkMobile);
      }
    }

    window.addEventListener('resize', checkMobile);

    return () => {
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', checkMobile);
        } else if ('removeListener' in mediaQuery) {
          (mediaQuery as any).removeListener(checkMobile);
        }
      }
      window.removeEventListener('resize', checkMobile);
    };
  }, [breakpoint]);

  return isMobile;
}
