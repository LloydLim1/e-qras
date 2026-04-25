// @ts-nocheck
'use client';

import { useEffect } from 'react';

export default function LogoutRoute() {
  useEffect(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/login');
  }, []);

  return (
    <div className="login-page">
      <div className="login-container" style={{ minHeight: 'auto', maxWidth: '640px' }}>
        <div className="login-form-section" style={{ flex: 1 }}>
          <div className="login-form-card" style={{ textAlign: 'center' }}>
            <h2 className="login-form-title" style={{ marginBottom: '12px' }}>
              Logging Out
            </h2>
            <p style={{ color: '#4b5563' }}>Ending your session...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

