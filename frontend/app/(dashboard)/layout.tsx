// @ts-nocheck
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import BodyClassManager from '@/components/BodyClassManager';
import DashboardAuthGuard from '@/components/DashboardAuthGuard';
import { createClient } from '@/utils/supabase/client';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'fa-solid fa-chart-line' },
  { href: '/attendance', label: 'Attendance', icon: 'fa-solid fa-clipboard-check' },
  { href: '/user-management', label: 'Users', pageTitle: 'User Management', icon: 'fa-solid fa-users-gear' },
  { href: '/import', label: 'Import', icon: 'fa-solid fa-file-import' },
  { href: '/my-section', label: 'My Section', icon: 'fa-solid fa-users' },
  { href: '/qr-scanner', label: 'QR Scanner', icon: 'fa-solid fa-qrcode' },
  { href: '/reports', label: 'Reports', icon: 'fa-solid fa-chart-column' },
  { href: '/student-qrs', label: 'Student QRs', icon: 'fa-solid fa-id-card' },
  { href: '/settings', label: 'Settings', icon: 'fa-solid fa-gear' }
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('User');
  const [userRole, setUserRole] = useState('Admin');
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [advisoryClass, setAdvisoryClass] = useState<string | null>(null);

  useEffect(() => {
    const syncProfile = () => {
      const storedName = localStorage.getItem('userName');
      const storedRole = localStorage.getItem('userRole');
      const storedProfileImage = localStorage.getItem('userProfileImage');
      const storedAdvisory = localStorage.getItem('advisoryClass');

      if (storedName) setUserName(storedName);
      if (storedRole) setUserRole(storedRole);
      setUserProfileImage(storedProfileImage || null);
      setAdvisoryClass(storedAdvisory || null);
    };

    syncProfile();
    window.addEventListener('storage', syncProfile);
    window.addEventListener('user-profile-updated', syncProfile as EventListener);

    return () => {
      window.removeEventListener('storage', syncProfile);
      window.removeEventListener('user-profile-updated', syncProfile as EventListener);
    };
  }, []);

  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (item.href === '/my-section') {
        const role = userRole.toLowerCase();
        if (role === 'teacher') return true;
        if (role === 'admin') {
          return advisoryClass && advisoryClass.trim() !== '' && advisoryClass !== '-';
        }
        return false;
      }
      // Assuming Guards shouldn't see certain things, but the user only requested 'My Section' condition.
      return true;
    });
  }, [userRole, advisoryClass]);

  const activeItem = useMemo(() => {
    const exact = filteredNavItems.find((item) => item.href === pathname);
    if (exact) return exact;
    const nested = filteredNavItems.find((item) => pathname?.startsWith(item.href + '/'));
    return nested || filteredNavItems[0];
  }, [pathname, filteredNavItems]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('advisoryClass');
    sessionStorage.removeItem('resetEmail');
    sessionStorage.removeItem('resetToken');
    router.replace('/login');
  }

  return (
    <>
      <BodyClassManager className="page-loading" />
      <DashboardAuthGuard />

      <div id="pageTransitionOverlay" className="page-transition-overlay">
        <div className="loader-logo"></div>
      </div>

      <div className="app-container">
        <aside className="sidebar">
          <div className="logo-section animate-on-load">
            <div className="logo-container">
              <img src="/logo.svg" alt="E-QRAS Logo" className="logo-image" />
            </div>
            <h1 className="app-title">E - QRAS</h1>
          </div>

          <nav className="navigation">
            {filteredNavItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-button ${activeItem?.href === item.href ? 'active' : ''} animate-on-load`}
                style={{ animationDelay: `${0.15 + index * 0.06}s` }}
              >
                <i className={`${item.icon} nav-icon`} aria-hidden="true" />
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="logout-section animate-on-load" style={{ animationDelay: '0.8s' }}>
            <button className="logout-button" id="logoutBtn" onClick={handleLogout}>
              <svg
                className="logout-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" x2="9" y1="12" y2="12"></line>
              </svg>
              <span className="logout-label">Log out</span>
            </button>
          </div>
        </aside>

        <main className="main-content">
          <header className="content-header">
            <div className="header-info">
              <h2 className="page-title" id="pageTitle">
                {activeItem?.pageTitle || activeItem?.label || 'Dashboard'}
              </h2>
            </div>

            <div className="user-profile">
              <div className="user-avatar">
                {userProfileImage ? (
                  <img
                    src={userProfileImage}
                    alt="Profile"
                    width="32"
                    height="32"
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="20" fill="#E5E7EB" />
                    <path
                      d="M20 20C23.3137 20 26 17.3137 26 14C26 10.6863 23.3137 8 20 8C16.6863 8 14 10.6863 14 14C14 17.3137 16.6863 20 20 20Z"
                      fill="#9CA3AF"
                    />
                    <path
                      d="M20 22C13.3726 22 8 24.6863 8 28V32H32V28C32 24.6863 26.6274 22 20 22Z"
                      fill="#9CA3AF"
                    />
                  </svg>
                )}
              </div>
              <div className="user-info">
                <div className="user-name" id="userName">
                  {userName}
                </div>
                <div className="user-role" id="userRole">
                  {userRole}
                </div>
              </div>
            </div>
          </header>

          <div className="content-wrapper">{children}</div>
        </main>
      </div>
    </>
  );
}

