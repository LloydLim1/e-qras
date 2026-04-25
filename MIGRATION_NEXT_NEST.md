# E-QRAS Migration Structure

This folder now contains the converted stack while preserving your existing PHP files as legacy reference.

## New structure

- `frontend/` - Next.js frontend (keeps existing UI design and Supabase client behavior)
- `backend/` - Nest.js backend (replaces PHP API endpoints)
- `frontend/src/legacy/pages/` - migrated React page logic from `react-pages/`
- `frontend/public/legacy/script.js` - legacy dashboard behavior script

## Hardware scanner update

- Camera QR scanning has been replaced in:
  - `frontend/src/legacy/pages/qr_scanner.jsx`
- The scanner page now accepts hardware scanner input (keyboard-wedge style), keeping the same page layout style.

## API compatibility

Nest backend keeps the old PHP endpoint names for compatibility:

- `POST /api/generate_token.php`
- `POST /api/complete_reset.php`
- `POST /api/send_otp.php`
- `POST /api/send_attendance_email.php`

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Run backend

```bash
cd backend
npm install
npm run start:dev
```

Backend runs on `http://localhost:4000`.

## Environment setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set SMTP values in `backend/.env`.
3. Keep Supabase URL/key aligned with your current project values.

## Notes

- Existing design classes and CSS are preserved through `frontend/app/globals.css`.
- Existing PHP files remain untouched so you can compare behavior during migration.
