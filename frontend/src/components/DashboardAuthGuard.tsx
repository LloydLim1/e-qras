// @ts-nocheck
'use client';

import { useEffect } from 'react';

export default function DashboardAuthGuard() {
  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      window.location.replace('/login');
    }
  }, []);

  return null;
}

