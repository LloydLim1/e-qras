# E-QRAS Entity Relationship Diagram

## Main ER Diagram

```plantuml
@startuml E-QRAS_ERD
!theme plain
skinparam backgroundColor #ffffff
skinparam roundcornermode adaptive

entity "users" as users {
    * user_id : UUID <<PK>>
    --
    email : VARCHAR(255) <<UNIQUE>>
    password_hash : VARCHAR(255)
    name : VARCHAR(255)
    role : ENUM(admin, teacher, security_guard)
    created_at : TIMESTAMP
    updated_at : TIMESTAMP
    is_active : BOOLEAN
}

entity "students" as students {
    * student_id : UUID <<PK>>
    --
    first_name : VARCHAR(255)
    last_name : VARCHAR(255)
    grade_level : INT
    section : VARCHAR(50)
    parent_email : VARCHAR(255)
    parent_phone : VARCHAR(20)
    qr_code_data : TEXT
    valid_until : DATE
    created_at : TIMESTAMP
    updated_at : TIMESTAMP
    is_active : BOOLEAN
}

entity "sections" as sections {
    * section_id : UUID <<PK>>
    --
    section_name : VARCHAR(50) <<UNIQUE>>
    grade_level : INT
    teacher_id : UUID <<FK>>
    room_number : VARCHAR(50)
    created_at : TIMESTAMP
}

entity "attendance" as attendance {
    * attendance_id : UUID <<PK>>
    --
    student_id : UUID <<FK>>
    section : VARCHAR(50)
    scan_date : DATE
    time_in : TIME
    time_out : TIME (NULL)
    status : ENUM(present, late, absent, excused)
    entry_type : ENUM(class, entry, exit) (NULL)
    marked_by : UUID <<FK>>
    scanned_at : TIMESTAMP
    is_manual : BOOLEAN
    notes : TEXT (NULL)
}

entity "settings" as settings {
    * setting_id : UUID <<PK>>
    --
    setting_key : VARCHAR(100) <<UNIQUE>>
    setting_value : TEXT
    updated_at : TIMESTAMP
    updated_by : UUID <<FK>>
}

entity "qr_codes" as qr_codes {
    * qr_code_id : UUID <<PK>>
    --
    student_id : UUID <<FK>>
    qr_data : TEXT
    barcode_data : VARCHAR(255)
    generated_at : TIMESTAMP
    generated_by : UUID <<FK>>
    is_active : BOOLEAN
}

entity "audit_logs" as audit_logs {
    * log_id : UUID <<PK>>
    --
    user_id : UUID <<FK>>
    action : VARCHAR(100)
    table_name : VARCHAR(50)
    record_id : UUID
    old_values : JSONB (NULL)
    new_values : JSONB (NULL)
    timestamp : TIMESTAMP
}

entity "email_notifications" as email_notifications {
    * notification_id : UUID <<PK>>
    --
    student_id : UUID <<FK>>
    parent_email : VARCHAR(255)
    attendance_id : UUID <<FK>>
    email_type : ENUM(scan_alert, correction_alert)
    status : ENUM(pending, sent, failed)
    sent_at : TIMESTAMP (NULL)
    retry_count : INT
    error_message : TEXT (NULL)
    created_at : TIMESTAMP
}

' Relationships
users ||--o{ sections : teaches
users ||--o{ attendance : marks
users ||--o{ qr_codes : generates
users ||--o{ settings : updates
users ||--o{ audit_logs : performs

students ||--o{ attendance : has
students ||--o{ qr_codes : owns
students ||--o{ email_notifications : receives

sections ||--o{ attendance : "records for"
sections ||--|| students : "contains"

attendance ||--o{ email_notifications : triggers

@enduml
```

---

## Table Schema Details

### `users` Table
**Role-Based Access Control**
```
- admin: Full system access, manage users, configure settings
- teacher: Scan QR for class, view class attendance, mark manually
- security_guard: Scan QR at gates, view entry/exit logs
```

### `students` Table
**Core student data**
- `qr_code_data`: Encoded student ID for scanning
- `valid_until`: When the student's QR card expires
- `parent_email`: Primary contact for attendance notifications

### `sections` Table
**Class/Section management**
- Maps students to classes
- Links to teacher responsible for the section
- Used for attendance filtering and reporting

### `attendance` Table
**Multi-purpose attendance tracking**
- Handles both class attendance and gate entry/exit
- `entry_type`: Distinguishes between class scans (NULL) and gate entry/exit
- `marked_by`: Teacher/Guard who performed the scan
- `is_manual`: Flag for manually corrected records
- Stores timestamps for late/on-time/absent classification

### `settings` Table
**System configuration (key-value store)**
```
Examples:
- late_threshold: "08:15" (time)
- end_class_time: "08:45" (time)
- email_enabled: "true"
- notification_delay: "300" (seconds)
```

### `qr_codes` Table
**QR code generation tracking**
- Tracks who generated QR codes and when
- Supports regenerating QR codes if needed
- Maintains both QR and barcode data

### `audit_logs` Table
**Audit trail for compliance**
- Records all changes to attendance
- Stores old/new values as JSONB
- Enables tracing corrections and manual overrides

### `email_notifications` Table
**Email delivery tracking**
- Tracks email status (pending, sent, failed)
- Supports retry logic for failed emails
- Logs error messages for debugging

---

## Key Relationships

| From | To | Cardinality | Description |
|------|-----|-------------|-------------|
| `users` | `sections` | 1:N | One teacher → Many sections |
| `users` | `attendance` | 1:N | One user → Many attendance records (marked_by) |
| `users` | `settings` | 1:N | One admin → Many config changes |
| `students` | `attendance` | 1:N | One student → Many attendance records |
| `students` | `qr_codes` | 1:N | One student → Many QR codes (for regeneration) |
| `students` | `sections` | N:N | Many students in many sections |
| `attendance` | `email_notifications` | 1:N | One attendance event → Many notifications |

---

## Data Flow Notes

### Attendance Creation
```
Student/Guard scans QR
    ↓
Frontend decodes QR_CODE_DATA → student_id
    ↓
INSERT INTO attendance (student_id, time_in, status, marked_by, scanned_at)
    ↓
Frontend/Backend triggers INSERT INTO email_notifications
    ↓
Email service sends to parent_email
```

### Manual Correction
```
Teacher opens Attendance Dashboard
    ↓
SELECTs attendance record
    ↓
UPDATEs attendance SET status = new_status, is_manual = true
    ↓
INSERTs into audit_logs (old_values, new_values)
    ↓
If status changed to "present", triggers email notification
```

### Settings Access
```
Frontend/Backend queries settings table
    ↓
Uses late_threshold and end_class_time for classification
    ↓
Admin updates settings
    ↓
Records change in audit_logs
```

---

## Indexes (Performance Optimization)

Recommended indexes for query performance:

```sql
-- Attendance queries
CREATE INDEX idx_attendance_student_date ON attendance(student_id, scan_date);
CREATE INDEX idx_attendance_section ON attendance(section);
CREATE INDEX idx_attendance_scanned_at ON attendance(scanned_at);

-- User authentication
CREATE INDEX idx_users_email ON users(email);

-- Student lookups
CREATE INDEX idx_students_qr_data ON students(qr_code_data);
CREATE INDEX idx_students_section ON students(section);

-- Email notifications
CREATE INDEX idx_email_notifications_status ON email_notifications(status);
CREATE INDEX idx_email_notifications_parent ON email_notifications(parent_email);

-- Audit trail
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
```

---

## Row-Level Security (RLS) Considerations

```sql
-- Students can view only their own attendance
SELECT * FROM attendance WHERE student_id = auth.uid();

-- Teachers can view only their section's attendance
SELECT * FROM attendance 
WHERE section = (
    SELECT section_name FROM sections WHERE teacher_id = auth.uid()
);

-- Security guards can view all entry/exit records
SELECT * FROM attendance WHERE entry_type IS NOT NULL;

-- Admins can view everything
SELECT * FROM attendance;
```
