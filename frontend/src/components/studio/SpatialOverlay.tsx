/**
 * Ported from photography-coach-gemma4/components/SpatialOverlay.tsx
 * Numbered pins + severity outlines (percent-based bbox).
 */

import React, { useState } from 'react';
import type { StudioBoundingBox } from '../../types/studio';

interface SpatialOverlayProps {
  boundingBoxes: StudioBoundingBox[];
  show: boolean;
  activeIndex: number | null;
  onHover: (idx: number | null) => void;
  onPinClick?: (idx: number) => void;
  /** Show all issue regions (How to Fix tab) */
  showAllRegions?: boolean;
}

const SEVERITY_STYLES = {
  critical: {
    border: 'border-rose-500',
    bg: 'bg-rose-500/10',
    pin: 'bg-rose-500 text-white ring-rose-400',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.5)]',
  },
  moderate: {
    border: 'border-amber-400',
    bg: 'bg-amber-400/10',
    pin: 'bg-amber-400 text-on-brand ring-amber-300',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.5)]',
  },
  minor: {
    border: 'border-brand-300',
    bg: 'bg-brand-300/10',
    pin: 'bg-brand-400 text-on-brand ring-brand-300',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.35)]',
  },
};

const BoxPin: React.FC<{
  box: StudioBoundingBox;
  index: number;
  isActive: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
  showRegion: boolean;
}> = ({ box, index, isActive, onEnter, onLeave, onClick, showRegion }) => {
  const [localHover, setLocalHover] = useState(false);
  const active = isActive || localHover;
  const s = SEVERITY_STYLES[box.severity] ?? SEVERITY_STYLES.minor;
  const pinCx = box.x + box.width / 2;
  const pinCy = box.y + box.height / 2;

  return (
    <>
      <div
        className={`absolute border-2 rounded-sm pointer-events-none transition-all duration-150 ${s.border} ${s.bg} ${
          active || showRegion ? `opacity-100 ${active ? s.glow : ''}` : 'opacity-0'
        }`}
        style={{
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
          zIndex: active ? 20 : 5,
        }}
      />
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${pinCx}%`, top: `${pinCy}%`, zIndex: active ? 40 : 15 }}
        onMouseEnter={() => {
          setLocalHover(true);
          onEnter();
        }}
        onMouseLeave={() => {
          setLocalHover(false);
          onLeave();
        }}
      >
        <button
          type="button"
          onClick={onClick}
          className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-extrabold ring-2 transition-all cursor-pointer shadow-lg ${s.pin} ${
            active ? 'scale-125' : 'scale-100'
          }`}
          aria-label={`Issue ${index + 1}: ${box.description}`}
        >
          {index + 1}
        </button>
      </div>
    </>
  );
};

const SpatialOverlay: React.FC<SpatialOverlayProps> = ({
  boundingBoxes,
  show,
  activeIndex,
  onHover,
  onPinClick,
  showAllRegions = false,
}) => {
  if (!show || boundingBoxes.length === 0) return null;

  return (
    <>
      {boundingBoxes.map((box, i) => (
        <BoxPin
          key={i}
          box={box}
          index={i}
          isActive={activeIndex === i}
          showRegion={showAllRegions}
          onEnter={() => onHover(i)}
          onLeave={() => onHover(null)}
          onClick={() => onPinClick?.(i)}
        />
      ))}
    </>
  );
};

export default SpatialOverlay;
