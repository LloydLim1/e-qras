// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function SupabaseBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const supabase = createClient();
      window.supabaseClient = supabase;

      // Listen for auth state changes to handle session switches
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          window.dispatchEvent(new CustomEvent('supabase-auth-change', { detail: { event, session } }));
        }
      });

      window.dispatchEvent(new CustomEvent('supabase-ready'));

      return () => subscription?.unsubscribe();
    } catch (error) {
      console.error('[E-QRAS] Failed to initialize Supabase client:', error);
    }
  }, []);

  return null;
}


