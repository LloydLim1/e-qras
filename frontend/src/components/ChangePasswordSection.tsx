'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Status = { kind: 'success' | 'error'; text: string } | null;

export default function ChangePasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit() {
    setStatus(null);

    if (!current || !next || !confirm) {
      setStatus({ kind: 'error', text: 'Please fill in all three password fields.' });
      return;
    }
    if (next.length < 8) {
      setStatus({ kind: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setStatus({ kind: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (userErr || !email) {
        setStatus({ kind: 'error', text: 'You must be signed in to change your password.' });
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInErr) {
        setStatus({ kind: 'error', text: 'Current password is incorrect.' });
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) {
        const code = (updateErr as { code?: string }).code;
        if (code === 'weak_password') {
          setStatus({
            kind: 'error',
            text: 'This password has appeared in a known data breach. Please choose a different one.',
          });
        } else if (code === 'same_password') {
          setStatus({
            kind: 'error',
            text: 'New password must be different from your current password.',
          });
        } else {
          setStatus({
            kind: 'error',
            text: updateErr.message || 'Failed to update password.',
          });
        }
        // eslint-disable-next-line no-console
        console.error('updateUser error:', updateErr);
        return;
      }

      setStatus({ kind: 'success', text: 'Password updated successfully.' });
      setCurrent('');
      setNext('');
      setConfirm('');
      setShowCurrent(false);
      setShowNext(false);
      setShowConfirm(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setStatus({ kind: 'error', text: message });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="password-section">
      <h4 className="password-section-title">Change Password</h4>

      <PasswordField
        id="cps-current"
        label="Current Password"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
        onKeyDown={handleKeyDown}
        show={showCurrent}
        onToggleShow={() => setShowCurrent((v) => !v)}
        placeholder="Enter current password"
      />
      <PasswordField
        id="cps-new"
        label="New Password"
        autoComplete="new-password"
        value={next}
        onChange={setNext}
        onKeyDown={handleKeyDown}
        show={showNext}
        onToggleShow={() => setShowNext((v) => !v)}
        minLength={8}
        placeholder="At least 8 characters"
      />
      <PasswordField
        id="cps-confirm"
        label="Confirm New Password"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        onKeyDown={handleKeyDown}
        show={showConfirm}
        onToggleShow={() => setShowConfirm((v) => !v)}
        minLength={8}
        placeholder="Re-enter new password"
      />

      {status && (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          style={{
            margin: '8px 0',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 13,
            background: status.kind === 'success' ? '#dcfce7' : '#fee2e2',
            color: status.kind === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${status.kind === 'success' ? '#86efac' : '#fca5a5'}`,
          }}
        >
          {status.text}
        </div>
      )}

      <button
        type="button"
        className="update-password-btn"
        onClick={submit}
        disabled={loading}
      >
        {loading ? 'Updating…' : 'Update Password'}
      </button>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  onKeyDown,
  show,
  onToggleShow,
  autoComplete,
  placeholder,
  minLength,
}: PasswordFieldProps) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <div className="password-input-wrapper">
        <input
          type={show ? 'text' : 'password'}
          id={id}
          className="form-input"
          placeholder={placeholder}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      className="eye-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="eye-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
