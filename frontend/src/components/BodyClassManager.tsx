// @ts-nocheck
'use client';

import { useEffect } from 'react';

export default function BodyClassManager({ className }) {
  useEffect(() => {
    if (!className) return undefined;

    const classes = className
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean);

    classes.forEach((item) => document.body.classList.add(item));

    // Fallback: ensure the loading overlay never gets stuck.
    const readyTimer = setTimeout(() => {
      const overlay = document.getElementById('pageTransitionOverlay');
      if (overlay && overlay.style.display !== 'none') {
        overlay.classList.add('fade-out');
        setTimeout(() => {
          overlay.style.display = 'none';
        }, 1200);
      }

      document.body.classList.remove('page-loading');
      document.body.classList.add('page-ready');
    }, 900);

    return () => {
      clearTimeout(readyTimer);
      classes.forEach((item) => document.body.classList.remove(item));
      document.body.classList.remove('page-ready');
    };
  }, [className]);

  return null;
}

