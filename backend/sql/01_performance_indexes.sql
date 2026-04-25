-- Run in Supabase SQL Editor (safe to run multiple times).
-- These indexes improve student search/filter, attendance lookups, and settings reads.

CREATE INDEX IF NOT EXISTS idx_students_student_id ON public.students (student_id);
CREATE INDEX IF NOT EXISTS idx_students_last_name ON public.students (last_name);
CREATE INDEX IF NOT EXISTS idx_students_grade_section ON public.students (grade_level, section);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students (status);

CREATE INDEX IF NOT EXISTS idx_attendance_scan_date ON public.attendance (scan_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_scan_date ON public.attendance (student_id, scan_date);
CREATE INDEX IF NOT EXISTS idx_attendance_section_scan_date ON public.attendance (section, scan_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status_scan_date ON public.attendance (status, scan_date);

CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings (key);
