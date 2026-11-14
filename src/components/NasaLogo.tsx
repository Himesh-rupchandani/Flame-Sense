import React from 'react';

export const NasaLogo: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 110 92"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="NASA Insignia"
  >
    <defs>
      <radialGradient id="nasaBlueSphere" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#1D64D8" />
        <stop offset="65%" stopColor="#0B3D91" />
        <stop offset="100%" stopColor="#062356" />
      </radialGradient>
    </defs>
    {/* Blue Sphere */}
    <circle cx="54" cy="46" r="38" fill="url(#nasaBlueSphere)" />
    {/* Subtle stars inside sphere */}
    <circle cx="38" cy="24" r="1.2" fill="#FFFFFF" opacity="0.9" />
    <circle cx="48" cy="20" r="0.9" fill="#FFFFFF" opacity="0.8" />
    <circle cx="66" cy="22" r="1.1" fill="#FFFFFF" opacity="0.85" />
    <circle cx="30" cy="34" r="0.8" fill="#FFFFFF" opacity="0.7" />
    <circle cx="72" cy="64" r="1.1" fill="#FFFFFF" opacity="0.85" />
    <circle cx="42" cy="68" r="0.9" fill="#FFFFFF" opacity="0.8" />
    <circle cx="58" cy="72" r="1.2" fill="#FFFFFF" opacity="0.9" />
    {/* White Orbital Ring */}
    <ellipse
      cx="54"
      cy="46"
      rx="46"
      ry="15"
      transform="rotate(-24 54 46)"
      stroke="#FFFFFF"
      strokeWidth="1.9"
      opacity="0.9"
    />
    {/* Red Chevron Vector */}
    <path
      d="M16 58 L54 39 L98 18 L57 44 L86 64 L52 46 Z"
      fill="#FC3D21"
    />
    {/* Crisp NASA Wordmark */}
    <text
      x="54"
      y="53"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="20"
      fontWeight="800"
      fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
      letterSpacing="1.2"
    >
      NASA
    </text>
  </svg>
);
