# E-QRAS Class Diagram: Admin Role

## Admin Responsibilities & Classes

```plantuml
@startuml E-QRAS_AdminRole
!theme plain
skinparam backgroundColor #ffffff
skinparam classBackgroundColor #FFEBEE
skinparam classBorderColor #C62828
skinparam arrowColor #C62828

class Admin {
    - admin_id: UUID
    - user_id: UUID
    --
    + manageUsers(users): void
    + configureSettings(settings): void
    + generateAuditReport(): AuditLog[]
    + resetPassword(user_id): void
    + viewAllAttendance(): Attendance[]
    + manuallyCorrectAttendance(record): void
    + viewSystemLogs(): SystemLog[]
    + exportData(format): File
}

class UserManager {
    - user_repository: UserRepository
    --
    + createUser(email, name, role): User
    + updateUser(user_id, data): User
    + deleteUser(user_id): void
    + changeUserRole(user_id, role): void
    + enableUser(user_id): void
    + disableUser(user_id): void
    + resetUserPassword(user_id): String
    + searchUsers(query): User[]
    + bulkImportUsers(file): void
}

class SettingsManager {
    - settings: Settings
    - cache: Map<String, String>
    --
    + loadSettings(): void
    + updateSetting(key, value): void
    + getSetting(key): String
    + getLateLateThreshold(): Time
    + getEndClassTime(): Time
    + getSettings(): Map<String, String>
    + cacheSettings(): void
    + invalidateCache(): void
    + resetToDefaults(): void
}

class AuditLog {
    - log_id: UUID
    - user_id: UUID
    - action: String
    - table_name: String
    - record_id: UUID
    - old_values: JSONB
    - new_values: JSONB
    - timestamp: DateTime
    --
    + getChangeSummary(): String
    + getAffectedFields(): String[]
    + getUserName(): String
    + getActionType(): String
}

class AuditService {
    - audit_repository: AuditRepository
    --
    + logAction(user_id, action, table, record_id, old_val, new_val): void
    + getAuditLog(filters): AuditLog[]
    + generateReport(from_date, to_date): AuditReport
    + searchAuditLog(query): AuditLog[]
    + deleteOldLogs(before_date): void
}

class AttendanceManager {
    - attendance_repository: AttendanceRepository
    --
    + viewAllAttendance(filters): Attendance[]
    + correctAttendance(id, status, notes): void
    + bulkCorrectAttendance(records): void
    + getAttendanceStats(section, date): Stats
    + exportAttendanceReport(format): File
    + identifyAbsentees(date, section): Student[]
    + generateClassWiseReport(date): Report
}

class SystemMonitor {
    - log_repository: SystemLogRepository
    --
    + getSystemLogs(filter): SystemLog[]
    + getErrorLogs(): SystemLog[]
    + getSecurityLogs(): SystemLog[]
    + monitorDatabaseHealth(): HealthStatus
    + checkEmailService(): ServiceStatus
    + viewAPIUsage(): UsageStats
    + generateSystemReport(): Report
}

class DataExporter {
    - export_service: ExportService
    --
    + exportToCSV(data, filename): File
    + exportToExcel(data, filename): File
    + exportToPDF(data, filename): File
    + exportToJSON(data, filename): File
    + generateFullBackup(): File
    + scheduleDataExport(frequency): void
}

Admin --> UserManager : uses
Admin --> SettingsManager : uses
Admin --> AuditService : uses
Admin --> AttendanceManager : uses
Admin --> SystemMonitor : uses
Admin --> DataExporter : uses

AuditService --> AuditLog : creates/retrieves
AttendanceManager --> Attendance : manages
UserManager --> User : manages
SettingsManager --> Settings : manages

@enduml
```

---

## Admin Workflows

### User Management Workflow
```
Admin Opens User Management
    ↓
Select Action: Create/Update/Delete/Reset Password
    ↓
UserManager performs action
    ↓
AuditService logs the change
    ↓
Confirmation email sent to affected user
    ↓
System updates completed
```

### Settings Configuration Workflow
```
Admin Opens Settings Page
    ↓
View Current Settings
    ↓
Update late_threshold or end_class_time
    ↓
SettingsManager updates database
    ↓
Cache invalidated
    ↓
Changes take effect immediately
    ↓
AuditService logs configuration change
```

### Attendance Correction Workflow
```
Admin Searches Attendance Record
    ↓
Identifies error (wrong status, missing scan)
    ↓
AttendanceManager corrects record
    ↓
AuditService logs: old_values, new_values
    ↓
NotificationService sends parent email
    ↓
Correction marked as admin-made
```

### Report Generation Workflow
```
Admin selects report type
    ↓
Specify date range & filters
    ↓
AuditService or AttendanceManager queries data
    ↓
DataExporter formats data
    ↓
Generate PDF/CSV/Excel
    ↓
Download or email report
```

---

## Admin Permissions Matrix

| Action | Permission | Scope |
|--------|-----------|-------|
| **Create User** | create_user | System-wide |
| **Delete User** | delete_user | System-wide |
| **Reset Password** | reset_password | Any user |
| **Change Role** | manage_roles | System-wide |
| **Update Settings** | update_settings | System-wide |
| **View All Attendance** | view_all_attendance | All sections |
| **Correct Attendance** | correct_attendance | Any student |
| **View Audit Logs** | view_audit_logs | System-wide |
| **Export Data** | export_data | System-wide |
| **View System Logs** | view_system_logs | System-wide |

---

## Admin Dashboard Components

```
┌─────────────────────────────────────────┐
│         ADMIN DASHBOARD                 │
├─────────────────────────────────────────┤
│                                         │
│  [User Management] [Settings]           │
│  [Audit Logs]      [Attendance]         │
│  [Reports]         [System Health]      │
│  [Data Export]     [Activity Monitor]   │
│                                         │
│  ─────────────────────────────────────  │
│  Quick Stats:                           │
│  • Total Users: 125                     │
│  • Today's Scans: 3,456                 │
│  • Failed Emails: 2                     │
│  • System Health: 98.5%                 │
│                                         │
└─────────────────────────────────────────┘
```
