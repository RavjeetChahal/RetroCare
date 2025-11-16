import { cn } from '@/lib/utils';
import React from 'react';

type MeteorsProps = {
  number?: number;
  className?: string;
};

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const Meteors: React.FC<MeteorsProps> = ({ number = 20, className }) => {
  const meteors = new Array(number).fill(true);

  return (
    <>
      {meteors.map((_, idx) => {
        const left = Math.floor(randomInRange(-400, 400));
        const delay = randomInRange(0.2, 0.8);
        const duration = Math.floor(randomInRange(2, 10));

        const style: React.CSSProperties = {
          position: 'absolute',
            top: 0,
          left: `${left}px`,
          width: '2px',
          height: '2px',
          borderRadius: '9999px',
          backgroundColor: '#94a3b8',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
          transform: 'rotate(215deg)',
          animation: `meteor ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
          pointerEvents: 'none',
        };

        const trailStyle: React.CSSProperties = {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80px',
          height: '1px',
          background: 'linear-gradient(90deg, #94a3b8 0%, rgba(148,163,184,0) 100%)',
        };

        return React.createElement(
          'span',
          {
            key: `meteor-${idx}`,
            className: cn(className),
            style,
          } as Record<string, unknown>,
          React.createElement('span', { style: trailStyle }),
        );
      })}
    </>
  );
};
