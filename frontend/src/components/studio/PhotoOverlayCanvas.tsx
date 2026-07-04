/**
 * Positions overlays on the actual painted image area (object-contain aware).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface DisplayFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  src: string;
  alt: string;
  maxHeight?: string;
  children: React.ReactNode;
  /** Toolbar rendered over the photo container (e.g. hide pins) */
  toolbar?: React.ReactNode;
}

export const PhotoOverlayCanvas: React.FC<Props> = ({
  src,
  alt,
  maxHeight = 'min(50vh, 420px)',
  children,
  toolbar,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [frame, setFrame] = useState<DisplayFrame | null>(null);

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img?.naturalWidth) return;

    const cw = img.clientWidth;
    const ch = img.clientHeight;
    if (cw === 0 || ch === 0) return;

    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;

    setFrame({
      left: (cw - dw) / 2,
      top: (ch - dh) / 2,
      width: dw,
      height: dh,
    });
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, src]);

  return (
    <div className="relative mx-auto w-full flex justify-center">
      <div className="relative inline-block max-w-full">
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={measure}
          className="block w-auto max-w-full mx-auto rounded-lg"
          style={{ maxHeight }}
        />
        {frame && frame.width > 0 && (
          <div
            className="absolute"
            style={{
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
            }}
          >
            {children}
          </div>
        )}
        {toolbar}
      </div>
    </div>
  );
};
