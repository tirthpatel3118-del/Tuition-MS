import React from 'react';

export function ClassBandhuMark({ className = '' }: { className?: string }) {
  return (
    <img
      src="/classbandhu-mark-v1.0.3.svg"
      className={className}
      alt="ClassBandhu logo"
      draggable={false}
    />
  );
}
