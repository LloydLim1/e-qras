# E-QRAS — QR Attendance System

A school attendance system using QR codes. Built with **Next.js** (frontend) and **NestJS** (backend), backed by **Supabase**.

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- A [Supabase](https://supabase.com/) project with the required tables (`students`, `attendance`, `settings`)

---

## Project Structure

```
SE2-3/
├── frontend/   # Next.js app (port 3000)
└── backend/    # NestJS app (port 4000)
```

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/claireabass/SE2.git
cd SE2
```

### 2. Configure environment variables

#### Frontend — create `frontend/.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

#### Backend — create `backend/.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=a_long_random_secret_at_least_32_characters
JWT_EXPIRES_IN_MINUTES=15
CORS_ORIGIN=http://localhost:3000
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=no-reply@yourdomain.com
SMTP_SECURE=false
SMTP_TLS_REJECT_UNAUTHORIZED=true
```

### 3. Install dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

---

## Running Locally

Open **two terminals**:

**Terminal 1 — Frontend**
```bash
cd frontend
npm run dev
```
Runs at → http://localhost:3000

**Terminal 2 — Backend**
```bash
cd backend
npm run start:dev
```
Runs at → http://localhost:4000

> The frontend automatically proxies `/api/*` requests to the backend via Next.js rewrites — no manual CORS setup needed.

---

## Supabase Tables

The app expects the following tables in your Supabase project:

| Table        | Key columns                                                                 |
|--------------|-----------------------------------------------------------------------------|
| `students`   | `student_id`, `first_name`, `last_name`, `grade_level`, `section`, `valid_until`, `parent_email` |
| `attendance` | `student_id`, `scan_date`, `time_in`, `status`, `section`                  |
| `settings`   | `key`, `value` (keys: `late_threshold`, `end_class_time`)                  |

---

## Features

- QR code generation per student (linked to LRN)
- Webcam-based QR scanning with live video feed
- Hardware scanner support (USB barcode/QR gun via keyboard input)
- Automatic attendance status: Present / Late / Absent
- Parent email notification on scan
- Print individual or bulk student QR ID cards
- Filter students by section and grade

---

## API Notes

- `GET /api/students?page=1&limit=100&search=abc` returns paginated students and metadata (`total`, `hasMore`).
- `GET /api/students/summary` returns aggregate metrics for dashboards:
  - total/active/inactive students
  - today attendance counters
  - recent attendance volume by date

---

## Production Hardening Checklist

1. Run database performance indexes in Supabase SQL editor:
	- `backend/sql/01_performance_indexes.sql`
2. Set strong backend env values:
	- `JWT_SECRET` must be long and random (>= 32 chars)
	- `CORS_ORIGIN` must include only trusted frontend origin(s)
	- all SMTP variables must be real values for OTP/attendance email endpoints
3. Keep backend throttling enabled (`@nestjs/throttler`) to reduce abuse.
4. Keep Helmet and DTO validation enabled (already configured in NestJS bootstrap).

---

## Deploy (Vercel + Render)

### Frontend on Vercel

1. Import `frontend` as the project root in Vercel.
2. Set env vars:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `NEXT_PUBLIC_BACKEND_URL` (your Render backend URL)
3. Build command: `npm run build`
4. Output: Next.js default output.

### Backend on Render

1. Create a new Web Service with root directory `backend`.
2. Build command: `npm install && npm run build`
3. Start command: `npm run start:prod`
4. Set all backend env vars from `backend/.env.example` plus your real values.
5. Set `CORS_ORIGIN` to your Vercel domain (and local URL if needed for testing).

### Post-deploy smoke tests

1. `GET /api/students?page=1&limit=10`
2. `GET /api/students/summary`
3. OTP endpoint with a test account (only after SMTP is configured)

---

## Load Balancer Setup (Nginx + 3 NestJS Replicas)

This repo now includes a production-style backend load balancer stack:

- `docker-compose.loadbalancer.yml`
- `infra/nginx/eqras-lb.conf`
- `backend/Dockerfile`

### Run locally with load balancing

1. Ensure Docker Desktop is running.
2. From project root, run:

```bash
docker compose -f docker-compose.loadbalancer.yml up --build -d
```

3. Test health:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
```

4. Test API through the load balancer:

```bash
curl "http://localhost:4000/api/students?page=1&limit=20"
```

5. Stop stack:

```bash
docker compose -f docker-compose.loadbalancer.yml down
```

### Notes

- Nginx uses `least_conn` upstream balancing across `backend1`, `backend2`, and `backend3`.
- The backend is now proxy-aware (`trust proxy`) and exposes `GET /health/ready` for readiness checks.
- `GET /api/students/summary` includes short server-side caching to reduce repeated Supabase load.
