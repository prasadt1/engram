/**
 * Subtle blurred strip of the user's own library photos — Home backdrop only.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PhotoThumb {
  id: string;
  imageUrl: string;
}

interface Props {
  photos: PhotoThumb[];
}

export const LibraryBackdrop: React.FC<Props> = ({ photos }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || photos.length === 0) return null;

  const strip = photos.slice(0, 8);

  return createPortal(
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-y-[18%] -left-[8%] -right-[8%] flex items-center justify-center gap-3 md:gap-5 opacity-[0.11] blur-[28px] saturate-[0.35] brightness-[0.85]"
      >
        {strip.map((photo) => (
          <div
            key={photo.id}
            className="shrink-0 w-[28vw] max-w-[220px] aspect-[4/3] rounded-lg overflow-hidden"
          >
            <img
              src={photo.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 70% at 50% 45%, transparent 35%, var(--color-canvas) 88%)',
        }}
      />
    </div>,
    document.body,
  );
};
