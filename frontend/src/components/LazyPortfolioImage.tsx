/**
 * Intersection Observer lazy-load for gallery thumbnails (A8).
 */

import React, { useEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}

export const LazyPortfolioImage: React.FC<Props> = ({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div ref={rootRef} className={`relative w-full h-full ${className}`}>
      {visible && src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className={imgClassName} />
      ) : (
        <div className="flex items-center justify-center h-full w-full bg-photo-black/80 animate-pulse">
          <ImageIcon className="w-8 h-8 text-stone-700" aria-hidden />
        </div>
      )}
    </div>
  );
};
