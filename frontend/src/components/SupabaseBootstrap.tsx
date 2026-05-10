// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function SupabaseBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.supabaseClient) return;

    try {
      // Share the cookie-based session storage with the login flow and the
      // SSR middleware. Using the bare @supabase/supabase-js client here
      // would put the session in localStorage and queries from legacy pages
      // would go out as anon, hitting RLS and returning empty.
      window.supabaseClient = createClient();
      window.dispatchEvent(new CustomEvent('supabase-ready'));
    } catch (error) {
      console.error('[E-QRAS] Failed to initialize Supabase client:', error);
    }
  }, []);

  return null;
}


