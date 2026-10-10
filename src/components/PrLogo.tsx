import React from 'react';

interface PrLogoProps {
  size?: number;
  className?: string;
  roundedClass?: string;
}

/** Main PR Reply AI platform logo — PR initials mark. */
export const PrLogo: React.FC<PrLogoProps> = ({ size = 40, className = '', roundedClass = 'rounded-xl' }) => {
  return (
    <span
      className={`${roundedClass} overflow-hidden flex items-center justify-center shadow-lg shadow-sky-500/20 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="PR Reply AI logo"
    >
      <img src="/pr-logo.svg" alt="PR Reply AI — PR initials logo" width={size} height={size} style={{ width: size, height: size }} />
    </span>
  );
};
