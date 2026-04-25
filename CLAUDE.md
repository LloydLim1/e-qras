# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**E-QRAS** — QR-based school attendance system (Emmaus QR Attendance System). Students get QR cards; teachers scan them via webcam or USB barcode gun to mark attendance. Parents receive email notifications on each scan.

## Commands

### Frontend (Next.js, port 3000)
```bash
cd frontend
npm install
npm run dev       # development
npm run build     # production build
npm start         # run production build
npm run lint
```

### Backend (NestJS, port 4000)
```bash
cd backend
npm install
npm run start:dev   # development with watch
npm run build       # compile TypeScript → dist/
npm run start       # run compiled output
```

### Environment Setup
Copy `.env.example` to `.env` in both `frontend/` and `backend/` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (backend)
- SMTP credentials for email notifications (backend)

## Architecture

**Monorepo** with two separate npm projects: `frontend/` and `backend/`.

### Frontend (Next.js App Router)
- `app/` — Next.js route pages (thin wrappers)
- `src/legacy/pages/` — actual page logic as React components (migrated from PHP/legacy React)
- `src/components/` — shared components (auth guard, Supabase bootstrap, barcode renderer)
- `next.config.js` — rewrites `/api/*` transparently to backend at `localhost:4000`

The Supabase client is initialized once in `SupabaseBootstrap.jsx` and exposed as `window.supabaseClient`. Most pages access the database directly from the frontend (not through the backend).

### Backend (NestJS)
Single module (`api/`) with one controller and one service:
- `api.controller.ts` — HTTP endpoints mimicking old PHP filenames (e.g., `/api/send_attendance_email.php`)
- `api.service.ts` — JWT generation (for password reset), OTP email, and attendance notification email via Nodemailer

The backend only handles **email and auth token** flows; all attendance/student CRUD goes directly to Supabase from the frontend.

### Database (Supabase / PostgreSQL)
Key tables:
- `students` — `student_id`, `first_name`, `last_name`, `grade_level`, `section`, `valid_until`, `parent_email`
- `attendance` — `student_id`, `scan_date`, `time_in`, `status`, `section`
- `settings` — key/value store for `late_threshold` and `end_class_time`

### QR Scanning (`src/legacy/pages/qr_scanner.jsx`)
Two input modes:
1. **Webcam** — `jsqr` decodes frames from a `<video>` element via canvas
2. **Hardware scanner (USB barcode gun)** — keyboard-wedge input captured via `keydown` listener

Attendance logic runs entirely on the frontend: duplicate scan detection, late/present/absent classification, Supabase insert, then a backend API call to send the parent email.

### QR Card Printing (`app/(dashboard)/student-qrs/`)
Bulk QR card generation and print layout using the `qrcode` library and `JsBarcode`.
