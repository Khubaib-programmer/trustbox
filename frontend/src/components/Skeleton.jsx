import React from 'react';

/**
 * Skeleton
 * Subtle loading placeholder matching the design layout
 */
export default function Skeleton({ className = '' }) {
  return (
    <div className={`skeleton rounded-xl ${className}`} />
  );
}
