// @ts-nocheck
import React from 'react';
import { createClient } from '@/utils/supabase/client';

/* Auto-extracted from settings.php */

export default function SettingsApp() {
    React.useEffect(() => {
        initSettingsPage();
    }, []);

    return (
        <div className="settings-container" id="settingsContent">
            <input
                type="file"
                id="avatarInput"
                accept="image/*"
                style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: 0
                }}
            />

            <div className="settings-header">
                <div className="profile-picture-section">
                    <div className="profile-picture-wrapper">
                        <svg className="profile-picture" width="100" height="100" viewBox="0 0 100 100" fill="none" id="settingsAvatar">
                            <circle cx="50" cy="50" r="50" fill="#E5E7EB"/>
                            <path d="M50 50C58.2843 50 65 43.2843 65 35C65 26.7157 58.2843 20 50 20C41.7157 20 35 26.7157 35 35C35 43.2843 41.7157 50 50 50Z" fill="#9CA3AF"/>
                            <path d="M50 55C33.4314 55 20 61.4934 20 70V80H80V70C80 61.4934 66.5686 55 50 55Z" fill="#9CA3AF"/>
                        </svg>
                        <label
                            htmlFor="avatarInput"
                            className="camera-button"
                            id="changePictureBtn"
                            style={{ zIndex: 20 }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                            </svg>
                        </label>
                    </div>
                </div>
                <div className="profile-header-info">
                    <h2 className="profile-name" id="settingsUserName">--------</h2>
                    <p className="profile-role" id="settingsUserRole">--------</p>
                </div>
            </div>

            <div className="settings-grid">
                <div className="settings-card">
                    <div className="settings-card-header">
                        <h3 className="settings-card-title">Personal Profile</h3>
                        <button type="button" className="edit-btn" id="editPersonalBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                                <path d="m15 5 4 4"></path>
                            </svg>
                            Edit
                        </button>
                    </div>
                    <form className="settings-form" id="personalProfileForm">
                        <div className="form-group">
                            <label htmlFor="firstName" className="form-label">First Name</label>
                            <input type="text" id="firstName" className="form-input" placeholder="Enter first name" disabled />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName" className="form-label">Last Name</label>
                            <input type="text" id="lastName" className="form-input" placeholder="Enter last name" disabled />
                        </div>
                        <div className="form-group">
                            <label htmlFor="phoneNumber" className="form-label">Phone Number</label>
                            <input type="tel" id="phoneNumber" className="form-input" placeholder="Enter phone number" disabled />
                        </div>
                        <div className="form-group">
                            <label htmlFor="address" className="form-label">Address</label>
                            <textarea id="address" className="form-input form-textarea" rows="3" placeholder="Enter address" disabled></textarea>
                        </div>
                        <button type="button" className="save-btn" id="savePersonalBtn" style={{ display: 'none' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Save Changes
                        </button>
                    </form>
                </div>

                <div className="settings-card">
                    <h3 className="settings-card-title">Account Profile</h3>
                    <form className="settings-form" id="accountProfileForm">
                        <div className="form-group">
                            <label htmlFor="email" className="form-label">Email</label>
                            <input type="email" id="email" className="form-input" placeholder="Enter email address" />
                        </div>

                        <div className="password-section">
                            <h4 className="password-section-title">Change Password</h4>
                            <div className="form-group">
                                <label htmlFor="currentPassword" className="form-label">Current Password</label>
                                <div className="password-input-wrapper">
                                    <input type="password" id="currentPassword" className="form-input" placeholder="Enter current password" />
                                    <button type="button" className="password-toggle" data-target="currentPassword">
                                        <svg className="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                                <div className="password-input-wrapper">
                                    <input type="password" id="confirmPassword" className="form-input" placeholder="Confirm new password" />
                                    <button type="button" className="password-toggle" data-target="confirmPassword">
                                        <svg className="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <button type="button" className="update-password-btn" id="updatePasswordBtn">
                                Update Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="settingsSuccessToast" className="settings-success-toast" role="status" aria-live="polite">
                <span id="settingsSuccessToastText">Profile successfully updated</span>
            </div>

            <div className="crop-modal-overlay" id="avatarCropModal" style={{ display: 'none' }}>
                <div className="crop-modal-card">
                    <div className="crop-modal-header">
                        <h3 className="crop-modal-title">Crop Profile Picture</h3>
                    </div>
                    <div className="crop-modal-body">
                        <div className="crop-preview-frame" id="cropPreviewFrame">
                            <img id="cropPreviewImage" alt="Crop preview" />
                        </div>
                        <div className="crop-zoom-group">
                            <label htmlFor="cropZoomRange">Zoom</label>
                            <input type="range" id="cropZoomRange" min="1" max="3" step="0.01" defaultValue="1" />
                        </div>
                    </div>
                    <div className="crop-modal-footer">
                        <button type="button" id="cancelCropBtn" className="crop-cancel-btn">Cancel</button>
                        <button type="button" id="saveCropBtn" className="crop-save-btn">Save Photo</button>
                    </div>
                </div>
            </div>
        </div>
    );
}


async function initSettingsPage() {
    if (typeof document === 'undefined') return;

    const requiredIds = ['avatarInput', 'changePictureBtn', 'avatarCropModal', 'cropPreviewFrame', 'cropPreviewImage', 'cropZoomRange'];
    const missing = requiredIds.some((id) => !document.getElementById(id));
    if (missing) {
        setTimeout(initSettingsPage, 50);
        return;
    }

    const supabase = createClient();

    if (!supabase) {
        console.error('Supabase client not found');
        return;
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
        console.log('No user logged in, redirecting...');
        window.location.href = '/login';
        return;
    }

    const els = {
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        phone: document.getElementById('phoneNumber'),
        address: document.getElementById('address'),
        email: document.getElementById('email'),
        userName: document.getElementById('settingsUserName'),
        userRole: document.getElementById('settingsUserRole'),
        avatar: document.getElementById('settingsAvatar'),
        avatarWrapper: document.querySelector('.profile-picture-wrapper'),
        avatarInput: document.getElementById('avatarInput'),
        changePicBtn: document.getElementById('changePictureBtn'),
        avatarCropModal: document.getElementById('avatarCropModal'),
        cropPreviewFrame: document.getElementById('cropPreviewFrame'),
        cropPreviewImage: document.getElementById('cropPreviewImage'),
        cropZoomRange: document.getElementById('cropZoomRange'),
        cancelCropBtn: document.getElementById('cancelCropBtn'),
        saveCropBtn: document.getElementById('saveCropBtn'),
        editBtn: document.getElementById('editPersonalBtn'),
        saveBtn: document.getElementById('savePersonalBtn'),
        currentPass: document.getElementById('currentPassword'),
        confirmPass: document.getElementById('confirmPassword'),
        updatePassBtn: document.getElementById('updatePasswordBtn'),
        passwordToggles: document.querySelectorAll('.password-toggle')
    };

    const setLoading = (btn, isLoading, text) => {
        if (isLoading) {
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = text || 'Saving...';
            btn.disabled = true;
        } else {
            btn.innerHTML = btn.dataset.originalText;
            btn.disabled = false;
        }
    };

    if (!window.__settingsCameraFallbackBound) {
        window.__settingsCameraFallbackBound = true;
        document.addEventListener('click', (event) => {
            const trigger = event.target && event.target.closest ? event.target.closest('#changePictureBtn') : null;
            if (!trigger) return;
            event.preventDefault();
            event.stopPropagation();
            const input = document.getElementById('avatarInput');
            if (input) input.click();
        }, true);
    }

    const CROP_SIZE = 300;
    let cropImage = null;
    let cropObjectUrl = null;
    let cropBaseScale = 1;
    let cropZoom = 1;
    let cropOffsetX = 0;
    let cropOffsetY = 0;
    let cropDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOriginX = 0;
    let dragOriginY = 0;
    let toastTimer = null;

    function showSuccessToast(message) {
        const toast = document.getElementById('settingsSuccessToast');
        const text = document.getElementById('settingsSuccessToastText');
        if (!toast || !text) return;

        text.textContent = message || 'Profile successfully updated';
        toast.classList.add('show');

        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2600);
    }

    function clampCropOffsets() {
        if (!cropImage) return;
        const scaledWidth = cropImage.naturalWidth * cropBaseScale * cropZoom;
        const scaledHeight = cropImage.naturalHeight * cropBaseScale * cropZoom;
        const minX = Math.min(0, CROP_SIZE - scaledWidth);
        const minY = Math.min(0, CROP_SIZE - scaledHeight);
        const maxX = 0;
        const maxY = 0;
        cropOffsetX = Math.min(maxX, Math.max(minX, cropOffsetX));
        cropOffsetY = Math.min(maxY, Math.max(minY, cropOffsetY));
    }

    function renderCropPreview() {
        if (!cropImage || !els.cropPreviewImage) return;
        const scale = cropBaseScale * cropZoom;
        els.cropPreviewImage.style.width = `${cropImage.naturalWidth}px`;
        els.cropPreviewImage.style.height = `${cropImage.naturalHeight}px`;
        els.cropPreviewImage.style.transform = `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${scale})`;
    }

    function closeCropModal() {
        if (els.avatarCropModal) {
            els.avatarCropModal.style.display = 'none';
        }
        if (els.cropPreviewImage) {
            els.cropPreviewImage.src = '';
        }
        if (cropObjectUrl) {
            URL.revokeObjectURL(cropObjectUrl);
            cropObjectUrl = null;
        }
        cropImage = null;
        cropDragging = false;
        if (els.avatarInput) els.avatarInput.value = '';
    }

    function openCropModal(file) {
        if (!file || !els.cropPreviewImage || !els.avatarCropModal) return;

        cropObjectUrl = URL.createObjectURL(file);
        cropImage = new Image();
        cropImage.onload = () => {
            const fitScale = Math.max(CROP_SIZE / cropImage.naturalWidth, CROP_SIZE / cropImage.naturalHeight);
            cropBaseScale = fitScale;
            cropZoom = 1;
            cropOffsetX = (CROP_SIZE - (cropImage.naturalWidth * fitScale)) / 2;
            cropOffsetY = (CROP_SIZE - (cropImage.naturalHeight * fitScale)) / 2;
            if (els.cropZoomRange) els.cropZoomRange.value = '1';
            clampCropOffsets();
            renderCropPreview();
            els.avatarCropModal.style.display = 'flex';
        };
        cropImage.src = cropObjectUrl;
        els.cropPreviewImage.src = cropObjectUrl;
    }

    let publicUserId = null;

    async function loadProfile() {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('auth_id', authUser.id)
                .single();

            if (error) throw error;
            if (user) {
                publicUserId = user.id;
                const first = user.first_name || '';
                const last = user.last_name || '';
                const fullName = user.full_name || `${first} ${last}`.trim();

                if (els.firstName) els.firstName.value = first;
                if (els.lastName) els.lastName.value = last;
                if (els.phone) els.phone.value = user.phone || user.phone_number || '';
                if (els.address) els.address.value = user.address || '';
                if (els.email) els.email.value = user.email || '';
                if (els.userName) els.userName.textContent = fullName || 'User';
                if (els.userRole) {
                    const role = user.role || 'Member';
                    els.userRole.textContent = role.charAt(0).toUpperCase() + role.slice(1) + ' Account';
                }

                localStorage.setItem('userId', String(user.id));
                localStorage.setItem('userName', fullName || 'User');
                localStorage.setItem('userRole', (user.role || 'Member'));

                if (user.profile_image) {
                    const img = document.createElement('img');
                    img.src = user.profile_image;
                    img.className = 'profile-picture';
                    img.id = 'settingsAvatar';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '50%';
                    img.width = 100;
                    img.height = 100;

                    if (els.avatar) {
                        els.avatar.replaceWith(img);
                        els.avatar = img;
                    }

                    localStorage.setItem('userProfileImage', user.profile_image);
                } else {
                    localStorage.removeItem('userProfileImage');
                }

                window.dispatchEvent(new CustomEvent('user-profile-updated'));
            }
        } catch (err) {
            console.error('Error loading profile:', err);
        }
    }

    await loadProfile();

    if (els.editBtn) {
        els.editBtn.addEventListener('click', () => {
            const isDisabled = els.firstName.disabled;
            const fields = [els.firstName, els.lastName, els.phone, els.address];
            fields.forEach(f => f.disabled = !isDisabled);

            els.saveBtn.style.display = isDisabled ? 'inline-flex' : 'none';
            els.editBtn.innerHTML = isDisabled ?
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancel' :
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg> Edit';
        });
    }

    if (els.saveBtn) {
        els.saveBtn.addEventListener('click', async () => {
            const first = els.firstName.value.trim();
            const last = els.lastName.value.trim();
            const full_name = (first + ' ' + last).trim();

            setLoading(els.saveBtn, true);

            const updates = {
                full_name: full_name,
                first_name: first,
                last_name: last,
                phone: els.phone.value.trim(),
                address: els.address.value.trim()
            };

            try {
                if (!publicUserId) throw new Error('User profile not loaded');
                const { error } = await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', publicUserId);

                if (error) throw error;

                showSuccessToast('Profile successfully updated');

                [els.firstName, els.lastName, els.phone, els.address].forEach(f => f.disabled = true);
                els.saveBtn.style.display = 'none';
                els.editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg> Edit';

                els.userName.textContent = full_name;
                localStorage.setItem('userName', full_name);
                window.dispatchEvent(new CustomEvent('user-profile-updated'));

            } catch (err) {
                console.error('Update error:', err);
                alert('Failed to update profile: ' + err.message);
            } finally {
                setLoading(els.saveBtn, false);
            }
        });
    }

    if (els.changePicBtn && els.avatarInput) {
        els.changePicBtn.addEventListener('click', () => els.avatarInput.click());

        els.avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 2 * 1024 * 1024) {
                alert('File is too large. Max size is 2MB.');
                return;
            }

            openCropModal(file);
        });
    }

    if (els.cropZoomRange) {
        els.cropZoomRange.addEventListener('input', () => {
            cropZoom = parseFloat(els.cropZoomRange.value || '1');
            clampCropOffsets();
            renderCropPreview();
        });
    }

    if (els.cropPreviewFrame) {
        const onPointerMove = (clientX, clientY) => {
            if (!cropDragging) return;
            cropOffsetX = dragOriginX + (clientX - dragStartX);
            cropOffsetY = dragOriginY + (clientY - dragStartY);
            clampCropOffsets();
            renderCropPreview();
        };

        els.cropPreviewFrame.addEventListener('mousedown', (e) => {
            e.preventDefault();
            cropDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragOriginX = cropOffsetX;
            dragOriginY = cropOffsetY;
        });

        window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => { cropDragging = false; });

        els.cropPreviewFrame.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            cropDragging = true;
            dragStartX = e.touches[0].clientX;
            dragStartY = e.touches[0].clientY;
            dragOriginX = cropOffsetX;
            dragOriginY = cropOffsetY;
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        window.addEventListener('touchend', () => { cropDragging = false; });
    }

    if (els.cancelCropBtn) {
        els.cancelCropBtn.addEventListener('click', () => closeCropModal());
    }

    if (els.avatarCropModal) {
        els.avatarCropModal.addEventListener('click', (e) => {
            if (e.target === els.avatarCropModal) closeCropModal();
        });
    }

    if (els.saveCropBtn) {
        els.saveCropBtn.addEventListener('click', async () => {
            if (!cropImage) return;

            setLoading(els.saveCropBtn, true, 'Saving...');

            try {
                const scale = cropBaseScale * cropZoom;
                const srcX = Math.max(0, (-cropOffsetX) / scale);
                const srcY = Math.max(0, (-cropOffsetY) / scale);
                const srcW = Math.min(cropImage.naturalWidth - srcX, CROP_SIZE / scale);
                const srcH = Math.min(cropImage.naturalHeight - srcY, CROP_SIZE / scale);

                const canvas = document.createElement('canvas');
                canvas.width = CROP_SIZE;
                canvas.height = CROP_SIZE;
                const context = canvas.getContext('2d');
                context.drawImage(cropImage, srcX, srcY, srcW, srcH, 0, 0, CROP_SIZE, CROP_SIZE);
                const base64Data = canvas.toDataURL('image/jpeg', 0.92);

                if (!publicUserId) throw new Error('User profile not loaded');
                const { error } = await supabase
                    .from('users')
                    .update({ profile_image: base64Data })
                    .eq('id', publicUserId);

                if (error) throw error;

                const img = document.createElement('img');
                img.src = base64Data;
                img.className = 'profile-picture';
                img.id = 'settingsAvatar';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '50%';
                img.width = 100;
                img.height = 100;

                if (els.avatar) {
                    els.avatar.replaceWith(img);
                    els.avatar = img;
                }

                localStorage.setItem('userProfileImage', base64Data);
                window.dispatchEvent(new CustomEvent('user-profile-updated'));

                closeCropModal();
                showSuccessToast('Profile successfully updated');
            } catch (err) {
                console.error('Image crop/upload error:', err);
                alert('Failed to update profile picture: ' + (err.message || JSON.stringify(err)));
            } finally {
                setLoading(els.saveCropBtn, false);
            }
        });
    }

    if (els.updatePassBtn) {
        els.updatePassBtn.addEventListener('click', async () => {
            const current = els.currentPass.value;
            const newPass = els.confirmPass.value;

            if (!current || !newPass) {
                alert('Please enter both current and new passwords.');
                return;
            }

            setLoading(els.updatePassBtn, true, 'Updating...');

            try {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: authUser.email,
                    password: current,
                });

                if (signInError) {
                    alert('Current password is incorrect.');
                    setLoading(els.updatePassBtn, false);
                    return;
                }

                const { error: updateError } = await supabase.auth.updateUser({
                    password: newPass,
                });

                if (updateError) throw updateError;

                showSuccessToast('Password successfully updated');
                els.currentPass.value = '';
                els.confirmPass.value = '';

            } catch (err) {
                console.error('Password update error:', err);
                alert('Failed to update password: ' + err.message);
            } finally {
                setLoading(els.updatePassBtn, false);
            }
        });
    }

    els.passwordToggles.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
            }
        });
    });
}


