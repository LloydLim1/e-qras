// @ts-nocheck
import React from 'react';

/* Auto-extracted from attendance.php — enhanced with clickable section drill-down */

export default function AttendanceApp() {
    // ─── Summary view state ───────────────────────────────────────────────────
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [students, setStudents] = React.useState([]);
    const [teacherMap, setTeacherMap] = React.useState({});
    const [gradeFilter, setGradeFilter] = React.useState('all');
    const [sectionFilter, setSectionFilter] = React.useState('all');
    const [currentPage, setCurrentPage] = React.useState(1);
    const pageSize = 10;
    const [attendanceDate, setAttendanceDate] = React.useState(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
    );
    // null = no filter (admin/guard); string[] = teacher's advisory sections
    const [teacherAdvisoryClasses, setTeacherAdvisoryClasses] = React.useState(null);
    const isTeacher = (localStorage.getItem('userRole') || '').toLowerCase() === 'teacher';
    // Dates that actually have attendance records
    const [datesWithRecords, setDatesWithRecords] = React.useState([]);

    // ─── Section detail view state ────────────────────────────────────────────
    const [selectedSection, setSelectedSection] = React.useState(null); // { grade, section, adviser }
    const [detailStudents, setDetailStudents] = React.useState([]);
    const [detailLoading, setDetailLoading] = React.useState(false);
    const [detailError, setDetailError] = React.useState('');
    const [detailPage, setDetailPage] = React.useState(1);
    const detailPageSize = 10;

    // ─── Supabase helpers ─────────────────────────────────────────────────────
    const waitForSupabase = async () => {
        let client = window.supabaseClient;
        let attempts = 0;
        while (!client && attempts < 20) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            client = window.supabaseClient;
            attempts += 1;
        }
        return client;
    };

    const fetchStudentsBatched = async (client) => {
        const allRows = [];
        const batchSize = 1000;
        let from = 0;
        while (true) {
            const { data, error: fetchError } = await client
                .from('students')
                .select('student_id, grade_level, section')
                .order('grade_level', { ascending: true })
                .order('section', { ascending: true })
                .range(from, from + batchSize - 1);
            if (fetchError) throw fetchError;
            if (!data || data.length === 0) break;
            allRows.push(...data);
            if (data.length < batchSize) break;
            from += batchSize;
        }
        return allRows;
    };

    // ─── Load summary data on mount ───────────────────────────────────────────
    React.useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            setLoading(true);
            setError('');
            try {
                const client = await waitForSupabase();
                if (!client) throw new Error('Supabase client is not ready.');

                const [studentRows, teacherRowsResponse, attendanceDatesRes] = await Promise.all([
                    fetchStudentsBatched(client),
                    client.from('users').select('full_name, advisory_class').eq('role', 'teacher'),
                    client.from('attendance').select('scan_date').order('scan_date', { ascending: false })
                ]);

                // Build sorted unique dates that have records
                const rawDates = attendanceDatesRes.data || [];
                const uniqueDates = Array.from(new Set(rawDates.map(r => r.scan_date).filter(Boolean)))
                    .sort((a, b) => b.localeCompare(a)); // newest first
                if (mounted) setDatesWithRecords(uniqueDates);
                // Auto-select most recent date if today has no records
                if (mounted && uniqueDates.length > 0) {
                    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
                    if (!uniqueDates.includes(today)) setAttendanceDate(uniqueDates[0]);
                }

                const teacherRows = teacherRowsResponse.data || [];
                const map = {};
                teacherRows.forEach((row) => {
                    if (!row?.advisory_class || !row?.full_name) return;
                    // advisory_class may be a comma-separated list of classes
                    const classes = String(row.advisory_class).split(',');
                    classes.forEach((cls) => {
                        const key = cls.trim().toLowerCase().replace(/\s+/g, ' ');
                        if (key) map[key] = row.full_name;
                    });
                });

                // ── Teacher section filter ────────────────────────────────
                const userId = localStorage.getItem('userId') || '';
                if (isTeacher && userId) {
                    let advisoryStr = localStorage.getItem('advisoryClass') || '';
                    if (!advisoryStr) {
                        // Fallback: fetch from DB for sessions predating this feature
                        const { data: userData } = await client
                            .from('users')
                            .select('advisory_class')
                            .eq('id', userId)
                            .maybeSingle();
                        advisoryStr = userData?.advisory_class || '';
                        if (advisoryStr) localStorage.setItem('advisoryClass', advisoryStr);
                    }
                    if (advisoryStr && mounted) {
                        const classes = advisoryStr.split(',').map(c => c.trim()).filter(Boolean);
                        setTeacherAdvisoryClasses(classes);
                    }
                }

                if (!mounted) return;
                setStudents(studentRows || []);
                setTeacherMap(map);
            } catch (loadError) {
                if (!mounted) return;
                const message = loadError instanceof Error ? loadError.message : 'Failed to load attendance data.';
                setError(message);
                setStudents([]);
                setTeacherMap({});
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, []);

    // ─── Load section detail when a row is clicked ────────────────────────────
    const openSectionDetail = async (row) => {
        setSelectedSection(row);
        setDetailPage(1);
        setDetailLoading(true);
        setDetailError('');
        setDetailStudents([]);

        try {
            const client = await waitForSupabase();
            if (!client) throw new Error('Supabase client is not ready.');

            // Fetch all students in this section
            const { data: sectionStudents, error: studErr } = await client
                .from('students')
                .select('student_id, first_name, last_name, gender')
                .eq('grade_level', row.grade)
                .eq('section', row.section)
                .order('last_name', { ascending: true });

            if (studErr) throw studErr;

            const studentIds = (sectionStudents || []).map((s) => s.student_id);

            // Fetch attendance for those students on the selected date
            let attendanceMap = {};
            if (studentIds.length > 0) {
                const { data: attRows, error: attErr } = await client
                    .from('attendance')
                    .select('student_id, status, time_in')
                    .eq('scan_date', attendanceDate)
                    .in('student_id', studentIds);

                if (!attErr && attRows) {
                    attRows.forEach((a) => {
                        attendanceMap[a.student_id] = { status: a.status, time_in: a.time_in };
                    });
                }
            }

            // Merge students with their attendance status
            const merged = (sectionStudents || []).map((s) => ({
                ...s,
                status: attendanceMap[s.student_id]?.status || 'Absent',
                time_in: attendanceMap[s.student_id]?.time_in || '—'
            }));

            setDetailStudents(merged);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load section details.';
            setDetailError(message);
        } finally {
            setDetailLoading(false);
        }
    };

    const backToSummary = () => {
        setSelectedSection(null);
        setDetailStudents([]);
        setDetailError('');
    };

    // ─── Summary computed values ──────────────────────────────────────────────
    const gradeOptions = React.useMemo(() => {
        return Array.from(
            new Set(students.map((s) => s.grade_level).filter(Boolean).map((v) => String(v).trim()))
        ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [students]);

    const sectionOptions = React.useMemo(() => {
        const filtered = students.filter((s) => {
            if (gradeFilter === 'all') return true;
            return String(s.grade_level) === gradeFilter;
        });
        return Array.from(
            new Set(filtered.map((s) => s.section).filter(Boolean).map((v) => String(v).trim()))
        ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [students, gradeFilter]);

    const summaryRows = React.useMemo(() => {
        const grouped = {};
        students.forEach((student) => {
            const grade = String(student.grade_level || '').trim();
            const section = String(student.section || '').trim();
            if (!grade || !section) return;

            // ── Teacher: only show their advisory sections ──────────────────
            if (teacherAdvisoryClasses !== null) {
                const sectionKey = `${grade} - ${section}`.toLowerCase().replace(/\s+/g, ' ');
                const isAdvisory = teacherAdvisoryClasses.some(
                    (c) => c.toLowerCase().replace(/\s+/g, ' ') === sectionKey
                );
                if (!isAdvisory) return;
            } else {
                // Admin/guard: apply grade/section filter controls
                if (gradeFilter !== 'all' && grade !== gradeFilter) return;
                if (sectionFilter !== 'all' && section !== sectionFilter) return;
            }

            const key = `${grade}|${section}`;
            if (!grouped[key]) {
                const advisoryKey = `${grade} - ${section}`.toLowerCase().replace(/\s+/g, ' ');
                grouped[key] = { grade, section, adviser: teacherMap[advisoryKey] || '-', studentCount: 0 };
            }
            grouped[key].studentCount += 1;
        });
        return Object.values(grouped).sort((a, b) => {
            const gradeCompare = a.grade.localeCompare(b.grade, undefined, { numeric: true });
            if (gradeCompare !== 0) return gradeCompare;
            return a.section.localeCompare(b.section, undefined, { numeric: true });
        });
    }, [students, gradeFilter, sectionFilter, teacherMap, teacherAdvisoryClasses]);

    React.useEffect(() => { setCurrentPage(1); }, [gradeFilter, sectionFilter]);

    const totalPages = Math.max(1, Math.ceil(summaryRows.length / pageSize));
    const pagedRows = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return summaryRows.slice(start, start + pageSize);
    }, [summaryRows, currentPage]);

    // ─── Detail computed values ───────────────────────────────────────────────
    const detailStats = React.useMemo(() => {
        const total = detailStudents.length;
        const present = detailStudents.filter((s) => s.status === 'Present');
        const absent = detailStudents.filter((s) => s.status === 'Absent');
        const late = detailStudents.filter((s) => s.status === 'Late');
        const male = (arr) => arr.filter((s) => String(s.gender || '').toLowerCase() === 'male').length;
        const female = (arr) => arr.filter((s) => String(s.gender || '').toLowerCase() === 'female').length;
        return {
            total, totalMale: male(detailStudents), totalFemale: female(detailStudents),
            present: present.length, presentMale: male(present), presentFemale: female(present),
            absent: absent.length, absentMale: male(absent), absentFemale: female(absent),
            late: late.length, lateMale: male(late), lateFemale: female(late)
        };
    }, [detailStudents]);

    const detailTotalPages = Math.max(1, Math.ceil(detailStudents.length / detailPageSize));
    const pagedDetailStudents = React.useMemo(() => {
        const start = (detailPage - 1) * detailPageSize;
        return detailStudents.slice(start, start + detailPageSize);
    }, [detailStudents, detailPage]);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── SUMMARY VIEW ── */}
            <div id="attendanceSummary" style={{ display: selectedSection ? 'none' : 'block' }}>
                <div className="filters-card">
                    <h4 className="filters-title">Filters</h4>
                    <div className="filter-group-row">
                        {/* Grade + Section filters — hidden for teachers (locked to their advisory) */}
                        {!isTeacher && (
                            <>
                                <div className="filter-item">
                                    <label className="filter-label">Grade Level</label>
                                    <div className="filter-input-wrapper">
                                        <select
                                            className="filter-select"
                                            id="gradeLevelFilter"
                                            value={gradeFilter}
                                            onChange={(e) => { setGradeFilter(e.target.value); setSectionFilter('all'); }}
                                        >
                                            <option value="all">All Grades</option>
                                            {gradeOptions.map((grade) => (
                                                <option key={grade} value={grade}>{grade}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="filter-item">
                                    <label className="filter-label">Section</label>
                                    <div className="filter-input-wrapper">
                                        <select
                                            className="filter-select"
                                            id="sectionFilter"
                                            value={sectionFilter}
                                            onChange={(e) => setSectionFilter(e.target.value)}
                                        >
                                            <option value="all">All Sections</option>
                                            {sectionOptions.map((section) => (
                                                <option key={section} value={section}>{section}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Teacher: show advisory class badge instead of filters */}
                        {isTeacher && teacherAdvisoryClasses && (
                            <div className="filter-item" style={{ flex: 2 }}>
                                <label className="filter-label">Your Advisory Class(es)</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                                    {teacherAdvisoryClasses.map(cls => (
                                        <span key={cls} style={{
                                            display: 'inline-flex', alignItems: 'center',
                                            background: '#fef2f2', color: '#860108',
                                            border: '1px solid #fecaca', borderRadius: 999,
                                            padding: '4px 12px', fontSize: 13, fontWeight: 600
                                        }}>
                                            {cls}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="filter-item">
                            <label className="filter-label">Date</label>
                            <div className="filter-input-wrapper">
                                {datesWithRecords.length === 0 && !loading ? (
                                    <span style={{ fontSize: 13, color: '#9ca3af', padding: '10px 0' }}>
                                        No attendance records yet
                                    </span>
                                ) : (
                                    <select
                                        className="filter-select"
                                        id="attendanceDate"
                                        value={attendanceDate}
                                        onChange={(e) => setAttendanceDate(e.target.value)}
                                        disabled={loading}
                                    >
                                        {datesWithRecords.map(d => (
                                            <option key={d} value={d}>
                                                {new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
                                                    month: 'long', day: 'numeric', year: 'numeric'
                                                })}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="table-outer-container">
                    <div className="attendance-table-container">
                        <table className="attendance-table">
                            <thead>
                                <tr>
                                    <th>Grade Level</th>
                                    <th>Section</th>
                                    <th>Adviser</th>
                                    <th>Number of Students</th>
                                </tr>
                            </thead>
                            <tbody id="attendanceTableBody">
                                {loading ? (
                                    <tr id="tablePlaceholder"><td colSpan="4">Loading data...</td></tr>
                                ) : error ? (
                                    <tr><td colSpan="4">Failed to load data: {error}</td></tr>
                                ) : datesWithRecords.length > 0 && !datesWithRecords.includes(attendanceDate) ? (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af' }}>
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }}>
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                            </svg>
                                            No attendance records for this date.
                                        </td>
                                    </tr>
                                ) : summaryRows.length === 0 ? (
                                    <tr><td colSpan="4">No data found for the selected filters.</td></tr>
                                ) : (
                                    pagedRows.map((row) => {
                                        const rowHasRecords = datesWithRecords.includes(attendanceDate);
                                        return (
                                            <tr
                                                key={`${row.grade}|${row.section}`}
                                                onClick={rowHasRecords ? () => openSectionDetail(row) : undefined}
                                                style={{
                                                    cursor: rowHasRecords ? 'pointer' : 'default',
                                                    opacity: rowHasRecords ? 1 : 0.45,
                                                    pointerEvents: rowHasRecords ? 'auto' : 'none'
                                                }}
                                                title={rowHasRecords
                                                    ? `Click to view students in ${row.grade} - ${row.section}`
                                                    : 'No attendance records for this date'}
                                            >
                                                <td>{row.grade}</td>
                                                <td>
                                                    <span style={{ color: rowHasRecords ? '#860108' : '#9ca3af', fontWeight: 600 }}>
                                                        {row.section}
                                                    </span>
                                                    {rowHasRecords && (
                                                        <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>›</span>
                                                    )}
                                                </td>
                                                <td>{row.adviser}</td>
                                                <td>{row.studentCount}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination" id="summaryPagination">
                        {!loading && summaryRows.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    className="back-btn"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                >
                                    Prev
                                </button>
                                <span style={{ alignSelf: 'center', fontSize: '14px' }}>
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    className="generate-summary-btn"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                >
                                    Next
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── SECTION DETAIL VIEW ── */}
            <div id="sectionDetailView" style={{ display: selectedSection ? 'block' : 'none' }}>
                {selectedSection && (
                    <>
                        <div className="detail-header">
                            <div className="header-stat-item">
                                <span className="header-stat-label">Section:</span>
                                <span className="header-stat-value" id="detailSectionName">
                                    {selectedSection.grade} — {selectedSection.section}
                                </span>
                            </div>
                            <div className="header-stat-item">
                                <span className="header-stat-label">Date:</span>
                                <span className="header-stat-value">{attendanceDate}</span>
                            </div>
                            <div className="header-stat-item">
                                <span className="header-stat-label">Teacher:</span>
                                <span className="header-stat-value" id="detailTeacher">
                                    {selectedSection.adviser}
                                </span>
                            </div>
                        </div>

                        <div className="detail-stats-grid">
                            {/* Total Students */}
                            <div className="detail-stat-card">
                                <div className="stat-main">
                                    <div className="stat-value" id="detailTotalCount">{detailStats.total}</div>
                                    <div className="stat-label-group">
                                        <span className="stat-label">Total Students</span>
                                        <div className="stat-icon-wrapper blue">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M17 21v-2a4 4 0 0 0-3-3.87"></path>
                                                <path d="M9 21v-2a4 4 0 0 1 4-4H5a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="9" cy="7" r="4"></circle>
                                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="stat-gender-breakdown">
                                    <span className="gender-item">Male: <span id="detailTotalMale">{detailStats.totalMale}</span></span>
                                    <span className="gender-item">Female: <span id="detailTotalFemale">{detailStats.totalFemale}</span></span>
                                </div>
                            </div>

                            {/* Present */}
                            <div className="detail-stat-card">
                                <div className="stat-main">
                                    <div className="stat-value" id="detailPresentCount">{detailStats.present}</div>
                                    <div className="stat-label-group">
                                        <span className="stat-label">Total Present</span>
                                        <div className="stat-icon-wrapper green">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="9" cy="7" r="4"></circle>
                                                <polyline points="16 11 18 13 22 9"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="stat-gender-breakdown">
                                    <span className="gender-item">Male: <span id="detailPresentMale">{detailStats.presentMale}</span></span>
                                    <span className="gender-item">Female: <span id="detailPresentFemale">{detailStats.presentFemale}</span></span>
                                </div>
                            </div>

                            {/* Absent */}
                            <div className="detail-stat-card">
                                <div className="stat-main">
                                    <div className="stat-value" id="detailAbsentCount">{detailStats.absent}</div>
                                    <div className="stat-label-group">
                                        <span className="stat-label">Total Absences</span>
                                        <div className="stat-icon-wrapper red">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                                <line x1="9" y1="9" x2="15" y2="15"></line>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="stat-gender-breakdown">
                                    <span className="gender-item">Male: <span id="detailAbsentMale">{detailStats.absentMale}</span></span>
                                    <span className="gender-item">Female: <span id="detailAbsentFemale">{detailStats.absentFemale}</span></span>
                                </div>
                            </div>

                            {/* Late */}
                            <div className="detail-stat-card">
                                <div className="stat-main">
                                    <div className="stat-value" id="detailLateCount">{detailStats.late}</div>
                                    <div className="stat-label-group">
                                        <span className="stat-label">Total Lates</span>
                                        <div className="stat-icon-wrapper orange">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <polyline points="12 6 12 12 16 14"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="stat-gender-breakdown">
                                    <span className="gender-item">Male: <span id="detailLateMale">{detailStats.lateMale}</span></span>
                                    <span className="gender-item">Female: <span id="detailLateFemale">{detailStats.lateFemale}</span></span>
                                </div>
                            </div>
                        </div>

                        <div className="detail-table-outer-wrapper">
                            <div className="attendance-table-container">
                                <table className="attendance-table detail-table">
                                    <thead>
                                        <tr>
                                            <th className="detail-th">Student Name</th>
                                            <th className="detail-th">Gender</th>
                                            <th className="detail-th">Student ID</th>
                                            <th className="detail-th">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="studentDetailTableBody">
                                        {detailLoading ? (
                                            <tr><td colSpan="4">Loading students...</td></tr>
                                        ) : detailError ? (
                                            <tr><td colSpan="4" style={{ color: 'red' }}>{detailError}</td></tr>
                                        ) : detailStudents.length === 0 ? (
                                            <tr><td colSpan="4">No students found in this section.</td></tr>
                                        ) : (
                                            pagedDetailStudents.map((s) => (
                                                <tr key={s.student_id}>
                                                    <td>{s.last_name}, {s.first_name}</td>
                                                    <td>{s.gender || '—'}</td>
                                                    <td>{s.student_id}</td>
                                                    <td>
                                                        <span style={{
                                                            padding: '2px 10px',
                                                            borderRadius: 12,
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            background:
                                                                s.status === 'Present' ? '#dcfce7' :
                                                                s.status === 'Late'    ? '#fef9c3' :
                                                                                         '#fee2e2',
                                                            color:
                                                                s.status === 'Present' ? '#16a34a' :
                                                                s.status === 'Late'    ? '#ca8a04' :
                                                                                         '#dc2626'
                                                        }}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="detail-footer">
                                <button className="back-btn" id="backToSummaryBtn" onClick={backToSummary}>
                                    ← Back
                                </button>

                                <div className="pagination" id="detailPagination">
                                    {!detailLoading && detailStudents.length > detailPageSize && (
                                        <>
                                            <button
                                                type="button"
                                                className="back-btn"
                                                onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                                                disabled={detailPage <= 1}
                                            >
                                                Prev
                                            </button>
                                            <span style={{ alignSelf: 'center', fontSize: '14px' }}>
                                                Page {detailPage} of {detailTotalPages}
                                            </span>
                                            <button
                                                type="button"
                                                className="generate-summary-btn"
                                                onClick={() => setDetailPage((p) => Math.min(detailTotalPages, p + 1))}
                                                disabled={detailPage >= detailTotalPages}
                                            >
                                                Next
                                            </button>
                                        </>
                                    )}
                                </div>

                                <button className="generate-summary-btn">Generate Summary</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
