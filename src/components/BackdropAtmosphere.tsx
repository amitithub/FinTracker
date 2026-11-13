import React, { useState } from 'react';
import backdropGlassImg from '../assets/images/fintrack_backdrop_glass_1794565353581.jpg';

/**
 * Non-interactive translucent fintech backdrop layer.
 * Renders over a CSS gradient fallback so broken assets never occur.
 */
export function BackdropAtmosphere() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      aria-hidden="true"
      className="no-print pointer-events-none fixed inset-0 z-0 overflow-hidden bg-gradient-to-br from-blue-50/70 via-slate-50 to-slate-100/80 dark:from-[#0B1222] dark:via-[#090E1A] dark:to-[#0D1526]"
    >
      {!imgFailed && (
        <img
          src={backdropGlassImg}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-center opacity-30 dark:opacity-15 dark:brightness-75 dark:contrast-125 [mask-image:radial-gradient(ellipse_at_top_right,black_38%,transparent_90%)] select-none"
        />
      )}
    </div>
  );
}
