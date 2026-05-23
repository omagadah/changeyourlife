'use client';

import { ReactLenis } from 'lenis/react';
import type { ReactNode } from 'react';

/** Scroll fluide global (Lenis, 3 KB, gratuit MIT). */
export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 }}>
      {children}
    </ReactLenis>
  );
}
