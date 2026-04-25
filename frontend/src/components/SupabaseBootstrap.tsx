// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function SupabaseBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.supabaseClient) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[E-QRAS] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    try {
      window.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      window.dispatchEvent(new CustomEvent('supabase-ready'));
      console.log('[E-QRAS] Supabase client bootstrapped from bundled @supabase/supabase-js');
    } catch (error) {
      console.error('[E-QRAS] Failed to initialize Supabase client:', error);
    }
  }, []);

  return null;
}


