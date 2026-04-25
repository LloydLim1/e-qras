// @ts-nocheck
import React from 'react';

export default function IndexApp() {
    const [status, setStatus] = React.useState('Redirecting...');

    React.useEffect(() => {
        const hasUser = !!localStorage.getItem('userId');
        const target = hasUser ? 'dashboard' : 'login';
        setStatus(`Redirecting to ${target}...`);
        window.location.replace(target);
    }, []);

    return (
        <div className="login-container" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
            <div className="login-form-card" style={{ maxWidth: '420px', textAlign: 'center' }}>
                <h2 className="login-form-title">E-QRAS</h2>
                <p>{status}</p>
            </div>
        </div>
    );
}


