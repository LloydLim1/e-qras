// @ts-nocheck
import React from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ForcePasswordChangePage() {
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showNewPassword, setShowNewPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const [tempEmail, setTempEmail] = React.useState('');
    const [tempPassword, setTempPassword] = React.useState('');
    const [tempName, setTempName] = React.useState('');

    React.useEffect(() => {
        const email = sessionStorage.getItem('tempEmail') || '';
        const password = sessionStorage.getItem('tempPassword') || '';
        const name = sessionStorage.getItem('tempName') || '';
        setTempEmail(email);
        setTempPassword(password);
        setTempName(name);
        if (!email || !password) {
            window.location.replace('/login');
        }
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (!newPassword || newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            // Call the force password change endpoint
            const response = await fetch('/api/auth/force-password-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: tempEmail,
                    currentPassword: tempPassword,
                    newPassword: newPassword,
                }),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to change password.');
            }

            setSuccess('Password changed successfully! Logging you in...');

            // Clear session storage
            sessionStorage.removeItem('tempEmail');
            sessionStorage.removeItem('tempPassword');
            sessionStorage.removeItem('tempName');

            // Wait 1 second then redirect to login
            setTimeout(() => {
                window.location.href = '/login?msg=password_changed';
            }, 1500);
        } catch (err) {
            setError(err.message || 'Failed to change password. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="login-form-section" style={{ width: '100%', maxWidth: '500px' }}>
                <div className="login-form-card">
                    <h2 className="login-form-title">Change Password Required</h2>
                    <p style={{ textAlign: 'center', marginBottom: '24px', fontSize: '14px', color: '#6b7280' }}>
                        Welcome, <strong>{tempName}</strong>! Your account requires a password change to activate.
                    </p>

                    <form className="login-form" onSubmit={handleSubmit}>
                        {error && (
                            <div style={{ color: '#b91c1c', fontSize: '13px', textAlign: 'center', marginBottom: '12px', fontWeight: 500, padding: '10px', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div style={{ color: '#15803d', fontSize: '13px', textAlign: 'center', marginBottom: '12px', fontWeight: 500, padding: '10px', backgroundColor: '#dcfce7', borderRadius: '4px' }}>
                                {success}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="newPassword" className="form-label">Enter New Password</label>
                            <div className="input-container">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    id="newPassword"
                                    className="form-input"
                                    placeholder="New Password (min 8 characters)"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={loading}
                                />
                                <i
                                    className={`password-toggle fa-regular ${showNewPassword ? 'fa-eye' : 'fa-eye-slash'}`}
                                    onClick={() => setShowNewPassword((v) => !v)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
                            <div className="input-container">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    id="confirmPassword"
                                    className="form-input"
                                    placeholder="Confirm Password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                />
                                <i
                                    className={`password-toggle fa-regular ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'}`}
                                    onClick={() => setShowConfirmPassword((v) => !v)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div>
                        </div>

                        <button type="submit" className="login-submit-btn" disabled={loading} style={{ marginTop: '16px' }}>
                            {loading ? 'Changing Password...' : 'Change Password & Activate Account'}
                        </button>
                    </form>

                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '4px', fontSize: '12px', color: '#4b5563' }}>
                        <strong>Password Requirements:</strong>
                        <ul style={{ margin: '8px 0 0 20px', paddingLeft: 0 }}>
                            <li>At least 8 characters long</li>
                            <li>Contains letters, numbers, or symbols</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
