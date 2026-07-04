/**
 * Full-size photo viewer — click any gallery photo to see the uncropped
 * image at screen size. Esc, backdrop click, or the X closes it.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  caption?: string;
  score?: number;
  onClose: () => void;
}

export const ImageLightbox: React.FC<Props> = ({ src, alt, caption, score, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Full-size photo"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-stone-200 hover:bg-white/20 transition-colors"
        aria-label="Close full-size view"
      >
        <X className="w-5 h-5" aria-hidden />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[85vh] object-contain rounded-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {(caption || score !== undefined) && (
        <div
          className="mt-4 max-w-2xl text-center px-4"
          onClick={(e) => e.stopPropagation()}
        >
          {score !== undefined && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500 text-on-brand text-xs font-bold tabular-nums mr-2 align-middle">
              {score}/10
            </span>
          )}
          {caption && (
            <span className="text-sm text-stone-300 leading-snug align-middle">{caption}</span>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
};
