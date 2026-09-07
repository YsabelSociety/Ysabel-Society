'use client';
import { useId } from 'react';
import { appPath } from '@/lib/app-path';
import { INTRO_LOGO_COLOR, INTRO_TEXT_COLOR } from './brand-appearance';
export function BrandLogo({
  className = '',
  introPalette = false,
  wordmarkOnly = false,
}: {
  className?: string;
  introPalette?: boolean;
  wordmarkOnly?: boolean;
}) {
  const mask = useId();
  if (introPalette)
    return (
      <svg
        className={'brand-logo ' + className}
        viewBox={wordmarkOnly ? '1502 2158 4996 1916' : '0 0 8000 4500'}
        width={wordmarkOnly ? 4996 : 8000}
        height={wordmarkOnly ? 1916 : 4500}
        aria-label="Ysabel Society"
      >
        <title>Ysabel Society</title>
        <defs>
          <mask
            id={mask}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={8000}
            height={4500}
            style={{ maskType: 'alpha' }}
          >
            <image
              href={appPath('/ysabel-society-logo.png')}
              width={8000}
              height={4500}
            />
          </mask>
        </defs>
        <g mask={`url(#${mask})`}>
          <rect width={8000} height={4500} fill={INTRO_TEXT_COLOR} />
          <rect width={8000} height={2000} fill={INTRO_LOGO_COLOR} />
        </g>
      </svg>
    );
  return (
    <img
      src={appPath('/ysabel-society-logo.png')}
      alt="Ysabel Society"
      width={8000}
      height={4500}
      className={'brand-logo ' + className}
    />
  );
}
