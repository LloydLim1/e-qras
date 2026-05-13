// @ts-nocheck
import React from 'react';
import { createClient } from '@/utils/supabase/client';

const { useEffect, useMemo, useRef, useState } = React;

// ─── Authenticated fetch helper ───────────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> || {}),
    };
    const res = await fetch(path, { ...options, headers });
    let data: any = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
        const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
        throw new Error(message);
    }
    return data || {};
}

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
    const [flagMap, setFlagMap] = useState({});      // student_id → { date: true }
    const [flagBusy, setFlagBusy] = useState({});    // `${student_id}|${date}` → true
    const [userRole, setUserRole] = useState('');

    useEffect(() => {
        const stored = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
        setUserRole(stored.toLowerCase());
    }, []);

    const canFlagCutClass = userRole !== 'admin';

    const donutRef = useRef(null);
    const donutInstance = useRef(null);
    const lineRef = useRef(null);
    const lineInstance = useRef(null);

    const supabaseRef = useRef(null);
    const getClient = () => {
        if (!supabaseRef.current) supabaseRef.current = createClient();
        return supabaseRef.current;
    };

    // ─── Initial load: students + teachers ───────────────────────────────────
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const client = getClient();
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
                        const teacher = tmap[advisoryKey] || { name: '-', email: '' };
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
                const client = getClient();
                if (!client) return;

                const ids = students
                    .filter(s => String(s.grade_level).trim() === grade && String(s.section).trim() === section)
                    .map(s => s.student_id);

                if (ids.length === 0) {
                    if (mounted) {
                        setAttendanceRecords([]);
                        setFlagMap({});
                    }
                    return;
                }

                const [attRes, flagRes] = await Promise.all([
                    client
                        .from('attendance')
                        .select('student_id, scan_date, status')
                        .in('student_id', ids)
                        .gte('scan_date', startDate)
                        .lte('scan_date', endDate),
                    client
                        .from('cut_class_flags')
                        .select('student_id, flag_date')
                        .in('student_id', ids)
                        .gte('flag_date', startDate)
                        .lte('flag_date', endDate)
                ]);

                if (!mounted) return;
                if (!attRes.error) setAttendanceRecords(attRes.data || []);

                const fm = {};
                (flagRes.data || []).forEach(f => {
                    if (!fm[f.student_id]) fm[f.student_id] = {};
                    fm[f.student_id][f.flag_date] = true;
                });
                setFlagMap(fm);
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
            const flags = flagMap[s.student_id] || {};
            return {
                ...s,
                totalAbsences: Object.values(records).filter(v => v === 'Absent').length,
                totalLates: Object.values(records).filter(v => v === 'Late').length,
                flagCount: Object.keys(flags).length,
            };
        }),
        [sectionStudents, studentRecordMap, flagMap]
    );

    // ─── Toggle a cut-class flag for a student/date ─────────────────────────
    const toggleFlag = async (studentId, date) => {
        if (!studentId || !date) return;
        if (!canFlagCutClass) return;
        const key = `${studentId}|${date}`;
        if (flagBusy[key]) return;

        const wasFlagged = !!(flagMap[studentId] && flagMap[studentId][date]);

        setFlagBusy(b => ({ ...b, [key]: true }));
        setFlagMap(prev => {
            const next = { ...prev };
            const inner = { ...(next[studentId] || {}) };
            if (wasFlagged) delete inner[date];
            else inner[date] = true;
            next[studentId] = inner;
            return next;
        });

        try {
            const client = getClient();
            if (!client) throw new Error('Supabase client is not ready.');
            if (wasFlagged) {
                const { error: delErr } = await client
                    .from('cut_class_flags')
                    .delete()
                    .eq('student_id', studentId)
                    .eq('flag_date', date);
                if (delErr) throw delErr;
            } else {
                const { error: insErr } = await client
                    .from('cut_class_flags')
                    .insert({ student_id: studentId, flag_date: date });
                if (insErr) throw insErr;
            }
        } catch (err) {
            // Revert optimistic update on failure
            setFlagMap(prev => {
                const next = { ...prev };
                const inner = { ...(next[studentId] || {}) };
                if (wasFlagged) inner[date] = true;
                else delete inner[date];
                next[studentId] = inner;
                return next;
            });
            console.error('Failed to toggle cut-class flag:', err);
        } finally {
            setFlagBusy(b => {
                const c = { ...b };
                delete c[key];
                return c;
            });
        }
    };

    const donutStats = useMemo(() => {
        let present = 0, late = 0, absent = 0;
        attendanceRecords.forEach(r => {
            if (r.status === 'Present') present++;
            else if (r.status === 'Late') late++;
            else if (r.status === 'Absent') absent++;
        });
        return { present, late, absent, total: sectionStudents.length };
    }, [attendanceRecords, sectionStudents]);

    const weeklyLineData = useMemo(() => {
        if (!monthFilter) return { labels: [], data: [] };
        const [year, month] = monthFilter.split('-').map(Number);
        const weeks = getMonthWeeks(year, month);
        const presentByDate = {};
        attendanceRecords.forEach(r => {
            if (r.status === 'Present') presentByDate[r.scan_date] = (presentByDate[r.scan_date] || 0) + 1;
        });
        return {
            labels: weeks.map((_, i) => `Week ${i + 1}`),
            data: weeks.map(week => week.reduce((sum, date) => sum + (date ? (presentByDate[date] || 0) : 0), 0))
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

        donutInstance.current = new Chart(donutRef.current, {
            type: 'doughnut',
            plugins: [centerPlugin],
            data: {
                labels: ['Present', 'Late', 'Absent'],
                datasets: [{
                    data: [donutStats.present, donutStats.late, donutStats.absent],
                    backgroundColor: ['#16a34a', '#f59e0b', '#dc2626'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                layout: { padding: 8 },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 14,
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 12, family: 'Poppins, sans-serif' },
                            color: '#374151'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 10,
                        titleFont: { family: 'Poppins, sans-serif', size: 12 },
                        bodyFont: { family: 'Poppins, sans-serif', size: 12 }
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
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: '#860108',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 4, right: 8, bottom: 0, left: 0 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 10,
                        titleFont: { family: 'Poppins, sans-serif', size: 12 },
                        bodyFont: { family: 'Poppins, sans-serif', size: 12 },
                        displayColors: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f3f4f6', drawBorder: false },
                        ticks: {
                            font: { family: 'Poppins, sans-serif', size: 11 },
                            color: '#9ca3af',
                            precision: 0
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Poppins, sans-serif', size: 11 },
                            color: '#6b7280'
                        }
                    }
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
        setEmailStatus(null);
        try {
            const csvContent = generateCsvContent();
            const base64 = btoa(unescape(encodeURIComponent(csvContent)));

            await apiFetch('/api/send-report-email', {
                method: 'POST',
                body: JSON.stringify({
                    teacher_email: activeSectionInfo.adviserEmail,
                    teacher_name: activeSectionInfo.adviser,
                    section: activeSectionInfo.label,
                    month: monthFilter,
                    csv_content: base64
                })
            });

            setEmailStatus({ type: 'success', msg: `Report sent to ${activeSectionInfo.adviser} (${activeSectionInfo.adviserEmail}).` });
        } catch (err) {
            setEmailStatus({ type: 'error', msg: err.message || 'Failed to send email.' });
        } finally {
            setEmailLoading(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="reports-state reports-state--loading">
                <svg className="reports-state-spinner" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/>
                </svg>
                Loading report data…
            </div>
        );
    }

    if (error) {
        return (
            <div className="reports-state reports-state--error">
                <p style={{ fontWeight: 600, margin: 0 }}>Failed to load data</p>
                <p style={{ fontSize: 13, marginTop: 4, marginBottom: 0 }}>{error}</p>
            </div>
        );
    }

    const presentCount = donutStats.present;
    const lateCount = donutStats.late;
    const absentCount = donutStats.absent;

    return (
        <div className="reports-page">
            {/* ── FILTERS ── */}
            <div className="reports-section filters-card">
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
                            <div>
                                <span className="reports-teacher-pill">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    {activeSectionInfo.adviser}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── KPI STRIP ── */}
            <div className="reports-section reports-kpi-strip" style={{ opacity: attendanceLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <div className="dashboard-stat-card">
                    <div className="stat-icon stat-icon-total">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div className="stat-text">
                        <div className="stat-number">{sectionStudents.length}</div>
                        <div className="stat-label">Students</div>
                    </div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="stat-icon stat-icon-present">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div className="stat-text">
                        <div className="stat-number">{presentCount}</div>
                        <div className="stat-label">Present</div>
                    </div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="stat-icon stat-icon-late">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="stat-text">
                        <div className="stat-number">{lateCount}</div>
                        <div className="stat-label">Late</div>
                    </div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="stat-icon stat-icon-absent">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                    <div className="stat-text">
                        <div className="stat-number">{absentCount}</div>
                        <div className="stat-label">Absent</div>
                    </div>
                </div>
            </div>

            {/* ── CHARTS ── */}
            <div className="reports-section reports-charts-row" style={{ opacity: attendanceLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <div className="dashboard-panel animate-on-load" style={{ animationDelay: '0.1s' }}>
                    <div className="dashboard-panel-header">
                        <h3 className="dashboard-panel-title">Monthly Attendance Breakdown</h3>
                        {attendanceLoading && <span className="panel-meta">Updating…</span>}
                    </div>
                    <div className="reports-chart-frame">
                        <canvas ref={donutRef}></canvas>
                    </div>
                    {!attendanceLoading && attendanceRecords.length === 0 && (
                        <p className="reports-empty-inline">No records for this period</p>
                    )}
                </div>
                <div className="dashboard-panel animate-on-load" style={{ animationDelay: '0.15s' }}>
                    <div className="dashboard-panel-header">
                        <h3 className="dashboard-panel-title">Weekly Present Trend</h3>
                        <span className="panel-meta">{monthLabel}</span>
                    </div>
                    <div className="reports-chart-frame">
                        <canvas ref={lineRef}></canvas>
                    </div>
                </div>
            </div>

            {/* ── TOOLBAR ── */}
            {activeSectionInfo && (
                <div className="reports-section reports-toolbar">
                    <div className="reports-context-strip">
                        <div className="reports-context-item">
                            <span className="reports-context-label">Section</span>
                            <span className="reports-context-value" title={activeSectionInfo.label}>{activeSectionInfo.label}</span>
                        </div>
                        <div className="reports-context-item">
                            <span className="reports-context-label">Period</span>
                            <span className="reports-context-value" title={monthLabel}>{monthLabel}</span>
                        </div>
                        <div className="reports-context-item">
                            <span className="reports-context-label">Teacher</span>
                            <span className="reports-context-value" title={activeSectionInfo.adviser}>{activeSectionInfo.adviser}</span>
                        </div>
                    </div>
                    <div className="reports-actions">
                        <button
                            type="button"
                            className="toolbar-btn"
                            onClick={exportCSV}
                            disabled={studentRows.length === 0}
                            title="Download as CSV"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            CSV
                        </button>
                        <button
                            type="button"
                            className="toolbar-btn"
                            onClick={exportPDF}
                            disabled={studentRows.length === 0}
                            title="Export & print as PDF"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            PDF
                        </button>
                        <button
                            type="button"
                            className="toolbar-btn toolbar-btn--primary"
                            onClick={emailReport}
                            disabled={emailLoading || studentRows.length === 0}
                            title={activeSectionInfo.adviserEmail ? `Send to ${activeSectionInfo.adviserEmail}` : 'No teacher email on file'}
                        >
                            {emailLoading ? 'Sending…' : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    Email Report
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {emailStatus && (
                <div className={`reports-section reports-status-banner reports-status-banner--${emailStatus.type === 'success' ? 'success' : 'error'}`}>
                    <span>{emailStatus.msg}</span>
                    <button type="button" onClick={() => setEmailStatus(null)} aria-label="Dismiss">×</button>
                </div>
            )}

            {/* ── TABLE ── */}
            <div className="reports-section reports-table-card animate-on-load" style={{ animationDelay: '0.2s' }}>
                <div className="reports-table-header">
                    <h3>Student Attendance Summary</h3>
                    <span className="reports-table-hint">Click a row for daily breakdown</span>
                </div>

                <div className="attendance-table-container">
                    <table className="attendance-table">
                        <colgroup>
                            <col style={{ width: '46%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '4%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Student Name</th>
                                <th className="col-center">Gender</th>
                                <th className="col-center">Absences</th>
                                <th className="col-center">Lates</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceLoading ? (
                                <tr><td colSpan={5} className="reports-empty-row">Loading attendance data…</td></tr>
                            ) : studentRows.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="reports-empty-row">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                        </svg>
                                        No students found in this section.
                                    </td>
                                </tr>
                            ) : (
                                studentRows.map(s => (
                                    <tr
                                        key={s.student_id}
                                        onClick={() => setSelectedStudent(s)}
                                        className="report-row"
                                    >
                                        <td className="student-name">
                                            {s.flagCount > 0 && (
                                                <span
                                                    className="cut-class-badge"
                                                    title={`Flagged for cutting class on ${s.flagCount} day${s.flagCount === 1 ? '' : 's'} this month`}
                                                    aria-label={`Flagged for cutting class on ${s.flagCount} day${s.flagCount === 1 ? '' : 's'} this month`}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>
                                                    </svg>
                                                    <span className="cut-class-badge-count">{s.flagCount}</span>
                                                </span>
                                            )}
                                            {s.last_name}, {s.first_name}
                                        </td>
                                        <td className="col-center gender-cell">{s.gender || '—'}</td>
                                        <td className="col-center">
                                            <span className={`count-pill ${s.totalAbsences > 0 ? 'count-pill--absent' : ''}`}>
                                                {s.totalAbsences}
                                            </span>
                                        </td>
                                        <td className="col-center">
                                            <span className={`count-pill ${s.totalLates > 0 ? 'count-pill--late' : ''}`}>
                                                {s.totalLates}
                                            </span>
                                        </td>
                                        <td className="col-center"><span className="chevron">›</span></td>
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
                    className="reports-modal-overlay"
                    onClick={e => { if (e.target === e.currentTarget) setSelectedStudent(null); }}
                >
                    <div className="reports-modal" role="dialog" aria-modal="true">
                        <div className="reports-modal-header">
                            <div>
                                <h2 className="reports-modal-title">{selectedStudent.last_name}, {selectedStudent.first_name}</h2>
                                <p className="reports-modal-subtitle">
                                    {activeSectionInfo?.label} · {monthLabel} · {selectedStudent.gender || '—'}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="reports-modal-close"
                                onClick={() => setSelectedStudent(null)}
                                aria-label="Close"
                            >×</button>
                        </div>

                        <div className="reports-modal-pills">
                            {[
                                { key: 'present', label: 'Present', count: Object.values(studentRecordMap[selectedStudent.student_id] || {}).filter(v => v === 'Present').length },
                                { key: 'late', label: 'Late', count: selectedStudent.totalLates },
                                { key: 'absent', label: 'Absent', count: selectedStudent.totalAbsences },
                                { key: 'flagged', label: 'Cut Class', count: Object.keys(flagMap[selectedStudent.student_id] || {}).length },
                            ].map(({ key, label, count }) => (
                                <div key={key} className={`reports-modal-pill reports-modal-pill--${key}`}>
                                    <div className="num">{count}</div>
                                    <div className="label">{label}</div>
                                </div>
                            ))}
                        </div>

                        {canFlagCutClass ? (
                            <p className="reports-modal-hint">
                                Click a day to flag/unflag it as a cut-class incident.
                            </p>
                        ) : (
                            <p className="reports-modal-hint">
                                Cut-class flags are managed by section teachers. Admins can view but not edit them here.
                            </p>
                        )}

                        <div className="reports-calendar">
                            {monthWeeks.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20, margin: 0 }}>No school days found for this month.</p>
                            ) : (
                                <div className="reports-calendar-grid">
                                    <div className="reports-calendar-head">Week</div>
                                    {DAY_LABELS.map(d => <div key={d} className="reports-calendar-head">{d}</div>)}

                                    {monthWeeks.map((week, wi) => {
                                        const records = studentRecordMap[selectedStudent.student_id] || {};
                                        const studentFlags = flagMap[selectedStudent.student_id] || {};
                                        return (
                                            <React.Fragment key={wi}>
                                                <div className="reports-calendar-week-label">W{wi + 1}</div>
                                                {week.map((date, di) => {
                                                    const status = date ? records[date] : null;
                                                    let modifier = 'empty';
                                                    let label = '';
                                                    if (date) {
                                                        if (status === 'Present') { modifier = 'present'; label = 'P'; }
                                                        else if (status === 'Late') { modifier = 'late'; label = 'L'; }
                                                        else if (status === 'Absent') { modifier = 'absent'; label = 'A'; }
                                                        else { modifier = 'norecord'; label = '·'; }
                                                    }
                                                    const dayNum = date ? date.split('-')[2] : '';
                                                    const isFlagged = !!(date && studentFlags[date]);
                                                    const busyKey = date ? `${selectedStudent.student_id}|${date}` : '';
                                                    const isBusy = !!flagBusy[busyKey];
                                                    const cellInteractive = !!date && canFlagCutClass;
                                                    const classes = [
                                                        'reports-calendar-cell',
                                                        `reports-calendar-cell--${modifier}`,
                                                        cellInteractive ? 'reports-calendar-cell--clickable' : '',
                                                        isFlagged ? 'reports-calendar-cell--flagged' : '',
                                                        isBusy ? 'reports-calendar-cell--busy' : '',
                                                    ].filter(Boolean).join(' ');
                                                    const titleParts = date
                                                        ? [
                                                            `${date}: ${status || 'No record'}`,
                                                            isFlagged
                                                                ? 'Flagged: cut class'
                                                                : (canFlagCutClass ? 'Click to flag as cut class' : '')
                                                          ].filter(Boolean)
                                                        : [];
                                                    return (
                                                        <div
                                                            key={di}
                                                            className={classes}
                                                            title={titleParts.join(' • ')}
                                                            role={cellInteractive ? 'button' : undefined}
                                                            tabIndex={cellInteractive ? 0 : undefined}
                                                            onClick={cellInteractive ? () => toggleFlag(selectedStudent.student_id, date) : undefined}
                                                            onKeyDown={cellInteractive ? (e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    toggleFlag(selectedStudent.student_id, date);
                                                                }
                                                            } : undefined}
                                                        >
                                                            {isFlagged && (
                                                                <span className="reports-calendar-flag" aria-hidden="true">
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                                                        <path d="M4 22V4h13l-2 4 2 4H4"/>
                                                                    </svg>
                                                                </span>
                                                            )}
                                                            <div className="day">{dayNum || '·'}</div>
                                                            <div className="mark">{label || '·'}</div>
                                                        </div>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="reports-calendar-legend">
                                <span className="reports-calendar-legend-item" style={{ color: '#15803d' }}>
                                    <span className="reports-calendar-legend-swatch" style={{ background: '#dcfce7' }} />
                                    P – Present
                                </span>
                                <span className="reports-calendar-legend-item" style={{ color: '#d97706' }}>
                                    <span className="reports-calendar-legend-swatch" style={{ background: '#fef3c7' }} />
                                    L – Late
                                </span>
                                <span className="reports-calendar-legend-item" style={{ color: '#dc2626' }}>
                                    <span className="reports-calendar-legend-swatch" style={{ background: '#fee2e2' }} />
                                    A – Absent
                                </span>
                                <span className="reports-calendar-legend-item" style={{ color: '#9ca3af' }}>
                                    <span className="reports-calendar-legend-swatch" style={{ background: '#fafafa' }} />
                                    · – No record
                                </span>
                                <span className="reports-calendar-legend-item" style={{ color: '#b45309' }}>
                                    <span className="reports-calendar-legend-swatch reports-calendar-legend-swatch--flag">
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M4 22V4h13l-2 4 2 4H4"/></svg>
                                    </span>
                                    ⚑ – Cut class (teacher flag)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
