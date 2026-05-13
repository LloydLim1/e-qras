// @ts-nocheck
import React from 'react';

/* Auto-extracted from student_qrs.php */

// QRCode will be loaded when needed
let QRCodeLib = null;

function loadQRCode() {
    return new Promise((resolve) => {
        if (QRCodeLib) {
            resolve(QRCodeLib);
            return;
        }

        if (typeof window === 'undefined') {
            resolve(null);
            return;
        }

        import('qrcode').then((module) => {
            QRCodeLib = module.default;
            resolve(QRCodeLib);
        }).catch(err => {
            console.error('Failed to load qrcode:', err);
            resolve(null);
        });
    });
}

export default function StudentQrsApp() {
    React.useEffect(() => {
        // Redirect guard role away from this page
        const role = (localStorage.getItem('userRole') || '').toLowerCase();
        if (role === 'guard') {
            window.location.replace('/dashboard');
            return;
        }
        initStudentQRsPage();

        return () => {
            // Reset on unmount so navigating away and back re-initializes correctly
            studentQRsPageInitialized = false;
            disconnectBarcodeObserver();
        };
    }, []);

    return (
        <>
            <div className="barcode-management-container">
                <div className="management-header">
                    <div className="header-main">
                        <h2 className="management-title">Student QR ID Cards</h2>
                        <p className="management-subtitle">Generate, manage, and print student QR codes linked to their LRN.</p>
                    </div>
                    <div className="header-actions">
                        <button className="batch-btn" id="primaryPrintBtn" onClick={handlePrimaryPrintAction}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>
                            <span id="primaryPrintLabel">Print All</span>
                        </button>
                    </div>
                </div>

                <div className="barcode-filters-card">
                    <div className="search-box">
                        <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
                        <input type="text" id="studentSearch" placeholder="Search by name or LRN..." onKeyUp={filterStudents} />
                    </div>
                    <div className="filter-inline">
                        <select id="sectionFilter" onChange={filterStudents}>
                            <option value="all">All Sections</option>
                        </select>
                        <select id="gradeFilter" onChange={filterStudents}>
                            <option value="all">All Grades</option>
                        </select>
                    </div>
                </div>

                <div className="grid-top-actions">
                    <button type="button" className="select-all-btn" id="selectAllBtn" onClick={selectAll}>
                        <span>Select All</span>
                    </button>
                    <button type="button" className="deselect-all-btn" id="deselectAllBtn" onClick={clearSelection}>
                        <span>Deselect All</span>
                    </button>
                </div>

                <div className="student-barcode-grid" id="studentGrid">
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading students...</p>
                    </div>
                </div>
            </div>

            <div id="printContainer" className="print-only"></div>

            {/* Edit QR Validity Modal */}
            <div
                id="editValidityModal"
                style={{
                    display: 'none',
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.45)',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '16px',
                }}
            >
                <div style={{
                    background: '#fff',
                    borderRadius: '12px',
                    width: '100%',
                    maxWidth: '440px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    fontFamily: 'inherit',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '20px 24px',
                        borderBottom: '1px solid #f1f5f9',
                    }}>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                            Edit QR Validity
                        </h3>
                        <button
                            onClick={closeEditModal}
                            style={{
                                width: 30, height: 30, borderRadius: '50%',
                                border: 'none', background: '#f1f5f9',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#64748b', fontSize: '16px', lineHeight: 1,
                                flexShrink: 0,
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '24px' }}>
                        <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#64748b', lineHeight: 1.55 }}>
                            Update the expiration date for this student's QR code.
                        </p>

                        {/* Date field */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block', marginBottom: '8px',
                                fontSize: '13px', fontWeight: 600, color: '#374151',
                            }}>
                                Expiration Date
                            </label>
                            <input
                                type="date"
                                id="editExpiryDate"
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '9px 12px',
                                    border: '1.5px solid #e2e8f0',
                                    borderRadius: '7px',
                                    fontSize: '14px', color: '#1e293b',
                                    outline: 'none',
                                    background: '#fff',
                                }}
                            />
                        </div>

                        {/* Quick extend */}
                        <div>
                            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.03em' }}>
                                Quick Extend:
                            </p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {[
                                    { label: '+1 Year', days: 365 },
                                    { label: '+6 Months', days: 180 },
                                    { label: '+30 Days', days: 30 },
                                ].map(({ label, days }) => (
                                    <button
                                        key={days}
                                        type="button"
                                        onClick={() => setExpiryRelative(days)}
                                        style={{
                                            padding: '6px 14px',
                                            border: '1.5px solid #e2e8f0',
                                            borderRadius: '999px',
                                            fontSize: '12px', fontWeight: 500,
                                            background: '#fff', color: '#374151',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <input type="hidden" id="editStudentId" />
                    </div>

                    {/* Footer */}
                    <div style={{
                        display: 'flex', justifyContent: 'flex-end', gap: '10px',
                        padding: '16px 24px',
                        borderTop: '1px solid #f1f5f9',
                        background: '#f8fafc',
                    }}>
                        <button
                            type="button"
                            onClick={closeEditModal}
                            style={{
                                padding: '9px 20px', borderRadius: '7px',
                                border: '1.5px solid #e2e8f0',
                                background: '#fff', color: '#374151',
                                fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            id="saveValidityBtn"
                            type="button"
                            onClick={saveNewValidity}
                            style={{
                                padding: '9px 20px', borderRadius: '7px',
                                border: 'none',
                                background: '#8B0000', color: '#fff',
                                fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(139,0,0,0.3)',
                            }}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}


let allStudents = [];
let displayedStudents = [];
let filterDebounceTimer = null;
let barcodeObserver = null;
let studentBarcodesPageInitialized = false;
let studentQRsPageInitialized = false;
const selectedStudentIds = new Set();
let selectionPulseTimeout = null;
let wasSelectionActive = false;

async function waitForSupabaseClient(maxWaitMs = 12000) {
    const started = Date.now();

    while (!window.supabaseClient && (Date.now() - started) < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (window.supabaseClient) return window.supabaseClient;

    const remaining = Math.max(500, maxWaitMs - (Date.now() - started));
    await new Promise((resolve) => {
        const onReady = () => {
            window.removeEventListener('supabase-ready', onReady);
            clearTimeout(timeout);
            resolve();
        };
        const timeout = setTimeout(() => {
            window.removeEventListener('supabase-ready', onReady);
            resolve();
        }, remaining);
        window.addEventListener('supabase-ready', onReady, { once: true });
    });

    return window.supabaseClient || null;
}

async function initStudentQRsPage() {
    if (typeof document === 'undefined') return;
    if (studentQRsPageInitialized) return;

    if (!document.getElementById('studentGrid')) {
        setTimeout(initStudentQRsPage, 50);
        return;
    }

    studentQRsPageInitialized = true;

    // Expose functions used in inline onclick attributes
    window.openEditModal = openEditModal;
    window.printSingleBarcode = printSingleBarcode;
    window.downloadSingleBarcode = downloadSingleBarcode;

    await loadStudents();
    populateFilters();
}

async function loadStudents() {
    const client = await waitForSupabaseClient();
    const grid = document.getElementById('studentGrid');
    if (!grid) return;

    if (!client) {
        const apiFallback = await fetchStudentsViaApi();
        if (apiFallback.success) {
            allStudents = apiFallback.data.map(normalizeStudentRecord).filter(Boolean);
            renderGrid(allStudents);
            return;
        }

        console.error('Supabase client not found');
        grid.innerHTML = `<div class="error-state">Failed to load students: ${apiFallback.error || 'Supabase client is not initialized.'}</div>`;
        return;
    }

    try {
        let result = await client
            .from('students')
            .select('student_id,first_name,last_name,grade_level,section,valid_until')
            .order('last_name', { ascending: true });

        if (result.error) {
            // Fallback for column/ordering mismatches from legacy schemas.
            result = await client
                .from('students')
                .select('*');
        }

        if (result.error) {
            const apiFallback = await fetchStudentsViaApi();
            if (apiFallback.success) {
                const normalizedFromApi = apiFallback.data.map(normalizeStudentRecord).filter(Boolean);
                allStudents = normalizedFromApi;
                renderGrid(allStudents);
                return;
            }

            throw new Error(apiFallback.error || result.error.message || 'Query failed.');
        }

        const normalized = (result.data || [])
            .map(normalizeStudentRecord)
            .filter(Boolean);

        normalized.sort((a, b) => {
            const left = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase();
            const right = `${b.last_name || ''} ${b.first_name || ''}`.toLowerCase();
            return left.localeCompare(right);
        });

        allStudents = normalized;
        renderGrid(allStudents);
    } catch (err) {
        console.error('Error loading students:', err);
        grid.innerHTML = `<div class="error-state">Failed to load students: ${err.message || 'Unknown error'}</div>`;
    }
}

function normalizeStudentRecord(student) {
    if (!student || typeof student !== 'object') return null;

    const studentId = String(
        student.student_id ||
        student.id ||
        student.lrn ||
        student.student_no ||
        student.student_number ||
        ''
    ).trim();

    if (!studentId) return null;

    const firstName = String(
        student.first_name ||
        student.firstname ||
        student.firstName ||
        ''
    ).trim();

    const lastName = String(
        student.last_name ||
        student.lastname ||
        student.lastName ||
        ''
    ).trim();

    return {
        student_id: studentId,
        first_name: firstName,
        last_name: lastName,
        grade_level: student.grade_level || student.grade || student.year_level || '',
        section: student.section || student.class_section || '',
        valid_until: student.valid_until || student.expiry_date || null
    };
}

async function fetchStudentsViaApi() {
    try {
        const limit = 300;
        let page = 1;
        let collected = [];

        // Attach session token so SupabaseGuard accepts the request
        const client = window.supabaseClient;
        const session = client ? (await client.auth.getSession()).data?.session : null;
        const authHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        };

        while (page < 20) {
            const response = await fetch(`/api/students?page=${page}&limit=${limit}`, { headers: authHeaders });
            const payload = await response.json();

            if (!response.ok || !payload || payload.success === false) {
                return {
                    success: false,
                    error: payload?.error || `HTTP ${response.status}`
                };
            }

            const pageStudents = Array.isArray(payload.data) ? payload.data : [];
            collected = collected.concat(pageStudents);

            if (!payload.hasMore || pageStudents.length < limit) break;
            page += 1;
        }

        return {
            success: true,
            data: collected
        };
    } catch (error) {
        return {
            success: false,
            error: error?.message || 'API fallback failed.'
        };
    }
}

function renderGrid(students) {
    displayedStudents = students;
    const grid = document.getElementById('studentGrid');
    disconnectBarcodeObserver();
    if (students.length === 0) {
        grid.innerHTML = '<div class="empty-state">No students found.</div>';
        updateSelectionUI();
        return;
    }

    grid.innerHTML = students.map(student => buildStudentCardMarkup(student)).join('');

    // Add click event listeners to cards
    grid.querySelectorAll('.barcode-card').forEach(card => {
        card.addEventListener('click', (event) => {
            // Prevent selection if clicking on buttons
            if (event.target.closest('.edit-btn') || event.target.closest('.print-btn') || event.target.closest('.download-btn')) {
                return;
            }
            const studentId = card.getAttribute('data-student-id');
            toggleStudentSelection(studentId);
        });
    });

    setupLazyQRCodes(students);
    updateSelectionUI();
}

function buildStudentCardMarkup(student) {
    const safeExpiry = student.valid_until || '';
    const isSelected = selectedStudentIds.has(student.student_id);
    const cardClassName = isSelected ? 'barcode-card selected' : 'barcode-card';
    return `
        <div class="${cardClassName}" id="card-${student.student_id}" data-student-id="${student.student_id}">
            <div class="barcode-card-header">
                <div class="card-brand">E-QRAS</div>
            </div>

            <div class="barcode-card-body">
                <div class="barcode-display-container">
                    <div class="barcode-display" id="barcode-container-${student.student_id}" data-student-id="${student.student_id}"></div>
                </div>
                <div class="student-info-container">
                    <div class="student-name">${student.first_name} ${student.last_name}</div>
                    <div class="student-lrn">LRN: ${student.student_id}</div>
                    <div class="student-meta">${student.grade_level} - ${student.section}</div>
                    <div class="validity-status ${isExpired(student.valid_until) ? 'expired' : 'valid'}">
                        ${student.valid_until ? `Valid until: ${new Date(student.valid_until).toLocaleDateString()}` : 'No expiry set'}
                    </div>
                </div>
            </div>

            <div class="barcode-card-footer">
                <button class="edit-btn" onclick="event.stopPropagation(); openEditModal('${student.student_id}', '${safeExpiry}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="print-btn" onclick="printSingleBarcode('${student.student_id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v8H6z"></path></svg>
                    Print
                </button>
                <button class="download-btn" onclick="event.stopPropagation(); downloadSingleBarcode('${student.student_id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
            </div>
        </div>
    `;
}

function toggleStudentSelection(studentId, forcedState = null) {
    const shouldSelect = forcedState === null ? !selectedStudentIds.has(studentId) : !!forcedState;
    if (shouldSelect) {
        selectedStudentIds.add(studentId);
    } else {
        selectedStudentIds.delete(studentId);
    }
    const card = document.getElementById(`card-${studentId}`);
    if (card) {
        card.classList.toggle('selected', shouldSelect);
    }
    updateSelectionUI();
}

function selectAll() {
    displayedStudents.forEach(s => {
        selectedStudentIds.add(s.student_id);
        const card = document.getElementById(`card-${s.student_id}`);
        if (card) card.classList.add('selected');
    });
    updateSelectionUI();
}

function clearSelection() {
    selectedStudentIds.clear();
    document.querySelectorAll('.barcode-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    updateSelectionUI();
}

function updateSelectionUI() {
    const primaryPrintBtn = document.getElementById('primaryPrintBtn');
    const primaryPrintLabel = document.getElementById('primaryPrintLabel');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    if (!primaryPrintBtn || !primaryPrintLabel || !deselectAllBtn) return;

    const count = selectedStudentIds.size;
    const selectionActive = count > 0;

    if (selectionActive) {
        primaryPrintLabel.textContent = `Print Selected (${count})`;
        deselectAllBtn.classList.add('is-visible');
    } else {
        primaryPrintLabel.textContent = 'Print All';
        deselectAllBtn.classList.remove('is-visible');
    }

    if (selectionActive && !wasSelectionActive) {
        primaryPrintBtn.classList.add('pulse-attention');
        if (selectionPulseTimeout) clearTimeout(selectionPulseTimeout);
        selectionPulseTimeout = setTimeout(() => {
            primaryPrintBtn.classList.remove('pulse-attention');
        }, 1200);
    }

    wasSelectionActive = selectionActive;
}

function handlePrimaryPrintAction() {
    if (selectedStudentIds.size > 0) {
        printSelectedBarcodes();
        return;
    }
    printAllBarcodes();
}

function filterStudents() {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(applyFilters, 180);
}

function applyFilters() {
    const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
    const section = document.getElementById('sectionFilter').value;
    const grade = document.getElementById('gradeFilter').value;

    const filtered = allStudents.filter(s => {
        const matchesSearch = (s.first_name + ' ' + s.last_name).toLowerCase().includes(searchTerm) ||
            s.student_id.toLowerCase().includes(searchTerm);
        const matchesSection = section === 'all' || s.section === section;
        const matchesGrade = grade === 'all' || s.grade_level === grade;
        return matchesSearch && matchesSection && matchesGrade;
    });

    renderGrid(filtered);
}

function disconnectBarcodeObserver() {
    if (barcodeObserver) {
        barcodeObserver.disconnect();
        barcodeObserver = null;
    }
}

function setupLazyQRCodes(students) {
    const studentById = new Map(students.map(s => [s.student_id, s]));
    const containers = document.querySelectorAll('.barcode-display[data-student-id]');

    barcodeObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const container = entry.target;
            const studentId = container.getAttribute('data-student-id');
            const student = studentById.get(studentId);
            if (!student) return;
            if (!container.dataset.barcodeGenerated) {
                generateQRCode(studentId, container);
                container.dataset.barcodeGenerated = '1';
            }
            observer.unobserve(container);
        });
    }, { root: null, rootMargin: '150px 0px', threshold: 0.01 });

    containers.forEach(container => barcodeObserver.observe(container));
}

function generateQRCode(lrn, container) {
    if (!container) return Promise.resolve(null);

    return loadQRCode().then((QRCode) => {
        if (!QRCode) {
            console.warn('qrcode not available, skipping QR code generation');
            return null;
        }

        try {
            container.innerHTML = '';
            const canvas = document.createElement('canvas');
            container.appendChild(canvas);

            return QRCode.toCanvas(canvas, lrn, {
                width: 120,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
            }).then(() => canvas);
        } catch (err) {
            console.error('Error generating QR code:', err);
            return null;
        }
    });
}

function populateFilters() {
    const sections = [...new Set(allStudents.map(s => s.section))].filter(Boolean).sort();
    const grades = [...new Set(allStudents.map(s => s.grade_level))].filter(Boolean).sort();

    const secFilter = document.getElementById('sectionFilter');
    const gradeFilter = document.getElementById('gradeFilter');

    sections.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        secFilter.appendChild(opt);
    });

    grades.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        gradeFilter.appendChild(opt);
    });
}

function isExpired(validUntil) {
    if (!validUntil) return false;
    const expiryDate = new Date(validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > expiryDate;
}

function openEditModal(studentId, currentExpiry) {
    document.getElementById('editStudentId').value = studentId;
    document.getElementById('editExpiryDate').value = currentExpiry || '';
    const modal = document.getElementById('editValidityModal');
    modal.style.display = 'flex';

    setTimeout(() => document.getElementById('editExpiryDate').focus(), 100);
}

function setExpiryRelative(days) {
    const input = document.getElementById('editExpiryDate');
    const baseDate = input.value ? new Date(input.value) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    input.value = baseDate.toISOString().split('T')[0];
}

function closeEditModal() {
    document.getElementById('editValidityModal').style.display = 'none';
}

async function saveNewValidity() {
    const client = window.supabaseClient;
    const studentId = document.getElementById('editStudentId').value;
    const newDate = document.getElementById('editExpiryDate').value;

    if (!newDate) return alert('Please select a date');

    const btn = document.getElementById('saveValidityBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const { error } = await client
            .from('students')
            .update({ valid_until: newDate })
            .eq('student_id', studentId);

        if (error) throw error;

        const studentIndex = allStudents.findIndex(s => s.student_id === studentId);
        if (studentIndex !== -1) {
            allStudents[studentIndex].valid_until = newDate;
        }

        filterStudents();
        closeEditModal();
        alert('Validity updated successfully!');
    } catch (err) {
        console.error('Error updating validity:', err);
        alert('Failed to update validity: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

function printSingleBarcode(studentId) {
    const liveCanvas = document.querySelector(`#card-${studentId} .barcode-display canvas`);
    if (liveCanvas) {
        triggerQRPrint([{ canvas: liveCanvas, student: allStudents.find(s => s.student_id === studentId) }]);
    } else {
        // QR not rendered yet — generate off-screen then print
        const offscreen = document.createElement('div');
        offscreen.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
        document.body.appendChild(offscreen);
        generateQRCode(studentId, offscreen).then((canvas) => {
            if (canvas) {
                triggerQRPrint([{ canvas, student: allStudents.find(s => s.student_id === studentId) }]);
            }
            document.body.removeChild(offscreen);
        });
    }
}

function printAllBarcodes() {
    collectAndPrint(allStudents);
}

async function downloadSingleBarcode(studentId) {
    const student = allStudents.find(s => s.student_id === studentId);
    if (!student) return;

    const QRCode = await loadQRCode();
    if (!QRCode) { alert('QR code library failed to load. Please refresh and try again.'); return; }

    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, student.student_id, {
        width: 400,
        margin: 2,
        color: { dark: '#860108', light: '#ffffff' },
    });

    const link = document.createElement('a');
    link.download = `QR_${student.last_name}_${student.first_name}_${student.student_id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function printSelectedBarcodes() {
    if (selectedStudentIds.size === 0) {
        alert('Please select at least one student card to print.');
        return;
    }
    const selected = allStudents.filter(s => selectedStudentIds.has(s.student_id));
    if (!selected.length) {
        alert('Selected cards are no longer available.');
        return;
    }
    collectAndPrint(selected);
}

function collectAndPrint(students) {
    const items = [];
    const pending = [];

    students.forEach(student => {
        const liveCanvas = document.querySelector(`#card-${student.student_id} .barcode-display canvas`);
        if (liveCanvas) {
            items.push({ canvas: liveCanvas, student });
        } else {
            pending.push(student);
        }
    });

    if (pending.length === 0) {
        triggerQRPrint(items);
        return;
    }

    // Generate off-screen QRs for cards not yet in view
    const offscreen = document.createElement('div');
    offscreen.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    document.body.appendChild(offscreen);

    const pendingPromises = pending.map(student => {
        const wrap = document.createElement('div');
        wrap.dataset.studentId = student.student_id;
        offscreen.appendChild(wrap);
        return generateQRCode(student.student_id, wrap).then((canvas) => {
            if (canvas) items.push({ canvas, student });
        });
    });

    Promise.all(pendingPromises).then(() => {
        triggerQRPrint(items);
        document.body.removeChild(offscreen);
    });
}

async function triggerQRPrint(items) {
    const QRCode = await loadQRCode();
    if (!QRCode) {
        alert('QR code library failed to load. Please refresh and try again.');
        return;
    }

    const printItems = await Promise.all(items.map(async ({ student }) => {
        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, student.student_id, {
            width: 200,
            margin: 2,
            color: { dark: '#860108', light: '#ffffff' },
        });
        return { dataUrl: canvas.toDataURL('image/png'), student };
    }));

    const cardHTML = printItems.map(({ dataUrl, student }) => {
        const name = `${student.first_name || ''} ${student.last_name || ''}`.trim().toUpperCase();
        const meta = [student.grade_level, student.section].filter(Boolean).join(' - ');
        const expired = isExpired(student.valid_until);
        const validityText = student.valid_until
            ? `Valid until: ${new Date(student.valid_until).toLocaleDateString()}`
            : 'No expiry set';
        const badgeColor = expired ? '#dc2626' : '#16a34a';

        return `<div class="qr-card">
  <div class="brand">E-QRAS</div>
  <img src="${dataUrl}" />
  <div class="s-name">${name}</div>
  <div class="s-lrn">LRN: ${student.student_id}</div>
  ${meta ? `<div class="s-meta">${meta}</div>` : ''}
  <div class="s-badge" style="border-color:${badgeColor};color:${badgeColor};">${validityText}</div>
</div>`;
    }).join('');

    // Use hidden iframe — avoids popup blocker issues entirely
    const old = document.getElementById('__print_iframe__');
    if (old) old.remove();

    const iframe = document.createElement('iframe');
    iframe.id = '__print_iframe__';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Student QR Cards</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 8mm; }
  body { font-family: Arial, sans-serif; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; padding: 3mm; }
  .qr-card { border: 2px solid #860108; border-radius: 8px; padding: 10px 8px 8px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; page-break-inside: avoid; break-inside: avoid; background: #fff; }
  .brand { font-size: 13pt; font-weight: 800; color: #860108; letter-spacing: 0.06em; }
  img { width: 36mm; height: 36mm; display: block; margin: 2px 0; }
  .s-name { font-size: 10.5pt; font-weight: 800; color: #111; line-height: 1.2; }
  .s-lrn { font-size: 8.5pt; font-weight: 700; color: #860108; }
  .s-meta { font-size: 7.5pt; color: #555; }
  .s-badge { font-size: 7.5pt; font-weight: 600; border: 1.5px solid; border-radius: 20px; padding: 2px 10px; margin-top: 3px; }
</style>
</head>
<body>
<div class="grid">${cardHTML}</div>
</body>
</html>`);
    doc.close();

    iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 1000);
    };
}



