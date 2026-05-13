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
    const supabase = createClient();

    const syncSession = async () => {
      if (!isMounted) return;

      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        clearUserData();
        if (isMounted && !window.location.pathname.includes('/login')) {
          window.location.replace('/login');
        }
        return;
      }

      const metadata = user.user_metadata || {};

      if (!metadata.role) {
        await supabase.auth.signOut();
        clearUserData();
        if (isMounted) window.location.replace('/login');
        return;
      }

      if (!localStorage.getItem('userId')) {
        localStorage.setItem('userRole', metadata.role);
        localStorage.setItem('userName', metadata.name || user.email);
        localStorage.setItem('userId', metadata.public_user_id || user.id);
      }
    };

    syncSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        clearUserData();
        if (!window.location.pathname.includes('/login')) {
          window.location.replace('/login');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return null;
}
