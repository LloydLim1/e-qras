// @ts-nocheck
import React from 'react';

export default function ResetPasswordPage() {
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [isError, setIsError] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const token = sessionStorage.getItem('resetToken');
        if (!token) {
            window.location.replace('/forgot-password');
        }
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage('Passwords do not match.');
            setIsError(true);
            return;
        }
        if (password.length < 8) {
            setMessage('Password must be at least 8 characters.');
            setIsError(true);
            return;
        }

        setLoading(true);
        setMessage('');
        setIsError(false);

        try {
            const salt = dcodeIO.bcrypt.genSaltSync(10);
            const hashedPassword = dcodeIO.bcrypt.hashSync(password, salt);

            const response = await fetch('/api/complete_reset.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: sessionStorage.getItem('resetToken'),
                    newPassword: hashedPassword
                })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to reset password.');

            sessionStorage.clear();
            setMessage('Password reset successful! Redirecting to login...');
            setIsError(false);
            setTimeout(() => window.location.href = '/login', 1200);
        } catch (err) {
            setMessage(err.message || 'Failed to reset password.');
            setIsError(true);
            setLoading(false);
            return;
        }

        setLoading(false);
    }

    return (
        <div className="login-container">
            <div className="login-brand">
                <div className="brand-logo-container">
                    <img src="logo.svg" alt="Emmaus Logo" className="brand-logo" />
                </div>
                <h1 className="brand-title">Emmaus QR Attendance System <br />(E - QRAS)</h1>
                <p className="brand-subtitle">"Smart Attendance, Smarter Learning"</p>
            </div>

            <div className="login-form-section">
                <div className="login-form-card">
                    <h2 className="login-form-title">NEW PASSWORD</h2>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                        Please create a strong password at least 8 characters long.
                    </p>
                    <form className="login-form" onSubmit={handleSubmit}>
                        {message && (
                            <div style={{ fontSize: '13px', textAlign: 'center', marginBottom: '12px', fontWeight: 500, color: isError ? '#b91c1c' : '#15803d' }}>
                                {message}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">New Password</label>
                            <div className="input-container">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    className="form-input"
                                    placeholder="Enter new password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <i
                                    className={`password-toggle fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}
                                    onClick={() => setShowPassword((v) => !v)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
                            <div className="input-container">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="confirmPassword"
                                    className="form-input"
                                    placeholder="Confirm new password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button type="submit" className="login-submit-btn" disabled={loading}>
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <a href="/login" style={{ color: '#860108', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>Cancel</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}


