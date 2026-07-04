/**
 * ApertureLoader - Photography equipment-inspired loading indicator
 * Mimics the opening/closing blades of a camera aperture (iris diaphragm)
 */

import React from 'react';

interface Props {
  /** Size in pixels (default: 48) */
  size?: number;
  /** Number of aperture blades (default: 6) */
  blades?: number;
  /** Optional className for the container */
  className?: string;
}

export const ApertureLoader: React.FC<Props> = ({
  size = 48,
  blades = 6,
  className = '',
}) => {
  return (
    <div
      className={`aperture-loader ${className}`}
      style={
        {
          '--aperture-size': `${size}px`,
          '--blade-count': blades,
        } as React.CSSProperties
      }
      role="status"
      aria-label="Loading"
    >
      {[...Array(blades)].map((_, i) => (
        <div
          key={i}
          className="aperture-blade-rotator"
          style={{ transform: `rotate(${(i * 360) / blades}deg)` }}
        >
          <div
            className="aperture-blade"
            style={{ '--blade-index': i } as React.CSSProperties}
          />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
};
