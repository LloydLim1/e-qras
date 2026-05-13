# E-QRAS Use Case Diagram

```plantuml
@startuml E-QRAS_UseCase
left to right direction
skinparam packageBorderColor #cccccc
skinparam usecaseBorderColor #4CAF50

actor Student as student
actor Teacher as teacher
actor "Security Guard" as guard
actor Parent as parent
actor Admin as admin

rectangle "E-QRAS System" {
    ' Student Use Cases (RESTRICTED)
    usecase "View Own Attendance\nRecord" as UC_ViewAttendance
    usecase "View Own QR Card" as UC_ViewQR
    
    ' Teacher Use Cases
    usecase "Scan Student QR\n(Webcam)" as UC_ScanWebcam
    usecase "Scan Student QR\n(USB Scanner)" as UC_ScanUSB
    usecase "View Class\nAttendance List" as UC_ViewAttendance_T
    usecase "Generate Bulk\nQR Cards" as UC_GenerateQR
    usecase "Print QR Cards" as UC_PrintQR
    usecase "Mark Attendance\nManually" as UC_ManualAttendance
    
    ' System/Automated Use Cases
    usecase "Detect Duplicate\nScan" as UC_DuplicateDetect
    usecase "Classify Attendance\n(On-time/Late/Absent)" as UC_Classify
    usecase "Send Email to\nParent" as UC_SendEmail
    
    ' Admin Use Cases
    usecase "Configure Late\nThreshold" as UC_ConfigLate
    usecase "Configure End\nClass Time" as UC_ConfigEndTime
    usecase "Manage User\nAccounts" as UC_ManageUsers
}

' Student connections (RESTRICTED TO READ-ONLY)
student --> UC_ViewAttendance
student --> UC_ViewQR

' Teacher connections
teacher --> UC_ScanWebcam
teacher --> UC_ScanUSB
teacher --> UC_ViewAttendance_T
teacher --> UC_GenerateQR
teacher --> UC_PrintQR
teacher --> UC_ManualAttendance

' Security Guard connections
usecase "View Entrance/Exit\nAttendance" as UC_ViewGateAttendance
guard --> UC_ScanWebcam
guard --> UC_ScanUSB
guard --> UC_ViewGateAttendance

' System flow (triggered by scan)
UC_ScanWebcam --> UC_DuplicateDetect : triggers
UC_ScanUSB --> UC_DuplicateDetect : triggers
UC_DuplicateDetect --> UC_Classify : if not duplicate
UC_Classify --> UC_SendEmail : after classification

' Admin connections
admin --> UC_ConfigLate
admin --> UC_ConfigEndTime
admin --> UC_ManageUsers

' Parent connections
UC_SendEmail --> parent : receives

@enduml
```

## Use Case Summary

### **Student (Restricted Access)**
- ✅ **View Own Attendance Record** — Can only see their personal attendance history
- ✅ **View Own QR Card** — Can view but cannot regenerate their QR code
- ❌ **Cannot**: Scan QR codes, modify attendance, access other students' records

### **Teacher**
- 📱 **Scan Student QR** (Webcam or USB barcode gun)
- 📋 **View Class Attendance List** — See attendance for their classes
- 🖨️ **Generate & Print Bulk QR Cards** — Create QR cards for students
- ✏️ **Mark Attendance Manually** — Override/correct attendance if needed

### **Security Guard (Entrance/Exit)**
- 📱 **Scan Student QR** (Webcam or USB barcode gun at gates)
- 🚪 **View Entrance/Exit Attendance** — See student entry/exit records
- ❌ **Cannot**: Modify class records, generate QR cards, manage users

### **System (Automated)**
- 🔄 **Detect Duplicate Scans** — Prevent multiple marks for same student
- ⏰ **Classify Attendance** — Mark as On-time, Late, or Absent based on threshold
- 📧 **Send Email to Parent** — Notify parent of scan with timestamp

### **Admin**
- ⚙️ **Configure Settings** — Set late threshold and end class time
- 👥 **Manage User Accounts** — Create/edit teachers and students
- 📊 **Audit Logs** — Monitor system activity (implied)

### **Parent**
- 📬 **Receive Email Notifications** — Passive actor, receives scan alerts

---

## Key Security Constraints

| Actor | Permission Level | Scope |
|-------|-----------------|-------|
| **Student** | Read-Only | Own data only |
| **Teacher** | Read-Write | Own class data + QR generation |
| **Security Guard** | Read-Write (Limited) | Entrance/exit scanning only |
| **Admin** | Full Access | System-wide |
| **Parent** | Read-Only (Email) | Own child's attendance |

---

## Data Flow: A Scan Event

```
Teacher scans QR
    ↓
[Duplicate Check] → If duplicate: discard
    ↓
[Time Classification] → Compare against settings.late_threshold
    ↓
[Insert Attendance Record] → To students.attendance table
    ↓
[Trigger Email] → Send notification to parent_email
    ↓
Parent notified
```
