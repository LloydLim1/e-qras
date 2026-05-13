// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const clearUserData = () => {
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('userId');
  localStorage.removeItem('advisoryClass');
};

export default function DashboardAuthGuard() {
  useEffect(() => {
    let isMounted = true;
    let redirectTimeout: NodeJS.Timeout | null = null;

    const supabase = createClient();

    const syncSession = async () => {
      if (!isMounted) return;

      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          clearUserData();
          if (isMounted && !window.location.pathname.includes('/login')) {
            redirectTimeout = setTimeout(() => {
              if (isMounted) window.location.replace('/login');
            }, 100);
          }
          return;
        }

        const metadata = user.user_metadata || {};

        if (!metadata.role) {
          await supabase.auth.signOut();
          clearUserData();
          if (isMounted) {
            redirectTimeout = setTimeout(() => {
              if (isMounted) window.location.replace('/login');
            }, 100);
          }
          return;
        }

        if (!localStorage.getItem('userId')) {
          localStorage.setItem('userRole', metadata.role);
          localStorage.setItem('userName', metadata.name || user.email);
          localStorage.setItem('userId', metadata.public_user_id || user.id);
        }
      } catch (error) {
        console.error('[E-QRAS] Auth sync error:', error);
        clearUserData();
      }
    };

    syncSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        clearUserData();
        if (!window.location.pathname.includes('/login')) {
          redirectTimeout = setTimeout(() => {
            if (isMounted) window.location.replace('/login');
          }, 100);
        }
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await syncSession();
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, []);

  return null;
}
