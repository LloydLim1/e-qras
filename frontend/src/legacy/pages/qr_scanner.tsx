// @ts-nocheck
import React from 'react';

function formatPhilippineDateParts(now) {
  const dateString = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
  const timeString = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    timeStyle: 'medium',
    hour12: true
  }).format(now);

  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric'
  }).formatToParts(now);

  const hour = parseInt(timeParts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(timeParts.find((p) => p.type === 'minute')?.value || '0', 10);

  return { dateString, timeString, hour, minute };
}

export default function QrScannerApp() {
  const [dbStatus, setDbStatus] = React.useState({ text: 'Checking Database Connection...', color: '#6b7280' });
  const [scanMode, setScanMode] = React.useState('webcam');
  const [cameraActive, setCameraActive] = React.useState(false);
  const [cameraError, setCameraError] = React.useState('');
  const [debugText, setDebugText] = React.useState('Waiting for scan...');
  const [stateView, setStateView] = React.useState('idle');
  const [hwBuffer, setHwBuffer] = React.useState('');
  const [hwPaused, setHwPaused] = React.useState(false);

  const [successView, setSuccessView] = React.useState({ studentName: '--', status: '--', time: '--', date: '--', section: '--', grade: '--' });
  const [errorView, setErrorView] = React.useState({ title: 'Error', message: '--' });
  const [alreadyView, setAlreadyView] = React.useState({ studentName: '--', status: '--', time: '--', date: '--', section: '--', grade: '--' });

  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const animFrameRef = React.useRef(null);
  const processingRef = React.useRef(false);
  const resetTimerRef = React.useRef(null);
  const lastScannedRef = React.useRef(null);
  const scanCooldownRef = React.useRef(0);
  const hwBufferRef = React.useRef('');
  const hwTimerRef = React.useRef(null);
  const soundRefs = React.useRef({ already: null, success: null, error: null });

  // ── Sounds ──────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    soundRefs.current.already = Object.assign(new Audio('/sounds/Scanned.mp3'), { preload: 'auto' });
    soundRefs.current.success = Object.assign(new Audio('/sounds/Success.mp3'), { preload: 'auto' });
    soundRefs.current.error   = Object.assign(new Audio('/sounds/Failed.mp3'), { preload: 'auto' });
  }, []);

  const playSound = React.useCallback((type) => {
    const s = soundRefs.current[type];
    if (!s) return;
    s.currentTime = 0;
    s.play().catch(() => {});
  }, []);

  // ── DB status ────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    let mounted = true;
    async function check() {
      const client = window.supabaseClient;
      if (!client) {
        if (mounted) setDbStatus({ text: 'Supabase Client Missing', color: '#dc2626' });
        return;
      }
      try {
        const { data, error } = await client.from('students').select('student_id').limit(1);
        if (!mounted) return;
        if (error) {
          setDbStatus({ text: `Database Error: ${error.message}`, color: '#dc2626' });
        } else if (!data?.length) {
          setDbStatus({ text: 'Connected — table "students" is empty.', color: '#ca8a04' });
        } else {
          setDbStatus({ text: 'Database Connected. Ready to scan.', color: '#16a34a' });
        }
      } catch (e) {
        if (mounted) setDbStatus({ text: `Connection Failed: ${e.message}`, color: '#dc2626' });
      }
    }
    check();
    return () => { mounted = false; if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, []);

  // ── Stop camera when leaving webcam mode ────────────────────────────────────
  React.useEffect(() => {
    if (scanMode !== 'webcam') stopCamera();
  }, [scanMode]);

  // ── Core scan processor (shared by both modes) ───────────────────────────────
  const processHardwareScan = React.useCallback(async (rawValue) => {
    const studentId = String(rawValue || '').trim();
    if (studentId.length <= 2) return;
    if (processingRef.current) return;
    if (studentId === lastScannedRef.current && Date.now() < scanCooldownRef.current) {
      return;
    }

    processingRef.current = true;
    setDebugText(`Processing: ${studentId}`);

    const client = window.supabaseClient;
    if (!client) {
      playSound('error');
      setErrorView({ title: 'Connection Error', message: 'Supabase client unavailable. Refresh and try again.' });
      setStateView('error');
      queueIdle();
      processingRef.current = false;
      return;
    }

    try {
      const now = new Date();
      const { dateString, timeString, hour, minute } = formatPhilippineDateParts(now);

      const { data: student } = await client.from('students').select('*').eq('student_id', studentId).maybeSingle();
      if (!student) {
        lastScannedRef.current = studentId;
        scanCooldownRef.current = Date.now() + 3_000;
        playSound('error');
        setErrorView({ title: 'ID Not Found', message: `No record found for: "${studentId}"` });
        setStateView('error');
        queueIdle();
        processingRef.current = false;
        return;
      }

      if (student.valid_until) {
        const today = new Date(dateString);
        if (today > new Date(student.valid_until)) {
          lastScannedRef.current = studentId;
          scanCooldownRef.current = Date.now() + 3_000;
          playSound('error');
          setErrorView({ title: 'QR Expired', message: `Expired on ${student.valid_until}. Contact administrator.` });
          setStateView('error');
          queueIdle();
          processingRef.current = false;
          return;
        }
      }

      const { data: existing } = await client.from('attendance').select('*').eq('student_id', studentId).eq('scan_date', dateString).maybeSingle();
      if (existing) {
        lastScannedRef.current = studentId;
        scanCooldownRef.current = Date.now() + 8_000;
        playSound('already');
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
        setAlreadyView({ studentName: fullName || studentId, status: existing.status || '--', time: existing.time_in || '--', date: existing.scan_date || dateString, section: student.section || '--', grade: student.grade_level || '--' });
        setStateView('already');
        queueIdle(5000);
        processingRef.current = false;
        return;
      }

      let status = 'Present';
      let limitHour = 7, limitMinute = 30, endHour = 17, endMinute = 0;
      try {
        const { data: lD } = await client.from('settings').select('value').eq('key', 'late_threshold').maybeSingle();
        if (lD?.value) { const p = String(lD.value).split(':'); limitHour = +p[0]; limitMinute = +p[1]; }
        const { data: eD } = await client.from('settings').select('value').eq('key', 'end_class_time').maybeSingle();
        if (eD?.value) { const p = String(eD.value).split(':'); endHour = +p[0]; endMinute = +p[1]; }
      } catch (_) {}

      if (hour > endHour || (hour === endHour && minute > endMinute)) status = 'Absent';
      else if (hour > limitHour || (hour === limitHour && minute > limitMinute)) status = 'Late';

      const { error: insertError } = await client.from('attendance').insert({ student_id: studentId, scan_date: dateString, time_in: timeString, status, section: student.section });
      if (insertError) throw insertError;

      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      setSuccessView({ studentName: fullName || studentId, status, time: timeString, date: dateString, section: student.section || '--', grade: student.grade_level || '--' });
      playSound('success');
      setStateView('success');

      if (student.parent_email) {
        (async () => {
          try {
            const sc = (window as any).supabaseClient;
            const token = sc ? (await sc.auth.getSession()).data?.session?.access_token : null;
            const res = await fetch('/api/send_attendance_email.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ parent_email: student.parent_email, student_name: fullName, status, time_in: timeString }),
            });
            const r = await res.json();
            if (!r.success) console.error('Email failed:', r.error);
          } catch (e) { console.error('Email error:', e); }
        })();
      }

      lastScannedRef.current = studentId;
      scanCooldownRef.current = Date.now() + 10_000;
      queueIdle(5000);
    } catch (err) {
      console.error('Scan error:', err);
      playSound('error');
      setErrorView({ title: 'System Error', message: err.message || 'Unexpected error.' });
      setStateView('error');
      queueIdle();
    } finally {
      processingRef.current = false;
    }
  }, [playSound]); // eslint-disable-line

  function queueIdle(delay = 1200) {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setStateView('idle');
      setDebugText('Waiting for scan...');
      setHwPaused(false);
    }, delay);
  }

  // ── Hardware mode: global keydown listener ───────────────────────────────────
  React.useEffect(() => {
    if (scanMode !== 'hardware' || hwPaused) return;

    function onKeyDown(e) {
      if (processingRef.current) return;
      if (e.key === 'Enter') {
        const val = hwBufferRef.current.trim();
        hwBufferRef.current = '';
        setHwBuffer('');
        if (hwTimerRef.current) clearTimeout(hwTimerRef.current);
        if (val) processHardwareScan(val);
        return;
      }
      if (e.key.length === 1) {
        hwBufferRef.current += e.key;
        setHwBuffer(hwBufferRef.current);
        if (hwTimerRef.current) clearTimeout(hwTimerRef.current);
        hwTimerRef.current = setTimeout(() => {
          const val = hwBufferRef.current.trim();
          hwBufferRef.current = '';
          setHwBuffer('');
          if (val.length > 2) processHardwareScan(val);
        }, 80);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scanMode, hwPaused, processHardwareScan]);

  // ── Webcam scanning loop ─────────────────────────────────────────────────────
  const scanFrame = React.useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (!processingRef.current) {
      try {
        const jsQR = (await import('jsqr')).default;
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) processHardwareScan(code.data);
      } catch (_) {}
    }
    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [processHardwareScan]);

  React.useEffect(() => {
    if (!cameraActive) return;
    animFrameRef.current = requestAnimationFrame(scanFrame);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [cameraActive, scanFrame]);

  async function startCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
      setDebugText('Webcam active — point at a QR code...');
    } catch (err) {
      setCameraError(`Camera error: ${err.message}`);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setDebugText('Waiting for scan...');
  }

  const bannerClass = React.useMemo(() => {
    const s = String(successView.status || '').toLowerCase();
    if (s === 'absent') return 'qs-result-banner--absent';
    if (s === 'late')   return 'qs-result-banner--late';
    return 'qs-result-banner--present';
  }, [successView.status]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="qs-layout">

      {/* ── Left: Scanner Card ── */}
      <div className="qs-card">
        <div className="qs-card-header">
          <h2 className="qs-title">Attendance Scanner</h2>
          <div className="qs-db-status">
            <span className="qs-db-dot" style={{ background: dbStatus.color }} />
            <span className="qs-db-text" style={{ color: dbStatus.color }}>{dbStatus.text}</span>
          </div>
        </div>

        {/* ── Mode toggle ── */}
        <div className="qs-mode-toggle">
          <button
            type="button"
            className={`qs-mode-btn${scanMode === 'webcam' ? ' qs-mode-btn--active' : ''}`}
            onClick={() => setScanMode('webcam')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
            Webcam
          </button>
          <button
            type="button"
            className={`qs-mode-btn${scanMode === 'hardware' ? ' qs-mode-btn--active' : ''}`}
            onClick={() => setScanMode('hardware')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="5" height="5" x="3" y="3" rx="1"/>
              <rect width="5" height="5" x="16" y="3" rx="1"/>
              <rect width="5" height="5" x="3" y="16" rx="1"/>
              <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/>
              <path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/>
              <path d="M12 3h.01"/><path d="M12 16v.01"/>
              <path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
            </svg>
            Hardware
          </button>
        </div>

        {/* ── Webcam mode ── */}
        {scanMode === 'webcam' && (
          <div className="qs-webcam-area">
            <div className="qs-scanner-frame">
              <video ref={videoRef} playsInline muted className="qs-video" style={{ display: cameraActive ? 'block' : 'none' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {!cameraActive && (
                <div className="qs-camera-placeholder">
                  <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                  <p>Camera not started</p>
                </div>
              )}

              <div className="qs-scan-overlay">
                <div className="qs-corners">
                  <div className="qs-corner qs-corner--tl" />
                  <div className="qs-corner qs-corner--tr" />
                  <div className="qs-corner qs-corner--bl" />
                  <div className="qs-corner qs-corner--br" />
                </div>
                {cameraActive && <div className="qs-scan-line" />}
              </div>
            </div>

            {cameraError && <p className="qs-camera-error">{cameraError}</p>}

            <button
              type="button"
              onClick={cameraActive ? stopCamera : startCamera}
              className={`qs-camera-btn${cameraActive ? ' qs-camera-btn--stop' : ' qs-camera-btn--start'}`}
            >
              {cameraActive ? 'Stop Camera' : 'Open Camera'}
            </button>
          </div>
        )}

        {/* ── Hardware mode ── */}
        {scanMode === 'hardware' && (
          <div className="qs-hw-area">
            <div className="qs-hw-body">
              <div className={`qs-hw-indicator${hwPaused ? ' qs-hw-indicator--paused' : ' qs-hw-indicator--active'}`}>
                {!hwPaused && <><div className="qs-hw-ring" /><div className="qs-hw-ring qs-hw-ring--delay" /></>}
                <div className="qs-hw-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="5" height="5" x="3" y="3" rx="1"/>
                    <rect width="5" height="5" x="16" y="3" rx="1"/>
                    <rect width="5" height="5" x="3" y="16" rx="1"/>
                    <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/>
                    <path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/>
                    <path d="M12 3h.01"/><path d="M12 16v.01"/>
                    <path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                  </svg>
                </div>
              </div>

              <div>
                <h3 className="qs-hw-title">Hardware Scanner</h3>
                <p className={`qs-hw-status${!hwPaused ? ' qs-hw-status--active' : ''}`}>
                  {hwPaused ? 'Scanner paused' : 'Listening for input...'}
                </p>
              </div>

              <p className="qs-hw-hint">
                Connect a USB barcode gun and scan a student QR card. The scanner sends input automatically.
              </p>

              {hwBuffer && <div className="qs-hw-buffer">{hwBuffer}</div>}
            </div>

            <div className="qs-hw-footer">
              {hwPaused ? (
                <button
                  type="button"
                  className="qs-btn-resume"
                  onClick={() => { setHwPaused(false); setDebugText('Waiting for scan...'); }}
                >
                  Resume Scanner
                </button>
              ) : (
                <button
                  type="button"
                  className="qs-btn-pause"
                  onClick={() => { setHwPaused(true); setDebugText('Scanner paused.'); }}
                >
                  Pause Scanner
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Results Panel ── */}
      <div className="qs-result-panel">

        {stateView === 'idle' && (
          <div className="qs-result-idle">
            <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h3>Awaiting scan</h3>
            <p>
              {scanMode === 'webcam'
                ? 'Point the camera at a student QR card'
                : 'Ready for hardware scanner input'}
            </p>
          </div>
        )}

        {stateView === 'success' && (
          <div className="qs-result-card qs-result-card--anim">
            <div className={`qs-result-banner ${bannerClass}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {successView.status}
            </div>
            <div className="qs-result-body">
              <h3 className="qs-result-name">{successView.studentName}</h3>
              <div className="qs-result-meta">
                <div className="qs-result-row">
                  <span className="qs-result-label">Section</span>
                  <span className="qs-result-value">{successView.section} — Grade {successView.grade}</span>
                </div>
                <div className="qs-result-row">
                  <span className="qs-result-label">Time</span>
                  <span className="qs-result-value">{successView.time}</span>
                </div>
                <div className="qs-result-row">
                  <span className="qs-result-label">Date</span>
                  <span className="qs-result-value">{successView.date}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {stateView === 'error' && (
          <div className="qs-result-card qs-result-card--anim">
            <div className="qs-result-banner qs-result-banner--error">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {errorView.title}
            </div>
            <div className="qs-result-body">
              <p className="qs-result-msg">{errorView.message}</p>
            </div>
          </div>
        )}

        {stateView === 'already' && (
          <div className="qs-result-card qs-result-card--anim">
            <div className="qs-result-banner qs-result-banner--already">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Already Scanned — {alreadyView.status}
            </div>
            <div className="qs-result-body">
              <h3 className="qs-result-name">{alreadyView.studentName}</h3>
              <div className="qs-result-meta">
                <div className="qs-result-row">
                  <span className="qs-result-label">Section</span>
                  <span className="qs-result-value">{alreadyView.section} — Grade {alreadyView.grade}</span>
                </div>
                <div className="qs-result-row">
                  <span className="qs-result-label">Time</span>
                  <span className="qs-result-value">{alreadyView.time}</span>
                </div>
                <div className="qs-result-row">
                  <span className="qs-result-label">Date</span>
                  <span className="qs-result-value">{alreadyView.date}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

