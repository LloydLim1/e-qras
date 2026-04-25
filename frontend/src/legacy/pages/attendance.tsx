// @ts-nocheck
import React from 'react';

/* Auto-extracted from attendance.php */

export default function AttendanceApp() {
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

            if (fetchError) {
                throw fetchError;
            }

            if (!data || data.length === 0) {
                break;
            }

            allRows.push(...data);

            if (data.length < batchSize) {
                break;
            }

            from += batchSize;
        }

        return allRows;
    };

    React.useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            setLoading(true);
            setError('');

            try {
                const client = await waitForSupabase();
                if (!client) {
                    throw new Error('Supabase client is not ready.');
                }

                const [studentRows, teacherRowsResponse] = await Promise.all([
                    fetchStudentsBatched(client),
                    client
                        .from('users')
                        .select('full_name, advisory_class')
                        .eq('role', 'teacher')
                ]);

                const teacherRows = teacherRowsResponse.data || [];
                const map = {};
                teacherRows.forEach((row) => {
                    if (!row?.advisory_class || !row?.full_name) return;
                    const key = String(row.advisory_class).trim().toLowerCase().replace(/\s+/g, ' ');
                    map[key] = row.full_name;
                });

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

        return () => {
            mounted = false;
        };
    }, []);

    const gradeOptions = React.useMemo(() => {
        return Array.from(
            new Set(
                students
                    .map((s) => s.grade_level)
                    .filter(Boolean)
                    .map((v) => String(v).trim())
            )
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

            if (gradeFilter !== 'all' && grade !== gradeFilter) return;
            if (sectionFilter !== 'all' && section !== sectionFilter) return;

            const key = `${grade}|${section}`;
            if (!grouped[key]) {
                const advisoryKey = `${grade} - ${section}`.toLowerCase().replace(/\s+/g, ' ');
                grouped[key] = {
                    grade,
                    section,
                    adviser: teacherMap[advisoryKey] || '-',
                    studentCount: 0
                };
            }

            grouped[key].studentCount += 1;
        });

        return Object.values(grouped).sort((a, b) => {
            const gradeCompare = a.grade.localeCompare(b.grade, undefined, { numeric: true });
            if (gradeCompare !== 0) return gradeCompare;
            return a.section.localeCompare(b.section, undefined, { numeric: true });
        });
    }, [students, gradeFilter, sectionFilter, teacherMap]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [gradeFilter, sectionFilter]);

    const totalPages = Math.max(1, Math.ceil(summaryRows.length / pageSize));
    const pagedRows = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return summaryRows.slice(start, start + pageSize);
    }, [summaryRows, currentPage]);

    return (
        <>
            <div id="attendanceSummary">
                <div className="filters-card">
                    <h4 className="filters-title">Filters</h4>
                    <div className="filter-group-row">
                        <div className="filter-item">
                            <label className="filter-label">Grade Level</label>
                            <div className="filter-input-wrapper">
                                <select
                                    className="filter-select"
                                    id="gradeLevelFilter"
                                    value={gradeFilter}
                                    onChange={(e) => {
                                        setGradeFilter(e.target.value);
                                        setSectionFilter('all');
                                    }}
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
                        <div className="filter-item">
                            <label className="filter-label">Date</label>
                            <div className="filter-input-wrapper">
                                <input
                                    type="date"
                                    className="filter-date"
                                    id="attendanceDate"
                                    value={attendanceDate}
                                    onChange={(e) => setAttendanceDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="time-constraint-card" id="timeConstraintCard" style={{ display: 'none' }}>
                    <h4 className="filters-title" style={{ marginBottom: '10px' }}>Time Settings</h4>
                    <div className="filter-group-row" style={{ alignItems: 'center', gap: '15px' }}>
                        <div className="filter-item">
                            <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Late Threshold</label>
                            <input type="time" className="filter-date" id="lateTimeThreshold" defaultValue="07:30" style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
                        </div>
                        <div className="filter-item">
                            <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>End of Class</label>
                            <input type="time" className="filter-date" id="endClassTime" defaultValue="17:00" style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
                        </div>
                        <button id="saveTimeConstraintBtn" style={{ backgroundColor: '#860108', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', marginTop: '18px' }}>
                            Save
                        </button>
                    </div>
                    <div id="timeSaveStatus" style={{ fontSize: '12px', marginTop: '5px', minHeight: '18px' }}></div>
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
                                    <tr id="tablePlaceholder">
                                        <td colSpan="4">Loading data...</td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan="4">Failed to load data: {error}</td>
                                    </tr>
                                ) : summaryRows.length === 0 ? (
                                    <tr>
                                        <td colSpan="4">No data found for the selected filters.</td>
                                    </tr>
                                ) : (
                                    pagedRows.map((row) => (
                                        <tr key={`${row.grade}|${row.section}`}>
                                            <td>{row.grade}</td>
                                            <td>{row.section}</td>
                                            <td>{row.adviser}</td>
                                            <td>{row.studentCount}</td>
                                        </tr>
                                    ))
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

            <div id="sectionDetailView" style={{ display: 'none' }}>
                <div className="detail-header">
                    <div className="header-stat-item">
                        <span className="header-stat-label">Section:</span>
                        <span className="header-stat-value" id="detailSectionName">Grade 1 - Einstein</span>
                    </div>
                    <div className="header-stat-item">
                        <span className="header-stat-label">Date:</span>
                        <input type="text" className="header-stat-input" id="detailDateInput" />
                    </div>
                    <div className="header-stat-item">
                        <span className="header-stat-label">Teacher:</span>
                        <span className="header-stat-value" id="detailTeacher">Ms. Denise Lazaro</span>
                    </div>
                </div>

                <div className="detail-stats-grid">
                    <div className="detail-stat-card">
                        <div className="stat-main">
                            <div className="stat-value" id="detailTotalCount">0</div>
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
                            <span className="gender-item">Male: <span id="detailTotalMale">0</span></span>
                            <span className="gender-item">Female: <span id="detailTotalFemale">0</span></span>
                        </div>
                    </div>

                    <div className="detail-stat-card">
                        <div className="stat-main">
                            <div className="stat-value" id="detailPresentCount">0</div>
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
                            <span className="gender-item">Male: <span id="detailPresentMale">0</span></span>
                            <span className="gender-item">Female: <span id="detailPresentFemale">0</span></span>
                        </div>
                    </div>

                    <div className="detail-stat-card">
                        <div className="stat-main">
                            <div className="stat-value" id="detailAbsentCount">0</div>
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
                            <span className="gender-item">Male: <span id="detailAbsentMale">0</span></span>
                            <span className="gender-item">Female: <span id="detailAbsentFemale">0</span></span>
                        </div>
                    </div>

                    <div className="detail-stat-card">
                        <div className="stat-main">
                            <div className="stat-value" id="detailLateCount">0</div>
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
                            <span className="gender-item">Male: <span id="detailLateMale">0</span></span>
                            <span className="gender-item">Female: <span id="detailLateFemale">0</span></span>
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
                            <tbody id="studentDetailTableBody"></tbody>
                        </table>
                    </div>

                    <div className="detail-footer">
                        <button className="back-btn" id="backToSummaryBtn">Back</button>

                        <div className="pagination" id="detailPagination"></div>

                        <button className="generate-summary-btn">Generate Summary</button>
                    </div>
                </div>
            </div>
        </>
    );
}


