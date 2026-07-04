import { useEffect, useState } from 'react';

/** Desktop/laptop: assignment capture via file upload, not webcam. */
export function usePreferUploadCapture(): boolean {
  const [preferUpload, setPreferUpload] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(pointer: fine) and (min-width: 768px)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine) and (min-width: 768px)');
    const update = () => setPreferUpload(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return preferUpload;
}
