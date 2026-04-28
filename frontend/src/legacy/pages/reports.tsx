// @ts-nocheck
import React from 'react';

const { useEffect, useMemo, useRef, useState } = React;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getCurrentMonth() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' })
        .format(new Date())
        .substring(0, 7);
}

// Returns up to 5 week arrays, each with 5 entries (Mon–Fri) of YYYY-MM-DD or null
function getMonthWeeks(year, month) {
    const dayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const result = [];
    for (let w = 0; w < 6 && result.length < 5; w++) {
        const week = [];
        for (let d = 0; d < 5; d++) {
            const dt = new Date(year, month - 1, 1 + mondayOffset + w * 7 + d);
            week.push(dt.getMonth() === month - 1 ? formatLocalDate(dt) : null);
        }
        if (week.some(Boolean)) result.push(week);
    }
    return result;
}

function getMonthOptions() {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = formatLocalDate(d).substring(0, 7);
        const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        opts.push({ value, label });
    }
    return opts;
}

const MONTH_OPTIONS = getMonthOptions();
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsApp() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [students, setStudents] = useState([]);
    const [teacherMap, setTeacherMap] = useState({});   // sectionKey → { name, email }
    const [sectionOptions, setSectionOptions] = useState([]);
    const [sectionFilter, setSectionFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState(getCurrentMonth);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailStatus, setEmailStatus] = useState(null); // { type, msg }

    const donutRef = useRef(null);
    const donutInstance = useRef(null);
    const lineRef = useRef(null);
    const lineInstance = useRef(null);

    // ─── Supabase wait ────────────────────────────────────────────────────────
    const waitForSupabase = async () => {
        let client = window.supabaseClient;
        let attempts = 0;
        while (!client && attempts < 20) {
            await new Promise(r => setTimeout(r, 500));
            client = window.supabaseClient;
            attempts++;
        }
        return client;
    };

    // ─── Initial load: students + teachers ───────────────────────────────────
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const client = await waitForSupabase();
                if (!client) throw new Error('Supabase client is not ready.');

                const [studentRes, teacherRes] = await Promise.all([
                    client.from('students')
                        .select('student_id, first_name, last_name, grade_level, section, gender')
                        .order('grade_level', { ascending: true })
                        .order('section', { ascending: true })
                        .order('last_name', { ascending: true }),
                    client.from('users')
                        .select('full_name, email, advisory_class')
                        .eq('role', 'teacher')
                ]);

                if (!mounted) return;

                const allStudents = studentRes.data || [];
                const tmap = {};
                (teacherRes.data || []).forEach(row => {
                    if (!row?.advisory_class || !row?.full_name) return;
                    String(row.advisory_class).split(',').forEach(cls => {
                        const key = cls.trim().toLowerCase().replace(/\s+/g, ' ');
                        if (key) tmap[key] = { name: row.full_name, email: row.email || '' };
                    });
                });

                const sectionsMap = {};
                allStudents.forEach(s => {
                    const grade = String(s.grade_level || '').trim();
                    const section = String(s.section || '').trim();
                    if (!grade || !section) return;
                    const key = `${grade}|${section}`;
                    if (!sectionsMap[key]) {
                        const advisoryKey = `${grade} - ${section}`.toLowerCase().replace(/\s+/g, ' ');
                        const teacher = tmap[advisoryKey] || { name: 'Not Assigned', email: '' };
                        sectionsMap[key] = { key, grade, section, adviser: teacher.name, adviserEmail: teacher.email, label: `${grade} - ${section}` };
                    }
                });

                const opts = Object.values(sectionsMap).sort((a, b) => {
                    const gc = a.grade.localeCompare(b.grade, undefined, { numeric: true });
                    return gc !== 0 ? gc : a.section.localeCompare(b.section, undefined, { numeric: true });
                });

                setStudents(allStudents);
                setTeacherMap(tmap);
                setSectionOptions(opts);
                if (opts.length > 0) setSectionFilter(opts[0].key);
            } catch (err) {
                if (mounted) setError(err.message || 'Failed to load data.');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    // ─── Load attendance when section/month changes ───────────────────────────
    useEffect(() => {
        if (!sectionFilter || !monthFilter || students.length === 0) return;
        const [grade, section] = sectionFilter.split('|');
        const [year, month] = monthFilter.split('-').map(Number);
        const startDate = `${monthFilter}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${monthFilter}-${String(lastDay).padStart(2, '0')}`;

        let mounted = true;
        const load = async () => {
            setAttendanceLoading(true);
            try {
                const client = await waitForSupabase();
                if (!client) return;

                const ids = students
                    .filter(s => String(s.grade_level).trim() === grade && String(s.section).trim() === section)
                    .map(s => s.student_id);

                if (ids.length === 0) {
                    if (mounted) setAttendanceRecords([]);
                    return;
                }

                const { data, error: attErr } = await client
                    .from('attendance')
                    .select('student_id, scan_date, status')
                    .in('student_id', ids)
                    .gte('scan_date', startDate)
                    .lte('scan_date', endDate);

                if (mounted && !attErr) setAttendanceRecords(data || []);
            } catch (err) {
                console.error('Attendance load error:', err);
            } finally {
                if (mounted) setAttendanceLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [sectionFilter, monthFilter, students]);

    // ─── Computed values ──────────────────────────────────────────────────────
    const activeSectionInfo = useMemo(() =>
        sectionOptions.find(s => s.key === sectionFilter) || null,
        [sectionOptions, sectionFilter]
    );

    const sectionStudents = useMemo(() => {
        if (!sectionFilter) return [];
        const [grade, section] = sectionFilter.split('|');
        return students
            .filter(s => String(s.grade_level).trim() === grade && String(s.section).trim() === section)
            .sort((a, b) => a.last_name.localeCompare(b.last_name));
    }, [sectionFilter, students]);

    const studentRecordMap = useMemo(() => {
        const map = {};
        attendanceRecords.forEach(r => {
            if (!map[r.student_id]) map[r.student_id] = {};
            map[r.student_id][r.scan_date] = r.status;
        });
        return map;
    }, [attendanceRecords]);

    const studentRows = useMemo(() =>
        sectionStudents.map(s => {
            const records = studentRecordMap[s.student_id] || {};
            return {
                ...s,
                totalAbsences: Object.values(records).filter(v => v === 'Absent').length,
                totalLates: Object.values(records).filter(v => v === 'Late').length,
            };
        }),
        [sectionStudents, studentRecordMap]
    );

        return { 
            present, 
            late, 
            absent, 
            total: sectionStudents.length,
            isEmpty: (present + late + absent) === 0
        };
    }, [attendanceRecords, sectionStudents]);

        const allZeros = data.every(v => v === 0);
        return {
            labels: weeks.map((_, i) => `Week ${i + 1}`),
            data,
            allZeros
        };
    }, [attendanceRecords, monthFilter]);

    const monthWeeks = useMemo(() => {
        if (!monthFilter) return [];
        const [year, month] = monthFilter.split('-').map(Number);
        return getMonthWeeks(year, month);
    }, [monthFilter]);

    const monthLabel = useMemo(() => {
        if (!monthFilter) return '';
        const [year, month] = monthFilter.split('-').map(Number);
        return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [monthFilter]);

    // ─── Donut chart ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!donutRef.current || typeof Chart === 'undefined') return;
        if (donutInstance.current) { donutInstance.current.destroy(); donutInstance.current = null; }

        const total = donutStats.total;
        const centerPlugin = {
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea: { width, height, left, top } } = chart;
                const cx = left + width / 2;
                const cy = top + height / 2;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 30px Poppins, sans-serif';
                ctx.fillStyle = '#111827';
                ctx.fillText(String(total), cx, cy - 10);
                ctx.font = '11px Poppins, sans-serif';
                ctx.fillStyle = '#9ca3af';
                ctx.fillText('Total Students', cx, cy + 14);
                ctx.restore();
            }
        };

        const chartData = donutStats.isEmpty 
            ? [1] 
            : [donutStats.present, donutStats.late, donutStats.absent];
        const chartColors = donutStats.isEmpty 
            ? ['#f3f4f6'] 
            : ['#4ADE80', '#FBBF24', '#F87171'];
        const chartLabels = donutStats.isEmpty 
            ? ['No Data'] 
            : ['Present', 'Late', 'Absent'];

        donutInstance.current = new Chart(donutRef.current, {
            type: 'doughnut',
            plugins: [centerPlugin],
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: chartColors,
                    borderWidth: 0,
                    hoverOffset: donutStats.isEmpty ? 0 : 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { 
                            padding: 16, 
                            font: { size: 12, family: 'Poppins, sans-serif' },
                            // Ensure legend matches chart colors
                            generateLabels: (chart) => {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => ({
                                        text: label,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    }));
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        enabled: !donutStats.isEmpty
                    }
                }
            }
        });

        return () => { if (donutInstance.current) { donutInstance.current.destroy(); donutInstance.current = null; } };
    }, [donutStats]);

    // ─── Line chart ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!lineRef.current || typeof Chart === 'undefined') return;
        if (lineInstance.current) { lineInstance.current.destroy(); lineInstance.current = null; }

        lineInstance.current = new Chart(lineRef.current, {
            type: 'line',
            data: {
                labels: weeklyLineData.labels,
                datasets: [{
                    label: 'Total Present',
                    data: weeklyLineData.data,
                    borderColor: '#860108',
                    backgroundColor: 'rgba(134,1,8,0.08)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#860108',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f3f4f6' }, 
                        ticks: { font: { family: 'Poppins, sans-serif', size: 11 } },
                        max: weeklyLineData.allZeros ? 10 : undefined
                    },
                    x: { grid: { display: false }, ticks: { font: { family: 'Poppins, sans-serif', size: 11 } } }
                }
            }
        });

        return () => { if (lineInstance.current) { lineInstance.current.destroy(); lineInstance.current = null; } };
    }, [weeklyLineData]);

    // ─── CSV generator ────────────────────────────────────────────────────────
    const generateCsvContent = () => {
        const [year, month] = monthFilter.split('-').map(Number);
        const weeks = getMonthWeeks(year, month);

        const metaRow = [
            `"E-QRAS Attendance Report"`,
            `"Section: ${activeSectionInfo?.label || ''}"`,
            `"Teacher: ${activeSectionInfo?.adviser || '-'}"`,
            `"Month: ${monthLabel}"`
        ].join(',');

        const colHeaders = ['Student Name', 'Gender'];
        weeks.forEach((week, wi) => {
            DAY_LABELS.forEach((day, di) => {
                colHeaders.push(week[di] ? `W${wi + 1}-${day}(${week[di]})` : `W${wi + 1}-${day}`);
            });
        });
        colHeaders.push('Total Absences', 'Total Lates');

        const rows = studentRows.map(s => {
            const records = studentRecordMap[s.student_id] || {};
            const cells = [`"${s.last_name}, ${s.first_name}"`, s.gender || ''];
            weeks.forEach(week => {
                DAY_LABELS.forEach((_, di) => {
                    const date = week[di];
                    cells.push(date ? (records[date] || '') : '');
                });
            });
            cells.push(s.totalAbsences, s.totalLates);
            return cells.join(',');
        });

        return [metaRow, '', colHeaders.join(','), ...rows].join('\n');
    };

    // ─── Export CSV ───────────────────────────────────────────────────────────
    const exportCSV = () => {
        const csv = generateCsvContent();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${(activeSectionInfo?.label || 'section').replace(/\s+/g, '_')}_${monthFilter}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Export PDF (print window) ────────────────────────────────────────────
    const exportPDF = () => {
        const [year, month] = monthFilter.split('-').map(Number);
        const weeks = getMonthWeeks(year, month);
        const sLabel = activeSectionInfo?.label || '';
        const teacherName = activeSectionInfo?.adviser || '-';

        const colHeaders = ['Student Name', 'Gender'];
        weeks.forEach((week, wi) => {
            DAY_LABELS.forEach((day, di) => {
                if (week[di]) colHeaders.push(`W${wi + 1} ${day}`);
            });
        });
        colHeaders.push('Absences', 'Lates');

        const colorMap = { P: '#16a34a', L: '#f59e0b', A: '#dc2626' };

        const tableRows = studentRows.map(s => {
            const records = studentRecordMap[s.student_id] || {};
            const cells = [
                `<td style="text-align:left">${s.last_name}, ${s.first_name}</td>`,
                `<td>${s.gender || '-'}</td>`
            ];
            weeks.forEach(week => {
                DAY_LABELS.forEach((_, di) => {
                    const date = week[di];
                    if (!date) return;
                    const st = records[date];
                    const abbr = st ? st[0] : '-';
                    const color = colorMap[abbr] || '#9ca3af';
                    cells.push(`<td style="color:${color};font-weight:700">${abbr}</td>`);
                });
            });
            cells.push(`<td style="color:#dc2626;font-weight:600">${s.totalAbsences}</td>`);
            cells.push(`<td style="color:#f59e0b;font-weight:600">${s.totalLates}</td>`);
            return `<tr>${cells.join('')}</tr>`;
        });

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Attendance Report — ${sLabel}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:18px;color:#333;font-size:12px}
    .hdr{display:flex;align-items:center;gap:14px;border-bottom:2.5px solid #860108;padding-bottom:10px;margin-bottom:16px}
    .school{color:#860108;font-size:18px;font-weight:700}
    .meta{font-size:12px;color:#555;margin-top:3px}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{background:#860108;color:#fff;padding:5px 4px;text-align:center;white-space:nowrap}
    td{border:1px solid #e5e7eb;padding:4px 5px;text-align:center}
    tr:nth-child(even) td{background:#f9fafb}
    @media print{@page{size:landscape;margin:8mm}}
  </style>
</head>
<body>
  <div class="hdr">
    <img src="/logo.svg" width="56" height="56" onerror="this.style.display='none'"/>
    <div>
      <div class="school">Emmaus Christian Schools, Inc. — E-QRAS</div>
      <div class="meta">Attendance Report &nbsp;|&nbsp; <b>${sLabel}</b> &nbsp;|&nbsp; ${monthLabel} &nbsp;|&nbsp; Teacher: <b>${teacherName}</b></div>
    </div>
  </div>
  <table>
    <thead><tr>${colHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows.join('')}</tbody>
  </table>
  <p style="font-size:10px;color:#9ca3af;margin-top:12px">P = Present &nbsp; L = Late &nbsp; A = Absent &nbsp; - = No record</p>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (!win) { alert('Please allow pop-ups to export PDF.'); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 600);
    };

    // ─── Email report to teacher ──────────────────────────────────────────────
    const emailReport = async () => {
        if (!activeSectionInfo?.adviserEmail) {
            setEmailStatus({ type: 'error', msg: 'No email address found for the assigned teacher.' });
            return;
        }
        setEmailLoading(true);
        setEmailStatus({ type: 'info', msg: `Generating report and sending to ${activeSectionInfo.adviser}...` });
        try {
            const csvContent = generateCsvContent();
            const base64 = btoa(unescape(encodeURIComponent(csvContent)));

            const res = await fetch('/api/send-report-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_email: activeSectionInfo.adviserEmail,
                    teacher_name: activeSectionInfo.adviser,
                    section: activeSectionInfo.label,
                    month: monthFilter,
                    csv_content: base64
                })
            });

            const data = await res.json();
            if (data.success) {
                setEmailStatus({ type: 'success', msg: `Report sent to ${activeSectionInfo.adviser} (${activeSectionInfo.adviserEmail}).` });
            } else {
                setEmailStatus({ type: 'error', msg: data.error || 'Failed to send email.' });
            }
        } catch (err) {
            setEmailStatus({ type: 'error', msg: err.message || 'Failed to send email.' });
        } finally {
            setEmailLoading(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/>
                </svg>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                Loading report data…
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '32px', textAlign: 'center', color: '#dc2626' }}>
                <p style={{ fontWeight: 600 }}>Failed to load data</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>{error}</p>
            </div>
        );
    }

    return (
        <>
            {/* ── GLOBAL FILTER CARD ── */}
            <div className="filters-card" style={{ marginBottom: 24 }}>
                <h4 className="filters-title">Report Filters</h4>
                <div className="filter-group-row">
                    <div className="filter-item">
                        <label className="filter-label">Section</label>
                        <div className="filter-input-wrapper">
                            <select
                                className="filter-select"
                                value={sectionFilter}
                                onChange={e => setSectionFilter(e.target.value)}
                            >
                                {sectionOptions.length === 0 && <option value="">No sections found</option>}
                                {sectionOptions.map(opt => (
                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="filter-item">
                        <label className="filter-label">Month</label>
                        <div className="filter-input-wrapper">
                            <select
                                className="filter-select"
                                value={monthFilter}
                                onChange={e => setMonthFilter(e.target.value)}
                            >
                                {MONTH_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {activeSectionInfo && (
                        <div className="filter-item" style={{ flex: 2 }}>
                            <label className="filter-label">Assigned Teacher</label>
                            <div style={{ paddingTop: 8 }}>
                                <span style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: 6, 
                                    background: activeSectionInfo.adviser === 'Not Assigned' ? '#f3f4f6' : '#fef2f2', 
                                    color: activeSectionInfo.adviser === 'Not Assigned' ? '#6b7280' : '#860108', 
                                    border: `1px solid ${activeSectionInfo.adviser === 'Not Assigned' ? '#e5e7eb' : '#fecaca'}`, 
                                    borderRadius: 999, 
                                    padding: '4px 14px', 
                                    fontSize: 13, 
                                    fontWeight: 600,
                                    fontStyle: activeSectionInfo.adviser === 'Not Assigned' ? 'italic' : 'normal'
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    {activeSectionInfo.adviser}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── CHARTS GRID ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, opacity: attendanceLoading ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                {/* Donut Chart */}
                <div className="dashboard-panel animate-on-load" style={{ animationDelay: '0.1s', padding: 24 }}>
                    <div className="dashboard-panel-header">
                        <h3 className="dashboard-panel-title">Monthly Attendance Breakdown</h3>
                        {attendanceLoading && <span style={{ fontSize: 11, color: '#9ca3af' }}>Updating…</span>}
                    </div>
                    <div style={{ height: 260 }}>
                        <canvas ref={donutRef}></canvas>
                    </div>
                    {!attendanceLoading && donutStats.isEmpty && (
                        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Skeleton view: No data for this month</p>
                    )}
                </div>

                {/* Line Chart */}
                <div className="dashboard-panel animate-on-load" style={{ animationDelay: '0.15s', padding: 24 }}>
                    <div className="dashboard-panel-header">
                        <h3 className="dashboard-panel-title">Weekly Present Trend</h3>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{monthLabel}</span>
                    </div>
                    <div style={{ height: 260 }}>
                        <canvas ref={lineRef}></canvas>
                    </div>
                </div>
            </div>

            {/* ── CONTEXT HEADER ── */}
            {activeSectionInfo && (
                <div className="detail-header" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        <div className="header-stat-item">
                            <span className="header-stat-label">Section:</span>
                            <span className="header-stat-value">{activeSectionInfo.label}</span>
                        </div>
                        <div className="header-stat-item">
                            <span className="header-stat-label">Period:</span>
                            <span className="header-stat-value">{monthLabel}</span>
                        </div>
                        <div className="header-stat-item">
                            <span className="header-stat-label">Teacher:</span>
                            <span className="header-stat-value" style={{ fontStyle: activeSectionInfo.adviser === 'Not Assigned' ? 'italic' : 'normal', color: activeSectionInfo.adviser === 'Not Assigned' ? '#9ca3af' : 'inherit' }}>
                                {activeSectionInfo.adviser}
                            </span>
                        </div>
                        <div className="header-stat-item">
                            <span className="header-stat-label">Students:</span>
                            <span className="header-stat-value">{sectionStudents.length}</span>
                        </div>
                    </div>

                    {/* Export / Email buttons */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                            className="back-btn"
                            onClick={exportCSV}
                            disabled={studentRows.length === 0}
                            title="Download as CSV"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5, verticalAlign: 'middle' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Export CSV
                        </button>
                        <button
                            className="back-btn"
                            onClick={exportPDF}
                            disabled={studentRows.length === 0}
                            title="Export & Print as PDF"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5, verticalAlign: 'middle' }}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            Export PDF
                        </button>
                        <button
                            className="generate-summary-btn"
                            onClick={emailReport}
                            disabled={emailLoading || studentRows.length === 0}
                            title={activeSectionInfo.adviserEmail ? `Send to ${activeSectionInfo.adviserEmail}` : 'No teacher email on file'}
                        >
                            {emailLoading ? 'Sending…' : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5, verticalAlign: 'middle' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    Email Report
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Email status */}
            {emailStatus && (
                <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: emailStatus.type === 'success' ? '#dcfce7' : '#fee2e2', color: emailStatus.type === 'success' ? '#15803d' : '#b91c1c', border: `1px solid ${emailStatus.type === 'success' ? '#86efac' : '#fca5a5'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{emailStatus.msg}</span>
                    <button onClick={() => setEmailStatus(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
            )}

            {/* ── MASTER ATTENDANCE TABLE ── */}
            <div className="dashboard-panel animate-on-load" style={{ animationDelay: '0.2s', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 className="dashboard-panel-title" style={{ margin: 0, fontSize: 16 }}>
                        Student Attendance Summary
                    </h3>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                        Click a row for daily breakdown
                    </span>
                </div>

                <div className="attendance-table-container">
                    <table className="attendance-table" style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '40%', textAlign: 'left', paddingLeft: 20, color: '#860108' }}>Student Name</th>
                                <th style={{ width: '15%', color: '#860108' }}>Gender</th>
                                <th style={{ width: '20%', color: '#860108' }}>Total Absences</th>
                                <th style={{ width: '20%', color: '#860108' }}>Total Lates</th>
                                <th style={{ width: '5%' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceLoading ? (
                                <tr><td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>Loading attendance data…</td></tr>
                            ) : studentRows.length === 0 ? (
                                <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                    No students found in this section.
                                </td></tr>
                            ) : (
                                studentRows.map(s => (
                                    <tr
                                        key={s.student_id}
                                        onClick={() => setSelectedStudent(s)}
                                        style={{ cursor: 'pointer' }}
                                        className="report-row"
                                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}
                                    >
                                        <td style={{ paddingLeft: 20, fontWeight: 600, color: '#111827' }}>
                                            {s.last_name}, {s.first_name}
                                        </td>
                                        <td style={{ textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                                            {s.gender || '—'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, padding: '2px 10px', borderRadius: 12, fontSize: 13, fontWeight: 700, background: s.totalAbsences > 0 ? '#fee2e2' : '#f3f4f6', color: s.totalAbsences > 0 ? '#dc2626' : '#9ca3af' }}>
                                                {s.totalAbsences}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, padding: '2px 10px', borderRadius: 12, fontSize: 13, fontWeight: 700, background: s.totalLates > 0 ? '#fef3c7' : '#f3f4f6', color: s.totalLates > 0 ? '#d97706' : '#9ca3af' }}>
                                                {s.totalLates}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 16 }}>›</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── STUDENT MODAL ── */}
            {selectedStudent && (
                <div
                    onClick={e => { if (e.target === e.currentTarget) setSelectedStudent(null); }}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                >
                    <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        {/* Modal header */}
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#860108', fontFamily: 'Poppins, sans-serif' }}>
                                    {selectedStudent.last_name}, {selectedStudent.first_name}
                                </h2>
                                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
                                    {activeSectionInfo?.label} &nbsp;·&nbsp; {monthLabel} &nbsp;·&nbsp; {selectedStudent.gender || '—'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >×</button>
                        </div>

                        {/* Summary pills */}
                        <div style={{ padding: '14px 24px', display: 'flex', gap: 12, borderBottom: '1px solid #f3f4f6' }}>
                            {[
                                { label: 'Present', count: Object.values(studentRecordMap[selectedStudent.student_id] || {}).filter(v => v === 'Present').length, bg: '#dcfce7', color: '#15803d' },
                                { label: 'Late', count: selectedStudent.totalLates, bg: '#fef3c7', color: '#d97706' },
                                { label: 'Absent', count: selectedStudent.totalAbsences, bg: '#fee2e2', color: '#dc2626' },
                            ].map(({ label, count, bg, color }) => (
                                <div key={label} style={{ background: bg, borderRadius: 10, padding: '8px 18px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Poppins, sans-serif' }}>{count}</div>
                                    <div style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* 5×5 Grid */}
                        <div style={{ padding: '20px 24px 24px', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4 }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 64, fontSize: 11, color: '#6b7280', fontWeight: 600, textAlign: 'left', paddingBottom: 6 }}>Week</th>
                                        {DAY_LABELS.map(d => (
                                            <th key={d} style={{ fontSize: 12, color: '#374151', fontWeight: 600, textAlign: 'center', paddingBottom: 6 }}>{d}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthWeeks.map((week, wi) => {
                                        const records = studentRecordMap[selectedStudent.student_id] || {};
                                        return (
                                            <tr key={wi}>
                                                <td style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, paddingRight: 8, verticalAlign: 'middle' }}>
                                                    Week {wi + 1}
                                                </td>
                                                {week.map((date, di) => {
                                                    const status = date ? records[date] : null;
                                                    const cfg = !date ? { bg: '#f9fafb', color: '#d1d5db', label: '', border: '#f3f4f6' }
                                                        : status === 'Present' ? { bg: '#dcfce7', color: '#15803d', label: 'P', border: '#86efac' }
                                                        : status === 'Late'    ? { bg: '#fef3c7', color: '#d97706', label: 'L', border: '#fcd34d' }
                                                        : status === 'Absent'  ? { bg: '#fee2e2', color: '#dc2626', label: 'A', border: '#fca5a5' }
                                                        :                        { bg: '#f9fafb', color: '#d1d5db', label: '–', border: '#e5e7eb' };
                                                    const dayNum = date ? date.split('-')[2] : '';
                                                    return (
                                                        <td key={di} title={date ? `${date}: ${status || 'No record'}` : ''} style={{ textAlign: 'center', padding: 0 }}>
                                                            <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '6px 4px', minWidth: 54, transition: 'all 0.15s' }}>
                                                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{dayNum}</div>
                                                                <div style={{ fontSize: 15, fontWeight: 700, color: cfg.color, lineHeight: 1 }}>{cfg.label || '·'}</div>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                    {monthWeeks.length === 0 && (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>No school days found for this month.</td></tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Legend */}
                            <div style={{ marginTop: 14, display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
                                {[['#dcfce7','#15803d','P – Present'], ['#fef3c7','#d97706','L – Late'], ['#fee2e2','#dc2626','A – Absent'], ['#f9fafb','#d1d5db','· – No record']].map(([bg, color, text]) => (
                                    <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: bg, border: `1px solid ${color}` }}></span>
                                        {text}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
