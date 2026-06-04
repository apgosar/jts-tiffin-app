import React from 'react';

/**
 * JTS Logo – circular badge matching the Jain Tiffin Service brand identity.
 */
export default function JtsLogo({ className = 'w-12 h-12' }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Jain Tiffin Service Logo"
      role="img"
    >
      {/* Outer gold ring */}
      <circle cx="50" cy="50" r="49" fill="#F9A825" />
      {/* White background */}
      <circle cx="50" cy="50" r="44" fill="white" />
      {/* Inner gold ring line */}
      <circle cx="50" cy="50" r="40" fill="none" stroke="#F9A825" strokeWidth="1.5" />

      {/* Handle (top arc) */}
      <rect x="41" y="17" width="18" height="4" rx="2" fill="#B71C1C" />
      <rect x="45" y="18" width="10" height="2" rx="1" fill="white" />

      {/* Lid */}
      <rect x="34" y="21" width="32" height="7" rx="3" fill="#C62828" />
      <rect x="34" y="26" width="32" height="2" rx="0" fill="#9E1B1B" />

      {/* Box 1 */}
      <rect x="33" y="29" width="34" height="11" rx="2" fill="#D32F2F" />
      <line x1="33" y1="34" x2="67" y2="34" stroke="#B71C1C" strokeWidth="0.8" />

      {/* Box 2 */}
      <rect x="33" y="41" width="34" height="11" rx="2" fill="#C62828" />
      <line x1="33" y1="46" x2="67" y2="46" stroke="#9E1B1B" strokeWidth="0.8" />

      {/* Base */}
      <rect x="35" y="53" width="30" height="5" rx="2" fill="#B71C1C" />

      {/* Green leaves (left) */}
      <ellipse cx="30" cy="34" rx="9" ry="4" fill="#2E7D32" transform="rotate(-40 30 34)" />
      <ellipse cx="25" cy="27" rx="7" ry="3" fill="#388E3C" transform="rotate(-55 25 27)" />
      <line x1="32" y1="37" x2="24" y2="25" stroke="#1B5E20" strokeWidth="0.8" />

      {/* Green leaves (right) */}
      <ellipse cx="70" cy="34" rx="9" ry="4" fill="#2E7D32" transform="rotate(40 70 34)" />
      <ellipse cx="75" cy="27" rx="7" ry="3" fill="#388E3C" transform="rotate(55 75 27)" />
      <line x1="68" y1="37" x2="76" y2="25" stroke="#1B5E20" strokeWidth="0.8" />

      {/* JAIN text */}
      <text
        x="50" y="72"
        textAnchor="middle"
        fontFamily="'Oswald', Impact, sans-serif"
        fontWeight="700"
        fontSize="13"
        fill="#1A237E"
        letterSpacing="1"
      >
        JAIN
      </text>
      <text
        x="50" y="81"
        textAnchor="middle"
        fontFamily="'Poppins', Arial, sans-serif"
        fontWeight="600"
        fontSize="5.2"
        fill="#C62828"
        letterSpacing="0.5"
      >
        TIFFIN SERVICES
      </text>
    </svg>
  );
}
