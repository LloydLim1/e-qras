// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function SupabaseBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.supabaseClient) return;

    try {
      // Must use the SSR-aware createBrowserClient (not bare supabase-js) so the
      // session lives in cookies — shared with the middleware and DashboardAuthGuard.
      // Using the bare client would store the session in localStorage and all
      // legacy-page queries would go out as anon, hitting RLS and returning empty.
      window.supabaseClient = createClient();
      window.dispatchEvent(new CustomEvent('supabase-ready'));
    } catch (error) {
      console.error('[E-QRAS] Failed to initialize Supabase client:', error);
    }
  }, []);

  return null;
}


