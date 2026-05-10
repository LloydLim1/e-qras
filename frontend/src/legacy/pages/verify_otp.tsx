// @ts-nocheck
import React from 'react';

export default function VerifyOtpPage() {
    const [email, setEmail] = React.useState('');
    const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
    const [message, setMessage] = React.useState('');
    const [isError, setIsError] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const inputRefs = React.useRef([]);

    React.useEffect(() => {
        const resetEmail = sessionStorage.getItem('resetEmail');
        if (!resetEmail) {
            window.location.replace('/forgot-password');
            return;
        }
        setEmail(resetEmail);
    }, []);

    function handleInput(index, value) {
        const clean = (value || '').replace(/\D/g, '').slice(0, 1);
        const next = [...otp];
        next[index] = clean;
        setOtp(next);
        if (clean && index < 5) inputRefs.current[index + 1]?.focus();
    }

    function handleKeyDown(index, e) {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const otpCode = otp.join('');
        if (otpCode.length < 6) return;

        setLoading(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: otpCode })
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success || !result.token) {
                throw new Error(result.error || 'Verification failed.');
            }

            sessionStorage.setItem('resetToken', result.token);
            setMessage('Verification successful!');
            setIsError(false);
            setTimeout(() => window.location.href = '/reset-password', 1200);
        } catch (err) {
            setMessage(err.message || 'Verification failed.');
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
                    <h2 className="login-form-title">VERIFY OTP</h2>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                        Please enter the 6-digit code sent to {email || 'your email'}.
                    </p>

                    <form className="login-form" onSubmit={handleSubmit}>
                        {message && (
                            <div style={{ fontSize: '13px', textAlign: 'center', marginBottom: '12px', fontWeight: 500, color: isError ? '#b91c1c' : '#15803d' }}>
                                {message}
                            </div>
                        )}

                        <div className="form-group">
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => (inputRefs.current[i] = el)}
                                        type="text"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleInput(i, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(i, e)}
                                        required
                                        style={{
                                            width: '45px',
                                            height: '55px',
                                            border: '2px solid #e0e0e0',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            fontSize: '24px',
                                            fontWeight: 700,
                                            color: '#860108',
                                            outline: 'none'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <button type="submit" className="login-submit-btn" disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify Code'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <button type="button" onClick={() => (window.location.href = '/forgot-password')} style={{ background: 'none', border: 'none', color: '#860108', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                                Resend OTP
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}


