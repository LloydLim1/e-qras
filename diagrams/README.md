# E-QRAS System Diagrams

Complete system documentation with UML diagrams for the Emmaus QR-based Attendance System (E-QRAS).

## 📋 Diagram Index

### 1. **[Use Case Diagram](0-use-case-diagram.md)**
   - **Purpose**: Shows actors and their interactions with the system
   - **Actors**: Student, Teacher, Security Guard, Admin, Parent
   - **Use Cases**: Scanning, viewing attendance, generating reports, managing users
   - **Best for**: Understanding system scope and user interactions

### 2. **[Class Diagram: Core Authentication](1-class-diagram-core-auth.md)**
   - **Purpose**: Authentication, session management, and role-based access control
   - **Key Classes**: User, Session, SessionManager, AuthService, Role, Permission
   - **Flows**: Login, authorization, session lifecycle
   - **Best for**: Understanding security architecture and authentication flow

### 3. **[Class Diagram: Admin Role](2-class-diagram-admin.md)**
   - **Purpose**: Admin-specific functionality and responsibilities
   - **Key Classes**: Admin, UserManager, SettingsManager, AuditService, AttendanceManager
   - **Workflows**: User management, settings configuration, attendance correction, reporting
   - **Scope**: System-wide access to all resources
   - **Best for**: Understanding admin dashboard and management features

### 4. **[Class Diagram: Teacher Role](3-class-diagram-teacher.md)**
   - **Purpose**: Teacher-specific functionality for classroom attendance
   - **Key Classes**: Teacher, QRScanner, AttendanceRecorder, QRCodeGenerator, ManualAttendanceMarker
   - **Workflows**: QR scanning, attendance recording, QR card generation, manual marking
   - **Scope**: Own section/class data only
   - **Best for**: Understanding classroom attendance flow

### 5. **[Class Diagram: Security Guard Role](4-class-diagram-security-guard.md)**
   - **Purpose**: Security Guard functionality for gate entry/exit tracking
   - **Key Classes**: SecurityGuard, GateQRScanner, GateEntryExitDetector, GateAttendanceRecorder
   - **Workflows**: Gate scanning, entry/exit detection, gate log viewing, daily reports
   - **Scope**: Gate/entrance location only
   - **Best for**: Understanding gate attendance tracking

### 6. **[Class Diagram: Student Role](5-class-diagram-student.md)**
   - **Purpose**: Student-limited functionality for viewing personal attendance
   - **Key Classes**: Student, PersonalAttendanceViewer, PersonalQRCodeViewer, AttendanceStats
   - **Workflows**: View attendance, download QR code, check statistics, generate report
   - **Scope**: Own personal data only (read-only)
   - **Best for**: Understanding student dashboard and data access restrictions

### 7. **[Swimlane Diagrams](6-swimlane-diagrams.md)**
   - **Purpose**: Process flows across multiple actors and systems
   - **Included Processes**:
     1. Class Attendance Scanning (Teacher + System)
     2. Gate Entry/Exit Scanning (Security Guard + System)
     3. Manual Attendance Correction (Teacher + System)
     4. QR Card Generation & Printing (Admin/Teacher + System)
   - **Best for**: Understanding step-by-step process flows and system interactions

### 8. **[Entity Relationship Diagram](7-entity-relationship-diagram.md)**
   - **Purpose**: Database schema and table relationships
   - **Key Tables**: users, students, sections, attendance, settings, qr_codes, audit_logs, email_notifications
   - **Relationships**: 1:N, N:N connections between entities
   - **Includes**: Indexes, RLS policies, data flow notes
   - **Best for**: Understanding data structure and database design

---

## 🎯 Quick Reference by Role

### For Admins
- Start with: **Use Case Diagram** → **Class Diagram: Admin** → **Swimlane: All Processes**
- Focus: User management, settings, audit logs, system-wide reports

### For Teachers
- Start with: **Use Case Diagram** → **Class Diagram: Teacher** → **Swimlane: Class Scanning**
- Focus: QR scanning, attendance marking, class management

### For Security Guards
- Start with: **Use Case Diagram** → **Class Diagram: Security Guard** → **Swimlane: Gate Scanning**
- Focus: Gate entry/exit, visitor logs, daily reports

### For Students
- Start with: **Use Case Diagram** → **Class Diagram: Student**
- Focus: View attendance, download QR code, check statistics

### For Developers
- Start with: **Entity Relationship Diagram** → **Class Diagram: Core Auth** → All class diagrams
- Then: **Swimlane Diagrams** for process understanding
- Focus: Database schema, authentication, system architecture

### For System Architects
- Start with: **Use Case Diagram** → **Entity Relationship Diagram** → **Swimlane Diagrams**
- Then: Role-specific class diagrams as needed
- Focus: Overall system design, data flow, process architecture

---

## 📊 Diagram Types & Tools

### PlantUML Diagrams
All diagrams are written in PlantUML syntax. To view them:

1. **Online Renderer**: https://www.plantuml.com/plantuml/uml/
   - Copy-paste the code from markdown files
   - Instant visual rendering

2. **VS Code Extension**: 
   - Install: "PlantUML" by jebbs
   - Preview directly in editor

3. **Command Line**:
   ```bash
   plantuml diagram.md -o output.png
   ```

4. **Local Server**:
   ```bash
   docker run -d -p 8080:8080 plantuml/plantuml-server
   # Access at http://localhost:8080
   ```

---

## 🔄 Diagram Relationships

```
Use Case Diagram
    ↓ (defines actors and interactions)
    ├─→ Class Diagrams (for each role)
    │   └─→ Swimlane Diagrams (process details)
    │
    └─→ Entity Relationship Diagram
        └─→ Database Implementation
```

---

## 📝 Key Concepts

### Authentication Flow
1. User enters credentials
2. AuthService validates
3. SessionManager creates session
4. JWT token issued
5. Session stored (in-memory + Redis)

### Authorization
1. User sends request with token
2. SessionManager validates token
3. AccessControl checks permissions
4. Grant or deny access based on role

### Role Hierarchy
```
User (Base)
├── Admin (Full system access)
├── Teacher (Class attendance management)
├── SecurityGuard (Gate entry/exit)
└── Student (View own data only)
```

### Attendance Classification
```
Current Time vs Settings
├─ Before late_threshold → "Present"
├─ Between threshold & end_class → "Late"
└─ After end_class → "Absent"
```

---

## 🔒 Security Features

- **Role-Based Access Control (RBAC)**: Each role has specific permissions
- **Row-Level Security (RLS)**: Database enforces who can access what data
- **Audit Logging**: All changes tracked with timestamps and user IDs
- **Session Management**: Token-based authentication with refresh capability
- **Password Security**: Hashed passwords, password reset via OTP

---

## 📱 System Interfaces

### Teacher Interface
- QR Scanner Dashboard
- Class Attendance View
- Bulk QR Card Generator
- Manual Attendance Marker

### Security Guard Interface
- Gate QR Scanner
- Daily Activity Log
- Visitor Statistics
- End of Shift Report

### Admin Interface
- User Management
- Settings Configuration
- Audit Log Viewer
- System Health Monitor
- Data Export Tools

### Student Interface
- Attendance History
- QR Code Viewer
- Attendance Statistics
- Report Download

### Parent Interface
- Email Notifications
- Child's Attendance Updates

---

## 📈 Data Flow Example: A Complete Scan Event

```
Teacher scans QR code
    ↓
Frontend decodes QR → gets student_id
    ↓
Check duplicate scan (within 5 minutes)
    ↓
Get current time
    ↓
Compare with settings (late_threshold)
    ↓
Classify: Present / Late / Absent
    ↓
INSERT INTO attendance table
    ↓
Backend receives scan event
    ↓
Generate email content
    ↓
Send to parent_email via Nodemailer
    ↓
Parent receives notification
    ↓
Frontend shows confirmation
```

---

## 🚀 Rendering Diagrams

### Copy-Paste Method (Easiest)
1. Open https://www.plantuml.com/plantuml/uml/
2. Copy the PlantUML code block from any diagram file
3. Paste into the editor
4. View rendered diagram instantly

### Example (from Use Case Diagram):
```
@startuml E-QRAS_UseCase
left to right direction
...
@enduml
```

---

## 📚 File Structure

```
diagrams/
├── README.md                              (this file)
├── 0-use-case-diagram.md                  (actors and use cases)
├── 1-class-diagram-core-auth.md           (authentication & sessions)
├── 2-class-diagram-admin.md               (admin functionality)
├── 3-class-diagram-teacher.md             (teacher functionality)
├── 4-class-diagram-security-guard.md      (security guard functionality)
├── 5-class-diagram-student.md             (student functionality)
├── 6-swimlane-diagrams.md                 (process flows)
└── 7-entity-relationship-diagram.md       (database schema)
```

---

## 🎓 Suggested Learning Path

### 1. **System Overview** (15 min)
   - Read: Use Case Diagram README
   - Understand: Who are the actors and what do they do?

### 2. **Data Model** (20 min)
   - Read: Entity Relationship Diagram
   - Understand: How is data structured and related?

### 3. **Process Flows** (30 min)
   - Read: Swimlane Diagrams
   - Understand: How do processes flow between actors and systems?

### 4. **Implementation Details** (45 min)
   - Read: Core Authentication Class Diagram
   - Understand: How is authentication and authorization handled?

### 5. **Role-Specific Features** (varies)
   - Read: Admin / Teacher / Security Guard / Student class diagrams
   - Understand: What features does each role have?

### 6. **Development** (hands-on)
   - Reference diagrams while building features
   - Use ERD for database queries
   - Use class diagrams for method signatures

---

## ❓ FAQ

**Q: Which diagram should I start with?**
A: Start with the **Use Case Diagram** to understand the overall system, then pick diagrams based on your role or focus area.

**Q: How do I view these diagrams?**
A: Copy the PlantUML code blocks and paste them at https://www.plantuml.com/plantuml/uml/

**Q: Can I modify these diagrams?**
A: Yes! The PlantUML source is editable. Modify and re-render as needed.

**Q: Why are class diagrams separated by role?**
A: To keep diagrams readable and fit on standard paper size (8.5x11 inches). Each role has its own focused diagram.

**Q: Where's the system architecture diagram?**
A: See: Use Case Diagram (high-level) + Entity Relationship Diagram (data layer) + Swimlane Diagrams (process layer)

---

## 📞 Support

- For diagram help: See individual README sections in each diagram file
- For system questions: Check the CLAUDE.md file in the project root
- For rendering issues: Use the PlantUML online editor at https://www.plantuml.com/plantuml/uml/

---

**Last Updated**: 2026-05-13
**Total Diagrams**: 8
**Total Use Cases**: 20+
**Total Classes**: 40+
**Total Database Tables**: 8
