/**
 * ViewfinderFrame - Adds camera viewfinder-style corner brackets to content
 * Mimics the focusing frame seen in camera viewfinders
 */

import React from 'react';

interface Props {
  /** Content to wrap with viewfinder corners */
  children: React.ReactNode;
  /** Optional className for the container */
  className?: string;
  /** Show active/focused state (animated corners) */
  active?: boolean;
}

export const ViewfinderFrame: React.FC<Props> = ({
  children,
  className = '',
  active = false,
}) => {
  return (
    <div className={`viewfinder-frame-container ${className}`}>
      {children}

      {/* Corner brackets */}
      <div
        className={`viewfinder-corners ${active ? 'viewfinder-corners-active' : ''}`}
        aria-hidden="true"
      >
        {/* Top-left */}
        <div className="viewfinder-corner viewfinder-corner-tl" />
        {/* Top-right */}
        <div className="viewfinder-corner viewfinder-corner-tr" />
        {/* Bottom-left */}
        <div className="viewfinder-corner viewfinder-corner-bl" />
        {/* Bottom-right */}
        <div className="viewfinder-corner viewfinder-corner-br" />
      </div>
    </div>
  );
};
