// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function DashboardAuthGuard() {
  useEffect(() => {
    const supabase = createClient();

    const syncSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Clear local storage if no session
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('advisoryClass');
        window.location.replace('/login');
        return;
      }

      // Sync metadata to localStorage for legacy components
      const metadata = user.user_metadata || {};

      if (!metadata.role) {
        await supabase.auth.signOut();
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('advisoryClass');
        window.location.replace('/login');
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('advisoryClass');
        window.location.replace('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
