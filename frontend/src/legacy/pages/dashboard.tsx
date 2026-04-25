// @ts-nocheck
import React from 'react';

/* Auto-extracted from dashboard.php */

const { useEffect, useMemo, useRef, useState } = React;

function formatCurrentDate() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return {
        dayText: `${days[now.getDay()]},`,
        dateText: `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
    };
}

function makeSevenDaySeries() {
    const labels = [];
    const dateKeys = [];
    const counts = {};

    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dateKeys.push(key);
        counts[key] = 0;
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    return { labels, dateKeys, counts };
}

function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value === 'present') return 'status-pill-success';
    if (value === 'absent') return 'status-pill-error';
    return 'status-pill-warning';
}

export default function DashboardApp() {
    const [dayDate, setDayDate] = useState(formatCurrentDate());
    const [syncState, setSyncState] = useState('idle');
    const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0 });
    const [trend, setTrend] = useState({ labels: [], data: [] });
    const [recentScans, setRecentScans] = useState([]);
    const [recentError, setRecentError] = useState('');
    const [sectionSummary, setSectionSummary] = useState([]);

    const chartCanvasRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const fetchingRef = useRef(false);
    const syncTimerRef = useRef(null);

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

    const fetchDashboardData = async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        setSyncState('syncing');

        const client = await waitForSupabase();
        if (!client) {
            fetchingRef.current = false;
            setSyncState('error');
            return;
        }

        try {
            const now = new Date();
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);

            const { count: totalStudents, error: totalError } = await client
                .from('students')
                .select('*', { count: 'exact', head: true });

            if (!totalError) {
                setStats((prev) => ({ ...prev, total: totalStudents || 0 }));
            }

            const { data: todayRecords, error: recordsError } = await client
                .from('attendance')
                .select('status, student_id')
                .eq('scan_date', today);

            if (!recordsError) {
                const dayStats = { present: 0, absent: 0, late: 0 };
                (todayRecords || []).forEach((r) => {
                    const normalized = String(r.status || '').toLowerCase();
                    if (normalized === 'present') dayStats.present += 1;
                    if (normalized === 'absent') dayStats.absent += 1;
                    if (normalized === 'late') dayStats.late += 1;
                });

                setStats((prev) => ({ ...prev, ...dayStats }));
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const startDate = sevenDaysAgo.toISOString().split('T')[0];

            const { data: trendData, error: trendError } = await client
                .from('attendance')
                .select('status, scan_date')
                .gte('scan_date', startDate)
                .order('scan_date', { ascending: true });

            if (!trendError) {
                const series = makeSevenDaySeries();
                (trendData || []).forEach((r) => {
                    if (!Object.prototype.hasOwnProperty.call(series.counts, r.scan_date)) return;
                    const normalized = String(r.status || '').toLowerCase();
                    if (normalized === 'present' || normalized === 'late') {
                        series.counts[r.scan_date] += 1;
                    }
                });

                setTrend({
                    labels: series.labels,
                    data: series.dateKeys.map((k) => series.counts[k])
                });
            }

            const { data: recentData, error: recentFetchError } = await client
                .from('attendance')
                .select(`
                    id,
                    student_id,
                    time_in,
                    status,
                    students (
                        first_name,
                        last_name,
                        section,
                        grade_level
                    )
                `)
                .order('id', { ascending: false })
                .limit(50);

            if (recentFetchError) {
                setRecentError(recentFetchError.message || 'Failed to load recent scans.');
                setRecentScans([]);
            } else {
                setRecentError('');
                setRecentScans(recentData || []);
            }

            const { data: allStudents, error: studentError } = await client
                .from('students')
                .select('student_id, section, grade_level');

            if (!studentError && Array.isArray(allStudents)) {
                const groups = {};
                const studentToGroup = {};

                allStudents.forEach((student) => {
                    if (!student.section || !student.grade_level) return;
                    const key = `${student.grade_level}|${student.section}`;
                    if (!groups[key]) {
                        groups[key] = {
                            grade: student.grade_level,
                            section: student.section,
                            total: 0,
                            presentCount: 0
                        };
                    }
                    groups[key].total += 1;
                    studentToGroup[student.student_id] = key;
                });

                (todayRecords || []).forEach((record) => {
                    const key = studentToGroup[record.student_id];
                    if (key && groups[key]) {
                        groups[key].presentCount += 1;
                    }
                });

                const sortedSummary = Object.keys(groups)
                    .sort((a, b) => {
                        const [gradeA, sectionA] = a.split('|');
                        const [gradeB, sectionB] = b.split('|');
                        if (gradeA !== gradeB) {
                            return gradeA.localeCompare(gradeB, undefined, { numeric: true });
                        }
                        return sectionA.localeCompare(sectionB);
                    })
                    .map((key) => {
                        const item = groups[key];
                        const percent = item.total > 0 ? Math.round((item.presentCount / item.total) * 100) : 0;
                        return {
                            key,
                            label: `${item.grade} - ${item.section}`,
                            total: item.total,
                            presentCount: item.presentCount,
                            percent
                        };
                    });

                setSectionSummary(sortedSummary);
            }

            setDayDate(formatCurrentDate());
            setSyncState('live');
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(() => setSyncState('synced'), 2000);
        } catch (error) {
            console.error('Unexpected error fetching dashboard data:', error);
            setSyncState('error');
        } finally {
            fetchingRef.current = false;
        }
    };

    const autoMarkAbsent = async () => {
        const client = await waitForSupabase();
        if (!client) return;

        try {
            const now = new Date();
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
            const timeParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Manila', hour12: false, hour: 'numeric', minute: 'numeric'
            }).formatToParts(now);
            const currentHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);
            const currentMinute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0', 10);
            const currentTotalMinutes = currentHour * 60 + currentMinute;

            // Fetch start_class_time from settings (grace period = start + 15 mins)
            let graceEndMinutes = null;
            const { data: sD } = await client.from('settings').select('value').eq('key', 'start_class_time').maybeSingle();
            if (sD?.value) {
                const p = String(sD.value).split(':');
                graceEndMinutes = (+p[0]) * 60 + (+p[1]) + 15;
            }

            // Only run after grace period ends
            if (graceEndMinutes === null || currentTotalMinutes < graceEndMinutes) return;

            // Get all students in batches so large schools do not overload one query.
            const allStudents = [];
            const batchSize = 500;
            let start = 0;

            while (true) {
                const { data: batch, error: batchError } = await client
                    .from('students')
                    .select('student_id, section')
                    .range(start, start + batchSize - 1);

                if (batchError) throw batchError;

                if (batch?.length) {
                    allStudents.push(...batch);
                }

                if (!batch || batch.length < batchSize) break;
                start += batchSize;
            }

            if (!allStudents.length) return;

            // Get students already marked today
            const { data: markedToday } = await client.from('attendance').select('student_id').eq('scan_date', today);
            const markedIds = new Set((markedToday || []).map(r => r.student_id));

            // Find unmarked students
            const unmarked = allStudents.filter(s => !markedIds.has(s.student_id));
            if (!unmarked.length) return;

            const timeString = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Manila', timeStyle: 'medium', hour12: true
            }).format(now);

            // Bulk insert absent records
            const records = unmarked.map(s => ({
                student_id: s.student_id,
                scan_date: today,
                time_in: timeString,
                status: 'Absent',
                section: s.section || null,
            }));

            await client.from('attendance').insert(records);
            console.log(`[E-QRAS] Auto-marked ${records.length} students as Absent after grace period.`);
        } catch (err) {
            console.error('[E-QRAS] autoMarkAbsent error:', err);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        const intervalId = setInterval(fetchDashboardData, 5000);
        // Auto-mark unmarked students as absent after end_class_time
        autoMarkAbsent();
        return () => {
            clearInterval(intervalId);
            clearTimeout(syncTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!chartCanvasRef.current || typeof Chart === 'undefined') return;

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        chartInstanceRef.current = new Chart(chartCanvasRef.current.getContext('2d'), {
            type: 'line',
            data: {
                labels: trend.labels,
                datasets: [
                    {
                        label: 'Attendance',
                        data: trend.data,
                        borderColor: '#ffb200',
                        backgroundColor: 'rgba(255, 178, 0, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#ffb200',
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { drawBorder: false, color: '#f3f4f6' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [trend]);

    const syncLabel = useMemo(() => {
        if (syncState === 'syncing') return 'Syncing...';
        if (syncState === 'live') return 'Live';
        if (syncState === 'synced') return 'Synced';
        if (syncState === 'error') return 'Connection issue';
        return '';
    }, [syncState]);

    const syncClass = useMemo(() => {
        if (syncState === 'live') return 'sync-label sync-live';
        if (syncState === 'error') return 'sync-label sync-error';
        return 'sync-label';
    }, [syncState]);

    return (
        <>
            <div className="dashboard-hero">
                <div className="dashboard-date-card animate-on-load">
                    <div className="dashboard-date-label" id="currentDay">{dayDate.dayText} {syncLabel && <span className={syncClass}>{syncLabel}</span>}</div>
                    <div className="dashboard-date-value" id="currentDate">{dayDate.dateText}</div>
                </div>

                <div className="dashboard-stat-row">
                    <div className="dashboard-stat-card animate-on-load" style={{ animationDelay: '0.1s' }}>
                        <div className="stat-icon stat-icon-total">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <div className="stat-text">
                            <span className="stat-number count-up" id="stat-total">{Math.max(0, stats.total - stats.present - stats.late - stats.absent)}</span>
                            <span className="stat-label">Unmarked</span>
                        </div>
                    </div>

                    <div className="dashboard-stat-card animate-on-load" style={{ animationDelay: '0.2s' }}>
                        <div className="stat-icon stat-icon-present">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <polyline points="16 11 18 13 22 9"></polyline>
                            </svg>
                        </div>
                        <div className="stat-text">
                            <span className="stat-number count-up" id="stat-present">{stats.present}</span>
                            <span className="stat-label">Present</span>
                        </div>
                    </div>

                    <div className="dashboard-stat-card animate-on-load" style={{ animationDelay: '0.3s' }}>
                        <div className="stat-icon stat-icon-absent">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                        </div>
                        <div className="stat-text">
                            <span className="stat-number count-up" id="stat-absent">{stats.absent}</span>
                            <span className="stat-label">Absent</span>
                        </div>
                    </div>

                    <div className="dashboard-stat-card animate-on-load" style={{ animationDelay: '0.4s' }}>
                        <div className="stat-icon stat-icon-late">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div className="stat-text">
                            <span className="stat-number count-up" id="stat-late">{stats.late}</span>
                            <span className="stat-label">Late</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="dashboard-main-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <div className="dashboard-panel animate-on-load" style={{ animationDelay: '0.5s' }}>
                    <div className="dashboard-panel-header">
                        <h3 className="dashboard-panel-title">Weekly Attendance Trend</h3>
                    </div>
                    <div className="dashboard-chart">
                        <canvas ref={chartCanvasRef} id="attendanceChart"></canvas>
                    </div>
                </div>

                <div className="dashboard-panel animate-on-load" style={{ animationDelay: '0.6s' }}>
                    <div className="dashboard-panel-header">
                        <h3 className="dashboard-panel-title">Attendance by Section</h3>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>High to Low</span>
                    </div>
                    <div id="sectionSummaryList" className="section-summary-list">
                        {sectionSummary.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Analyzing sections...</div>
                        )}
                        {sectionSummary.map((item) => (
                            <div className="section-item" key={item.key}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#374151' }}>{item.label}</span>
                                    <span style={{ fontSize: '11px', color: '#6b7280' }}>{item.percent}% ({item.presentCount}/{item.total})</span>
                                </div>
                                <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${item.percent}%`, height: '100%', background: '#ffb200', borderRadius: '3px', transition: 'width 1s ease-out' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="dashboard-main-grid" style={{ marginTop: '24px', gridTemplateColumns: '1fr' }}>
                <div className="dashboard-panel animate-on-load" style={{ animationDelay: '0.7s' }}>
                    <div className="dashboard-panel-header">
                        <h3 className="dashboard-panel-title">Recent Activity</h3>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Real-time updates</span>
                    </div>
                    <div className="recent-activity-container">
                        <table className="recent-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Student</th>
                                    <th style={{ textAlign: 'center' }}>Grade</th>
                                    <th style={{ textAlign: 'center' }}>Section</th>
                                    <th style={{ textAlign: 'center' }}>Time</th>
                                    <th style={{ textAlign: 'right' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody id="recentActivityBody">
                                {recentError && (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', color: '#dc2626', padding: '20px' }}>{recentError}</td>
                                    </tr>
                                )}
                                {!recentError && recentScans.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading recent scans...</td>
                                    </tr>
                                )}
                                {!recentError && recentScans.map((scan) => {
                                    const student = scan.students || {};
                                    const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown Student';
                                    return (
                                        <tr key={scan.id}>
                                            <td style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f3f4f6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                </div>
                                                <span style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{fullName}</span>
                                            </td>
                                            <td style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>{student.grade_level || '---'}</td>
                                            <td style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>{student.section || '---'}</td>
                                            <td style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>{scan.time_in || '---'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className={`status-pill ${statusClass(scan.status)}`}>{scan.status || '---'}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}


