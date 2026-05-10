// @ts-nocheck
import React from 'react';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (localStorage.getItem('userId')) {
            window.location.replace('/dashboard');
        }
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const supabase = createClient();

        try {
            let loginEmail = username.trim();

            // If it doesn't look like an email, ask the backend to resolve the
            // username → email (no anon read on public.users under RLS).
            if (!loginEmail.includes('@')) {
                const lookupRes = await fetch('/api/auth/lookup-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: loginEmail }),
                });
                const lookup = await lookupRes.json().catch(() => ({}));
                if (lookup?.email) loginEmail = lookup.email;
            }

            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: password,
            });

            if (authError) throw authError;

            const user = data.user;
            const metadata = user.user_metadata || {};

            // Update status to 'Active' on first successful login if invited
            // We can do this via an RPC or a protected backend route if needed, 
            // but for now let's maintain the existing flow via client if possible.
            // Note: RLS must allow this update.
            if (metadata.status === 'Invited' || metadata.status === 'Pending') {
                await supabase.from('users').update({ status: 'Active' }).eq('id', metadata.public_user_id || user.id);
            }

            // Still using localStorage for now to maintain compatibility with existing components
            localStorage.setItem('userRole', metadata.role || 'admin');
            localStorage.setItem('userName', metadata.name || user.email);
            localStorage.setItem('userId', metadata.public_user_id || user.id);
            
            // Handle advisory class - might need to fetch this from public.users if not in metadata
            const { data: publicUser } = await supabase
                .from('users')
                .select('advisory_class')
                .eq('id', metadata.public_user_id || user.id)
                .single();

            if (publicUser?.advisory_class) {
                localStorage.setItem('advisoryClass', publicUser.advisory_class);
            } else {
                localStorage.removeItem('advisoryClass');
            }

            window.location.href = '/dashboard';
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
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
                    <h2 className="login-form-title">LOGIN</h2>
                    <form className="login-form" onSubmit={handleSubmit}>
                        {error && <div style={{ color: '#b91c1c', fontSize: '13px', textAlign: 'center', marginBottom: '12px', fontWeight: 500 }}>{error}</div>}

                        <div className="form-group">
                            <label htmlFor="username" className="form-label">Enter your username</label>
                            <div className="input-container">
                                <input
                                    type="text"
                                    id="username"
                                    className="form-input"
                                    placeholder="Username or Email"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">Enter your Password</label>
                            <div className="input-container">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    className="form-input"
                                    placeholder="Password"
                                    required
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

                        <div className="form-options">
                            <label className="remember-me">
                                <input type="checkbox" id="rememberMe" /> Remember me
                            </label>
                            <a href="/forgot-password" className="forgot-password">Forgot Password?</a>
                        </div>

                        <button type="submit" className="login-submit-btn" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}


