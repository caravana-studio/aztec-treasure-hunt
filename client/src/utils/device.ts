import { useEffect, useState } from 'react';

const MOBILE_DEVICE_PATTERN =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;

export function isUnsupportedMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const matchesUserAgent = MOBILE_DEVICE_PATTERN.test(navigator.userAgent);
  const coarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const noHover =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none)').matches;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);

  return matchesUserAgent || (coarsePointer && noHover && shortSide < 1024);
}

export function useIsDesktopSupported(): boolean {
  const [isDesktopSupported, setIsDesktopSupported] = useState(
    () => !isUnsupportedMobileDevice()
  );

  useEffect(() => {
    const updateSupport = () => {
      setIsDesktopSupported(!isUnsupportedMobileDevice());
    };

    updateSupport();
    window.addEventListener('resize', updateSupport);
    window.addEventListener('orientationchange', updateSupport);

    return () => {
      window.removeEventListener('resize', updateSupport);
      window.removeEventListener('orientationchange', updateSupport);
    };
  }, []);

  return isDesktopSupported;
}
