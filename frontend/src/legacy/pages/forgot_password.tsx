// @ts-nocheck
import React from 'react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [isError, setIsError] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage('');
        setIsError(false);
        setLoading(true);

        const client = window.supabaseClient;
        if (!client) {
            setMessage('Database connection error.');
            setIsError(true);
            setLoading(false);
            return;
        }

        try {
            const normalizedEmail = email.trim().toLowerCase();

            const { data: user, error } = await client
                .from('users')
                .select('id, full_name, email')
                .ilike('email', normalizedEmail)
                .maybeSingle();

            if (error) throw error;
            if (!user) {
                throw new Error('No account found with that email address. Please make sure you entered the correct email used during registration.');
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            const { error: updateError } = await client
                .from('users')
                .update({ otp_code: otp, otp_expiry: expiry })
                .eq('id', user.id);
            if (updateError) throw updateError;

            const response = await fetch('/api/send_otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail, otp })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to send email.');
            }

            sessionStorage.setItem('resetEmail', normalizedEmail);
            setMessage('OTP has been sent to your email!');
            setIsError(false);
            setTimeout(() => window.location.href = '/verify-otp', 1200);
        } catch (err) {
            setMessage(err.message || 'Failed to send OTP.');
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
                    <h2 className="login-form-title">FORGOT PASSWORD</h2>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                        Enter your email address and we'll send you an OTP to reset your password.
                    </p>
                    <form className="login-form" onSubmit={handleSubmit}>
                        {message && (
                            <div style={{ fontSize: '13px', textAlign: 'center', marginBottom: '12px', fontWeight: 500, color: isError ? '#b91c1c' : '#15803d' }}>
                                {message}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email" className="form-label">Email Address</label>
                            <div className="input-container">
                                <input
                                    type="email"
                                    id="email"
                                    className="form-input"
                                    placeholder="example@email.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <button type="submit" className="login-submit-btn" disabled={loading}>
                            {loading ? 'Sending...' : 'Send OTP'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <a href="/login" style={{ color: '#860108', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                                <i className="fa-solid fa-arrow-left"></i> Back to Login
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}


