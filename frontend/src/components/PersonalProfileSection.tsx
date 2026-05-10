'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Status = { kind: 'success' | 'error'; text: string } | null;

interface ProfileSnapshot {
  publicId: number | string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
}

const EMPTY_PROFILE: ProfileSnapshot = {
  publicId: '',
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
};

export default function PersonalProfileSection() {
  const [profile, setProfile] = useState<ProfileSnapshot>(EMPTY_PROFILE);
  const [draft, setDraft] = useState<ProfileSnapshot>(EMPTY_PROFILE);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = createClient();
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) {
          if (mounted) {
            setStatus({ kind: 'error', text: 'You must be signed in.' });
            setLoading(false);
          }
          return;
        }

        const { data: row, error: rowErr } = await supabase
          .from('users')
          .select('id, first_name, last_name, phone, address')
          .eq('auth_id', userData.user.id)
          .single();

        if (!mounted) return;

        if (rowErr || !row) {
          setStatus({ kind: 'error', text: rowErr?.message || 'Profile not found.' });
          setLoading(false);
          return;
        }

        const snapshot: ProfileSnapshot = {
          publicId: row.id,
          firstName: row.first_name ?? '',
          lastName: row.last_name ?? '',
          phone: row.phone ?? '',
          address: row.address ?? '',
        };
        setProfile(snapshot);
        setDraft(snapshot);
        setLoading(false);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load profile.';
        setStatus({ kind: 'error', text: message });
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  function startEditing() {
    setStatus(null);
    setDraft(profile);
    setEditing(true);
  }

  function cancelEditing() {
    setStatus(null);
    setDraft(profile);
    setEditing(false);
  }

  async function save() {
    setStatus(null);
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setStatus({ kind: 'error', text: 'First name and last name are required.' });
      return;
    }
    if (!profile.publicId) {
      setStatus({ kind: 'error', text: 'Profile has not been loaded yet.' });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const fullName = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
      const updates = {
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        full_name: fullName,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
      };

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.publicId)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) {
        // RLS may have silently filtered the row out — surface it instead of
        // pretending it worked.
        throw new Error('No row was updated. You may not have permission to edit this profile.');
      }

      const updatedSnapshot: ProfileSnapshot = {
        ...draft,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim(),
        address: draft.address.trim(),
      };
      setProfile(updatedSnapshot);
      setDraft(updatedSnapshot);
      setEditing(false);
      setStatus({ kind: 'success', text: 'Profile saved.' });

      try {
        localStorage.setItem('userName', fullName);
        window.dispatchEvent(new CustomEvent('user-profile-updated'));
      } catch {
        // swallow — non-critical
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile.';
      setStatus({ kind: 'error', text: message });
      // eslint-disable-next-line no-console
      console.error('PersonalProfileSection save error:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <h3 className="settings-card-title">Personal Profile</h3>
        {!editing ? (
          <button
            type="button"
            className="edit-btn"
            onClick={startEditing}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            Edit
          </button>
        ) : (
          <button type="button" className="edit-btn" onClick={cancelEditing} disabled={saving}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Cancel
          </button>
        )}
      </div>

      <div className="settings-form">
        <Field
          label="First Name"
          value={editing ? draft.firstName : profile.firstName}
          onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))}
          disabled={!editing || loading || saving}
          placeholder="Enter first name"
        />
        <Field
          label="Last Name"
          value={editing ? draft.lastName : profile.lastName}
          onChange={(v) => setDraft((d) => ({ ...d, lastName: v }))}
          disabled={!editing || loading || saving}
          placeholder="Enter last name"
        />
        <Field
          label="Phone Number"
          type="tel"
          value={editing ? draft.phone : profile.phone}
          onChange={(v) => setDraft((d) => ({ ...d, phone: v }))}
          disabled={!editing || loading || saving}
          placeholder="Enter phone number"
        />
        <Field
          label="Address"
          multiline
          value={editing ? draft.address : profile.address}
          onChange={(v) => setDraft((d) => ({ ...d, address: v }))}
          disabled={!editing || loading || saving}
          placeholder="Enter address"
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

        {editing && (
          <button
            type="button"
            className="save-btn"
            onClick={save}
            disabled={saving || loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}

function Field({ label, value, onChange, disabled, placeholder, type = 'text', multiline }: FieldProps) {
  const sharedProps = {
    className: multiline ? 'form-input form-textarea' : 'form-input',
    placeholder,
    disabled,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {multiline ? (
        <textarea rows={3} {...(sharedProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input type={type} {...(sharedProps as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
    </div>
  );
}
