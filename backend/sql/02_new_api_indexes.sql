-- Run in Supabase SQL Editor (safe to run multiple times).
-- Additional indexes to support attendance scanning, reporting, and user login.

-- Attendance: fast lookup by student_id alone (for per-student history)
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance (student_id);

-- Attendance: support date-range report queries
CREATE INDEX IF NOT EXISTS idx_attendance_scan_date_range ON public.attendance (scan_date, student_id, status);

-- Users: fast login lookup by email
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- Students: fast lookup by student_id (QR scan path)
-- (Already covered by 01_performance_indexes.sql but added here for completeness)
-- CREATE INDEX IF NOT EXISTS idx_students_student_id ON public.students (student_id);
