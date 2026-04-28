// @ts-nocheck
import React from 'react';

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

        const client = window.supabaseClient;
        if (!client) {
            setError('Database connection error. Check your configuration.');
            setLoading(false);
            return;
        }

        try {
            const usernameInput = username.trim();
            const safeInput = usernameInput.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
            const { data: user, error: queryError } = await client
                .from('users')
                .select('*')
                .or(`username.eq."${safeInput}",email.eq."${safeInput}"`)
                .maybeSingle();

            if (queryError) throw queryError;
            if (!user) throw new Error('User not found.');

            if (user.status === 'Deactivated') {
                throw new Error('This account has been deactivated. Please contact an administrator.');
            }

            const isMatch = dcodeIO.bcrypt.compareSync(password, user.password);
            if (!isMatch) throw new Error('Incorrect password.');

            // Update status to 'Active' on first successful login if invited
            if (user.status === 'Invited' || user.status === 'Pending') {
                await client.from('users').update({ status: 'Active' }).eq('id', user.id);
            }

            localStorage.setItem('userRole', user.role || 'admin');
            localStorage.setItem('userName', user.full_name || user.username);
            localStorage.setItem('userId', user.id);
            // Cache advisory_class so attendance page and sidebar can filter
            if (user.advisory_class) {
                localStorage.setItem('advisoryClass', user.advisory_class);
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


