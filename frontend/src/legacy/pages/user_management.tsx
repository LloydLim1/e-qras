// @ts-nocheck
import React from 'react';
import { createClient } from '@/utils/supabase/client';

/* User Management page — React-driven with Data Table, Modal, and QRs */

async function apiFetch(path, options = {}) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };
    const res = await fetch(path, { ...options, headers });
    let data = null;
    try { data = await res.json(); } catch (_) { /* ignore */ }
    if (!res.ok) {
        const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
        throw new Error(message);
    }
    return data || {};
}

// ─── Custom multi-select dropdown ────────────────────────────────────────────
function MultiSelectDropdown({ options, selected, onChange, placeholder }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);

    React.useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    function toggle(value) {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    }

    const label = selected.length === 0
        ? placeholder
        : selected.length === 1
            ? selected[0]
            : `${selected.length} classes selected`;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <div
                onClick={() => setOpen(o => !o)}
                className="form-select"
                style={{
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', userSelect: 'none', minHeight: '42px',
                    color: selected.length === 0 ? '#9ca3af' : 'inherit'
                }}
            >
                <span>{label}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, maxHeight: '240px', overflowY: 'auto'
                }}>
                    {options.length === 0 ? (
                        <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: '13px' }}>Loading classes...</div>
                    ) : (
                        options.map(opt => {
                            const isChecked = selected.includes(opt);
                            return (
                                <label key={opt} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', cursor: 'pointer',
                                    fontSize: '14px', background: isChecked ? '#fef2f2' : 'transparent', transition: 'background 0.15s', borderBottom: '1px solid #f1f5f9'
                                }}
                                onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = isChecked ? '#fef2f2' : 'transparent'; }}>
                                    <input type="checkbox" checked={isChecked} onChange={() => toggle(opt)} style={{ accentColor: '#860108', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }} />
                                    <span style={{ color: isChecked ? '#860108' : '#374151', fontWeight: isChecked ? 600 : 400 }}>{opt}</span>
                                </label>
                            );
                        })
                    )}
                </div>
            )}
            {selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {selected.map(v => (
                        <span key={v} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#860108',
                            border: '1px solid #fecaca', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600
                        }}>
                            {v}
                            <button type="button" onClick={e => { e.stopPropagation(); toggle(v); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#860108', padding: '0', lineHeight: 1, fontSize: '14px' }}>×</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserManagementApp() {
    // Table States
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('all');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [openDropdownId, setOpenDropdownId] = React.useState(null);

    // Modal & Form States
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [personType, setPersonType] = React.useState('');
    const [firstName, setFirstName] = React.useState('');
    const [lastName, setLastName]   = React.useState('');
    const [email, setEmail]         = React.useState('');
    const [phone, setPhone]         = React.useState('');
    const [birthday, setBirthday]   = React.useState('');
    const [sex, setSex]             = React.useState('');
    const [advisoryClasses, setAdvisoryClasses]   = React.useState([]); // selected values
    const [classOptions, setClassOptions]         = React.useState([]); // available classes
    const [submitting, setSubmitting] = React.useState(false);

    // Edit Modals States
    const [editEmailModalUser, setEditEmailModalUser] = React.useState(null);
    const [newEmail, setNewEmail] = React.useState('');
    const [isSavingEmail, setIsSavingEmail] = React.useState(false);

    const [editSectionsModalUser, setEditSectionsModalUser] = React.useState(null);
    const [newSections, setNewSections] = React.useState([]);
    const [isSavingSections, setIsSavingSections] = React.useState(false);

    // Deactivate Modal States
    const [deactivateModalUser, setDeactivateModalUser] = React.useState(null);
    const [isDeactivating, setIsDeactivating] = React.useState(false);

    // Reactivate Modal States
    const [reactivateModalUser, setReactivateModalUser] = React.useState(null);
    const [isReactivating, setIsReactivating] = React.useState(false);

    // Delete Modal States
    const [deleteModalUser, setDeleteModalUser] = React.useState(null);
    const [deleteConfirmInput, setDeleteConfirmInput] = React.useState('');
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Global Popup State
    const [popupMessage, setPopupMessage] = React.useState(null);

    const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

    // Load users
    const fetchUsers = React.useCallback(async () => {
        setLoading(true);
        try {
            const client = window.supabaseClient;
            if (!client) return;
            const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial setups
    React.useEffect(() => {
        const role = (localStorage.getItem('userRole') || '').toLowerCase();
        if (role === 'guard') window.location.replace('/dashboard');
        
        fetchUsers();

        // Close dropdowns on outside click
        const handleClickOutside = (e) => {
            if (!e.target.closest('.action-menu-btn') && !e.target.closest('.action-menu-dropdown')) {
                setOpenDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [fetchUsers]);

    // Load advisory classes for teachers and admins
    React.useEffect(() => {
        if (personType !== 'teacher' && personType !== 'admin') { setAdvisoryClasses([]); return; }
        loadAdvisoryClasses().then(setClassOptions);
    }, [personType]);

    async function loadAdvisoryClasses() {
        const client = window.supabaseClient;
        if (!client) return [];
        try {
            const { data, error } = await client.from('students').select('section, grade_level');
            if (error) throw error;
            const seen = {};
            (data || []).forEach(s => { seen[`${s.grade_level} - ${s.section}`] = true; });
            return Object.keys(seen).sort();
        } catch (err) {
            return [];
        }
    }

    function resetForm() {
        setPersonType(''); setFirstName(''); setLastName(''); setEmail('');
        setPhone(''); setBirthday(''); setSex(''); setAdvisoryClasses([]);
    }

    function openInviteModal() {
        resetForm();
        setIsModalOpen(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!personType || !firstName || !lastName || !email || !birthday || !sex) return setPopupMessage({ type: 'error', text: 'Please fill in all required fields.' });
        if ((personType === 'teacher' || personType === 'admin') && advisoryClasses.length === 0) return setPopupMessage({ type: 'error', text: 'Please select at least one advisory class.' });

        setSubmitting(true);
        try {
            const advisoryStr =
                (personType === 'teacher' || personType === 'admin') && advisoryClasses.length > 0
                    ? advisoryClasses.join(', ')
                    : undefined;

            const result = await apiFetch('/api/users', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    first_name: firstName,
                    last_name: lastName,
                    role: personType,
                    phone: phone || undefined,
                    birthday: birthday || undefined,
                    sex: sex || undefined,
                    advisory_class: advisoryStr,
                }),
            });

            if (result.success === false) throw new Error(result.error || 'Failed to add person.');

            setPopupMessage({ type: 'success', text: `Successfully added ${personType}: ${firstName} ${lastName}. An invite email has been sent.` });
            setIsModalOpen(false);
            fetchUsers();
        } catch (err) {
            console.error(err);
            setPopupMessage({ type: 'error', text: err.message || 'Failed to add person.' });
        } finally {
            setSubmitting(false);
        }
    }

    async function toggleUserStatus(user) {
        const currentStatus = user.status || (user.last_login ? 'Active' : 'Pending');
        if (currentStatus === 'Deactivated') {
            // Open Reactivate Modal
            setReactivateModalUser({ ...user, currentStatus });
        } else {
            // Open Deactivate Modal
            setDeactivateModalUser({ ...user, currentStatus });
        }
    }

    async function confirmReactivateUser() {
        setIsReactivating(true);
        const client = window.supabaseClient;
        try {
            const { error } = await client.from('users').update({ status: 'Active' }).eq('id', reactivateModalUser.id);
            if (error) throw error;
            setUsers(users.map(u => u.id === reactivateModalUser.id ? { ...u, status: 'Active' } : u));
            setPopupMessage({ type: 'success', text: `User ${reactivateModalUser.full_name} has been successfully reactivated.` });
            setReactivateModalUser(null);
        } catch (err) {
            console.error('Error reactivating:', err);
            setPopupMessage({ type: 'error', text: 'Failed to reactivate user.' });
        } finally {
            setIsReactivating(false);
        }
    }

    function openDeleteModal(user) {
        setDeleteModalUser(user);
        setDeleteConfirmInput('');
    }

    async function confirmDeleteUser() {
        if (!deleteModalUser) return;
        if (deleteConfirmInput.trim() !== (deleteModalUser.full_name || '').trim()) {
            setPopupMessage({ type: 'error', text: 'Confirmation text does not match the user\'s full name.' });
            return;
        }
        setIsDeleting(true);
        try {
            const result = await apiFetch(`/api/users/${deleteModalUser.id}`, {
                method: 'DELETE',
            });
            if (result.success === false) throw new Error(result.error || 'Failed to delete user.');

            setUsers(users.filter(u => u.id !== deleteModalUser.id));
            setPopupMessage({ type: 'success', text: `User ${deleteModalUser.full_name} has been permanently deleted.` });
            setDeleteModalUser(null);
            setDeleteConfirmInput('');
        } catch (err) {
            console.error('Error deleting user:', err);
            setPopupMessage({ type: 'error', text: err.message || 'Failed to delete user.' });
        } finally {
            setIsDeleting(false);
        }
    }

    async function confirmDeactivateUser() {
        setIsDeactivating(true);
        const client = window.supabaseClient;
        try {
            const { error } = await client.from('users').update({ status: 'Deactivated' }).eq('id', deactivateModalUser.id);
            if (error) throw error;
            setUsers(users.map(u => u.id === deactivateModalUser.id ? { ...u, status: 'Deactivated' } : u));
            setPopupMessage({ type: 'success', text: `User ${deactivateModalUser.full_name} has been successfully deactivated.` });
            setDeactivateModalUser(null);
        } catch (err) {
            console.error('Error deactivating:', err);
            setPopupMessage({ type: 'error', text: 'Failed to deactivate user.' });
        } finally {
            setIsDeactivating(false);
        }
    }

    function openEditEmailModal(user) {
        setEditEmailModalUser(user);
        setNewEmail(user.email);
    }

    async function handleSaveEmail(e) {
        e.preventDefault();
        if (!newEmail) return;
        setIsSavingEmail(true);
        try {
            const result = await apiFetch(`/api/users/${editEmailModalUser.id}/email`, {
                method: 'PATCH',
                body: JSON.stringify({ email: newEmail }),
            });
            if (result.success === false) throw new Error(result.error || 'Failed to update email.');
            const updatedEmail = result.email || newEmail;
            const updatedUsername = result.username || updatedEmail.split('@')[0];
            setUsers(users.map(u => u.id === editEmailModalUser.id ? { ...u, email: updatedEmail, username: updatedUsername } : u));
            setEditEmailModalUser(null);
            setPopupMessage({ type: 'success', text: 'Email updated successfully.' });
        } catch (err) {
            setPopupMessage({ type: 'error', text: err.message || 'Failed to update email.' });
        } finally {
            setIsSavingEmail(false);
        }
    }

    function openEditSectionsModal(user) {
        setEditSectionsModalUser(user);
        const currentSections = user.advisory_class ? user.advisory_class.split(', ') : [];
        setNewSections(currentSections);
        if (classOptions.length === 0) {
            loadAdvisoryClasses().then(setClassOptions);
        }
    }

    async function handleSaveSections(e) {
        e.preventDefault();
        setIsSavingSections(true);
        const client = window.supabaseClient;
        const advisoryClassStr = newSections.length > 0 ? newSections.join(', ') : null;
        try {
            const { error } = await client.from('users').update({ advisory_class: advisoryClassStr }).eq('id', editSectionsModalUser.id);
            if (error) throw error;
            setUsers(users.map(u => u.id === editSectionsModalUser.id ? { ...u, advisory_class: advisoryClassStr } : u));
            setEditSectionsModalUser(null);
            setPopupMessage({ type: 'success', text: 'Sections updated successfully.' });
        } catch (err) {
            setPopupMessage({ type: 'error', text: 'Failed to update sections. ' + err.message });
        } finally {
            setIsSavingSections(false);
        }
    }

    // Filter Logic
    const filteredUsers = users.filter(user => {
        // Tab filtering
        if (activeTab === 'staff' && !['teacher', 'guard'].includes(user.role?.toLowerCase())) return false;
        if (activeTab === 'admin' && user.role?.toLowerCase() !== 'admin') return false;
        
        // Search filtering
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (user.full_name?.toLowerCase().includes(query) || user.email?.toLowerCase().includes(query));
        }
        return true;
    });

    const showForm = personType !== '';

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>User Directory</h2>
                    <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Manage Admins, Teachers, and Guards</p>
                </div>
                <button onClick={openInviteModal} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', background: '#8B0000', color: '#fff',
                    padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(139,0,0,0.1), 0 2px 4px -1px rgba(139,0,0,0.06)'
                }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Invite User
                </button>
            </div>

            {/* Controls Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {['all', 'staff', 'admin'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '8px 16px', border: 'none', borderRadius: '999px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                                background: activeTab === tab ? '#fee2e2' : 'transparent',
                                color: activeTab === tab ? '#991b1b' : '#6b7280',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab === 'all' ? 'All Users' : tab === 'staff' ? 'Staff (Teachers/Guards)' : 'Admins'}
                        </button>
                    ))}
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ position: 'absolute', left: '12px', top: '10px', color: '#9ca3af' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                </div>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)', overflow: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                            <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Name</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Role</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Assigned Sections</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Email</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                            <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', width: '80px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>Loading users...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>No users found.</td></tr>
                        ) : (
                            filteredUsers.map(user => {
                                // Default to 'Pending' if they have no status, or just what they have in DB
                                const status = user.status || (user.last_login ? 'Active' : 'Pending');
                                return (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {user.profile_image ? (
                                                <img src={user.profile_image} alt={user.full_name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontWeight: 'bold' }}>
                                                    {user.first_name?.[0]}{user.last_name?.[0]}
                                                </div>
                                            )}
                                            <div>
                                                <div style={{ fontWeight: '500', color: '#111827' }}>{user.full_name}</div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '500',
                                                backgroundColor: user.role === 'admin' ? '#dbeafe' : user.role === 'teacher' ? '#fef3c7' : '#e0e7ff',
                                                color: user.role === 'admin' ? '#1e40af' : user.role === 'teacher' ? '#92400e' : '#3730a3',
                                                textTransform: 'capitalize'
                                            }}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 24px', color: '#4b5563', fontSize: '13px' }}>
                                            {user.advisory_class ? user.advisory_class : <span style={{color: '#9ca3af'}}>-</span>}
                                        </td>
                                        <td style={{ padding: '16px 24px', color: '#4b5563', fontSize: '14px' }}>
                                            {user.email}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500',
                                                color: status === 'Active' ? '#166534' : status === 'Pending' || status === 'Invited' ? '#b45309' : '#991b1b'
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: status === 'Active' ? '#22c55e' : status === 'Pending' || status === 'Invited' ? '#f59e0b' : '#ef4444' }}></span>
                                                {status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'center', position: 'relative' }}>
                                            <button 
                                                className="action-menu-btn"
                                                onClick={(e) => { e.preventDefault(); setOpenDropdownId(openDropdownId === user.id ? null : user.id); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#6b7280' }}
                                            >
                                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0-6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
                                            </button>
                                            
                                            {openDropdownId === user.id && (
                                                <div className="action-menu-dropdown" style={{
                                                    position: 'absolute', right: '40px', top: '100%', zIndex: 50, width: '200px',
                                                    background: '#fff', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                                                    border: '1px solid #e5e7eb', borderLeft: '3px solid #860108', padding: '4px 0', textAlign: 'left', overflow: 'hidden'
                                                }}>
                                                    <button onClick={(e) => { e.stopPropagation(); openEditEmailModal(user); setOpenDropdownId(null); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '13px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fffbeb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                        <svg width="16" height="16" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                                        Edit Email Address
                                                    </button>
                                                    
                                                    {(user.role === 'teacher' || user.role === 'admin') && (
                                                        <button onClick={(e) => { e.stopPropagation(); openEditSectionsModal(user); setOpenDropdownId(null); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '13px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fffbeb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                            <svg width="16" height="16" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                                                            Edit Assigned Sections
                                                        </button>
                                                    )}
                                                    
                                                    <button onClick={(e) => { e.stopPropagation(); resetUserPassword(user.id); setOpenDropdownId(null); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '13px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fffbeb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                        <svg width="16" height="16" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                                                        Reset Password
                                                    </button>
                                                    
                                                    <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }}></div>
                                                    
                                                    <button onClick={(e) => { e.stopPropagation(); toggleUserStatus(user); setOpenDropdownId(null); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '13px', cursor: 'pointer', color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                        {status === 'Deactivated' ? (
                                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.1 0-2 .9-2 2v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                                        ) : (
                                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.1 0-2 .9-2 2v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg>
                                                        )}
                                                        {status === 'Deactivated' ? 'Activate User' : 'Deactivate User'}
                                                    </button>

                                                    {String(user.id) !== String(currentUserId) && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openDeleteModal(user); setOpenDropdownId(null); }}
                                                            style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '13px', cursor: 'pointer', color: '#7f1d1d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                        >
                                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                                                            Delete User
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal Overlay */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Invite User</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#9ca3af' }}>&times;</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label className="form-label">Person Type</label>
                                <select className="form-select" value={personType} onChange={e => setPersonType(e.target.value)} style={{ width: '100%' }}>
                                    <option value="">Select Person Type</option>
                                    <option value="admin">Admin</option>
                                    <option value="teacher">Teacher</option>
                                    <option value="guard">Guard</option>
                                </select>
                            </div>

                            {showForm && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="form-group"><label className="form-label">First Name</label><input type="text" className="form-input" placeholder="Enter first name" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                                        <div className="form-group"><label className="form-label">Last Name</label><input type="text" className="form-input" placeholder="Enter last name" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="Enter email address" value={email} onChange={e => setEmail(e.target.value)} /></div>
                                        <div className="form-group"><label className="form-label">Phone</label><input type="tel" className="form-input" placeholder="Enter phone number" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="form-group"><label className="form-label">Birthday</label><input type="date" className="form-input" value={birthday} onChange={e => setBirthday(e.target.value)} /></div>
                                        <div className="form-group">
                                            <label className="form-label">Sex</label>
                                            <select className="form-select" value={sex} onChange={e => setSex(e.target.value)}>
                                                <option value="">Select Sex</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                            </select>
                                        </div>
                                    </div>

                                    {personType === 'teacher' && (
                                        <div className="form-group">
                                            <label className="form-label">Advisory Class <span style={{fontSize: '11px', color: '#9ca3af', fontWeight: 'normal'}}>(select one or more)</span></label>
                                            <MultiSelectDropdown options={classOptions} selected={advisoryClasses} onChange={setAdvisoryClasses} placeholder="Select Advisory Class(es)" />
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                        <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
                                        <button type="submit" disabled={submitting} style={{ padding: '10px 16px', background: '#8B0000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                                            {submitting ? 'Adding...' : 'Add Person'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Email Modal */}
            {editEmailModalUser && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
                    <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#111827' }}>Edit Email Address</h3>
                            <button onClick={() => setEditEmailModalUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af' }}>&times;</button>
                        </div>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Updating email for <strong>{editEmailModalUser.full_name}</strong>.</p>
                        <form onSubmit={handleSaveEmail}>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label className="form-label" style={{ fontSize: '13px', color: '#374151', display: 'block', marginBottom: '6px' }}>New Email Address</label>
                                <input type="email" className="form-input" required value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setEditEmailModalUser(null)} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSavingEmail} style={{ padding: '8px 16px', background: '#8B0000', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', opacity: isSavingEmail ? 0.7 : 1 }}>
                                    {isSavingEmail ? 'Saving...' : 'Save Email'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Sections Modal */}
            {editSectionsModalUser && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
                    <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#111827' }}>Edit Assigned Sections</h3>
                            <button onClick={() => setEditSectionsModalUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af' }}>&times;</button>
                        </div>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Updating sections for <strong>{editSectionsModalUser.full_name}</strong>.</p>
                        <form onSubmit={handleSaveSections}>
                            <div className="form-group" style={{ marginBottom: '160px' }}>
                                <label className="form-label" style={{ fontSize: '13px', color: '#374151', display: 'block', marginBottom: '6px' }}>Advisory Classes <span style={{fontSize: '11px', color: '#9ca3af', fontWeight: 'normal'}}>(select one or more)</span></label>
                                <MultiSelectDropdown options={classOptions} selected={newSections} onChange={setNewSections} placeholder="Select Advisory Class(es)" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setEditSectionsModalUser(null)} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSavingSections} style={{ padding: '8px 16px', background: '#8B0000', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', opacity: isSavingSections ? 0.7 : 1 }}>
                                    {isSavingSections ? 'Saving...' : 'Save Sections'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Deactivate User Modal */}
            {deactivateModalUser && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
                    <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '450px', padding: '32px 24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 12px', color: '#111827' }}>Deactivate {deactivateModalUser.full_name}</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px', lineHeight: '1.5' }}>
                            Deactivating this user will immediately revoke their access to E-QRAS. All historical attendance logs and reports linked to this account will be preserved.
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '24px' }}>
                            {deactivateModalUser.profile_image ? (
                                <img src={deactivateModalUser.profile_image} alt={deactivateModalUser.full_name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontWeight: 'bold', fontSize: '16px' }}>
                                    {deactivateModalUser.first_name?.[0]}{deactivateModalUser.last_name?.[0]}
                                </div>
                            )}
                            <div>
                                <div style={{ fontWeight: '600', color: '#111827', fontSize: '15px' }}>{deactivateModalUser.full_name}</div>
                                <div style={{ color: '#6b7280', fontSize: '13px', textTransform: 'capitalize' }}>{deactivateModalUser.role}</div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', marginBottom: '24px' }}>
                            <svg width="20" height="20" fill="none" stroke="#991b1b" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                                <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <p style={{ color: '#991b1b', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                                This user can be reactivated at any time from the 'Deactivated' tab. Attendance records will NOT be lost. This action updates their system status to 'deactivated'.
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setDeactivateModalUser(null)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                Cancel
                            </button>
                            <button onClick={confirmDeactivateUser} disabled={isDeactivating} style={{ padding: '10px 16px', background: '#8B0000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', opacity: isDeactivating ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isDeactivating && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                                        <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                                    </svg>
                                )}
                                {isDeactivating ? 'Deactivating...' : 'Deactivate User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reactivate User Modal */}
            {reactivateModalUser && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
                    <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '450px', padding: '32px 24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 12px', color: '#111827' }}>Reactivate {reactivateModalUser.full_name}</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px', lineHeight: '1.5' }}>
                            Reactivating this user will restore their access to E-QRAS.
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '24px' }}>
                            {reactivateModalUser.profile_image ? (
                                <img src={reactivateModalUser.profile_image} alt={reactivateModalUser.full_name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontWeight: 'bold', fontSize: '16px' }}>
                                    {reactivateModalUser.first_name?.[0]}{reactivateModalUser.last_name?.[0]}
                                </div>
                            )}
                            <div>
                                <div style={{ fontWeight: '600', color: '#111827', fontSize: '15px' }}>{reactivateModalUser.full_name}</div>
                                <div style={{ color: '#6b7280', fontSize: '13px', textTransform: 'capitalize' }}>{reactivateModalUser.role}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setReactivateModalUser(null)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                Cancel
                            </button>
                            <button onClick={confirmReactivateUser} disabled={isReactivating} style={{ padding: '10px 16px', background: '#166534', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', opacity: isReactivating ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isReactivating && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                                        <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                                    </svg>
                                )}
                                {isReactivating ? 'Reactivating...' : 'Reactivate User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete User Modal */}
            {deleteModalUser && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
                    <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '32px 24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 12px', color: '#7f1d1d' }}>Delete {deleteModalUser.full_name}?</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px', lineHeight: '1.5' }}>
                            This permanently removes the user's login and profile. Attendance records and other history they're referenced in will remain, but their account cannot be recovered. Consider <strong>Deactivate</strong> instead if you might re-enable them later.
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '8px', marginBottom: '20px' }}>
                            {deleteModalUser.profile_image ? (
                                <img src={deleteModalUser.profile_image} alt={deleteModalUser.full_name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7f1d1d', fontWeight: 'bold', fontSize: '16px' }}>
                                    {deleteModalUser.first_name?.[0]}{deleteModalUser.last_name?.[0]}
                                </div>
                            )}
                            <div>
                                <div style={{ fontWeight: '600', color: '#111827', fontSize: '15px' }}>{deleteModalUser.full_name}</div>
                                <div style={{ color: '#6b7280', fontSize: '13px' }}>{deleteModalUser.email}</div>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                                Type <strong>{deleteModalUser.full_name}</strong> to confirm:
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmInput}
                                onChange={e => setDeleteConfirmInput(e.target.value)}
                                placeholder={deleteModalUser.full_name}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '14px' }}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => { setDeleteModalUser(null); setDeleteConfirmInput(''); }}
                                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteUser}
                                disabled={isDeleting || deleteConfirmInput.trim() !== (deleteModalUser.full_name || '').trim()}
                                style={{
                                    padding: '10px 16px',
                                    background: '#7f1d1d',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    opacity: (isDeleting || deleteConfirmInput.trim() !== (deleteModalUser.full_name || '').trim()) ? 0.5 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isDeleting && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                                        <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                                    </svg>
                                )}
                                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Popup Modal */}
            {popupMessage && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '32px 24px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', transform: 'translateY(0)', opacity: 1, transition: 'all 0.3s ease-out' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: popupMessage.type === 'success' ? '#dcfce7' : '#fee2e2', color: popupMessage.type === 'success' ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            {popupMessage.type === 'success' ? (
                                <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                            ) : (
                                <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                            )}
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 12px', color: '#111827' }}>
                            {popupMessage.type === 'success' ? 'Success!' : 'Error'}
                        </h3>
                        <p style={{ fontSize: '15px', color: '#4b5563', margin: '0 0 28px', lineHeight: '1.5' }}>{popupMessage.text}</p>
                        <button onClick={() => setPopupMessage(null)} style={{ padding: '12px 24px', background: popupMessage.type === 'success' ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', width: '100%', transition: 'background-color 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
