import {useId} from 'react';

const folds = {
  top: 'M10 13a2 2 0 0 1 2-2h22l-8 8H10v-6Z',
  middle: 'm34 11 4 4a2 2 0 0 1 0 2.8L22.9 33H11.6L34 11Z',
  bottom: 'M22.9 33H38v5a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2v-4l.6-1h11.3Z',
};

export function BrandMark({animate = false}: {animate?: boolean}) {
  const prefix = useId();
  const shape = prefix + '-fold';
  const lens = prefix + '-lens';
  const silver = prefix + '-silver';
  const shine = prefix + '-shine';
  return <span className={`brand-mark folded-brand-mark${animate ? ' folded-brand-enter' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" focusable="false">
      <defs>
        <linearGradient id={silver} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop stopColor="var(--brand-fold-edge)"/>
          <stop offset=".47" stopColor="var(--brand-fold-face)"/>
          <stop offset="1" stopColor="var(--brand-fold-edge)"/>
        </linearGradient>
        <g id={shape}>
          <path d={folds.top} fill="currentColor"/>
          <path className="brand-fold-middle" d={folds.middle} fill={`url(#${silver})`}/>
          <path d={folds.bottom} fill="currentColor"/>
        </g>
        {animate && <>
          <clipPath id={lens}><rect className="brand-lens-outline" x="3" y="3" width="42" height="42" rx="11"/></clipPath>
          <linearGradient id={shine} x2="1" y2=".5">
            <stop stopColor="white" stopOpacity="0"/>
            <stop offset=".52" stopColor="white" stopOpacity=".65"/>
            <stop offset="1" stopColor="white" stopOpacity="0"/>
          </linearGradient>
        </>}
      </defs>
      <use href={`#${shape}`}/>
      {animate && <g className="brand-liquid-lens">
        <g clipPath={`url(#${lens})`}>
          <rect width="48" height="48" fill="var(--zc-bg)"/>
          <use className="brand-refracted-fold" href={`#${shape}`}/>
          <rect className="brand-lens-sheen" x="-18" y="-8" width="13" height="64" fill={`url(#${shine})`}/>
        </g>
        <rect className="brand-lens-outline" x="3" y="3" width="42" height="42" rx="11"
          stroke="var(--brand-fold-edge)" strokeOpacity=".46" strokeWidth=".65"/>
      </g>}
    </svg>
  </span>;
}
