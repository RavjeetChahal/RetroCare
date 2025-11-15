import { useEffect, useState } from 'react';

/**
 * Small helper hook we can extend later to sync persisted data.
 */
export const useHydratedStore = () => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsHydrated(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return isHydrated;
};

