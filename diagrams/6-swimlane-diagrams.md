# E-QRAS Swimlane Diagrams

## 1. Class Attendance Scanning Process

```plantuml
@startuml ClassAttendanceSwimLane
!theme plain
skinparam activityBackgroundColor #4CAF50
skinparam activityBorderColor #2E7D32

|Teacher|
:Arrive at Class;
:Open E-QRAS Dashboard;
:Select Class/Section;

|Frontend|
:Display QR Scanner;
:Activate Webcam/Scanner;

|Student|
:Present QR Card;

|Frontend|
:Decode QR Code;
:Extract Student ID;
:Check Duplicate Scan;
if (Duplicate?) then (Yes)
    :Show Error;
    :Stop;
else (No)
    :Get Current Time;
endif

|Supabase|
:Retrieve late_threshold;
:Retrieve end_class_time;

|Frontend|
if (Time < threshold?) then (On-time)
    :Mark as "Present";
elseif (Time < end_class?) then (Late)
    :Mark as "Late";
else (No)
    :Mark as "Absent";
endif

|Supabase|
:Insert Attendance Record;
:Stored with: student_id, time_in, status;

|Backend|
:Receive Email Request;
:Generate Email Content;

|Email Service|
:Send Email to Parent;

|Parent|
:Receive Email Notification;

|Teacher|
:See Confirmation;
:Continue Scanning;
:Stop;

@enduml
```

---

## 2. Entrance/Exit Gate Scanning Process

```plantuml
@startuml GateAttendanceSwimLane
!theme plain
skinparam activityBackgroundColor #2196F3
skinparam activityBorderColor #1565C0

|Student|
:Arrive at School Gate;
:Present QR Card;

|Security Guard|
:Position USB Scanner at Gate;
:Scan QR Code;

|Frontend|
:Decode QR Code;
:Extract Student ID;
:Get Timestamp;

|Frontend|
:Check Time of Day;
if (Morning?) then (Yes)
    :Mark as "Entry";
else (No)
    :Mark as "Exit";
endif

|Supabase|
:Insert Gate Attendance;
:Record student_id, timestamp, entry_type;

|Frontend|
:Display Student Name;
:Display Entry/Exit Status;

|Security Guard|
:Verify Scan Success;
:Confirm in Log;

|Backend|
if (Send Parent\nNotification?) then (Yes)
    :Prepare Email;
else (No)
    :Skip;
endif

|Email Service|
:Send Optional Alert to Parent;

|Parent|
:Optional: Receive Entry/Exit Alert;
:Stop;

@enduml
```

---

## 3. Manual Attendance Correction Process

```plantuml
@startuml ManualAttendanceSwimLane
!theme plain
skinparam activityBackgroundColor #FF9800
skinparam activityBorderColor #E65100

|Teacher|
:Open Attendance Dashboard;
:Review Class Records;
if (Found Error?) then (Yes)
    :Select Student;
    :View Attendance Details;
else (No)
    :Exit;
    :Stop;
endif

|Frontend|
:Display Student List;
:Show Current Status;
:Present Status Options;

|Teacher|
:Choose New Status;
:Confirm Status Change;
:Add Notes (Optional);
:Submit Change;

|Frontend|
:Validate Selection;
:Check Authorization;
if (Teacher Authorized?) then (Yes)
    :Proceed;
else (No)
    :Show Error;
    :Stop;
endif

|Supabase|
:Update Attendance Record;
:Log Change Timestamp;
:Record Teacher ID;

|Backend|
if (Status Changed\nto Present?) then (Yes)
    :Trigger Email Notification;
else (No)
    :Skip Email;
endif

|Email Service|
:Send Updated Notification;

|Parent|
:Receive Corrected Attendance Email;

|Frontend|
:Show Success Message;

|Teacher|
:See Updated Record;
:Stop;

@enduml
```

---

## 4. QR Card Generation & Printing Process

```plantuml
@startuml QRGenerationSwimLane
!theme plain
skinparam activityBackgroundColor #9C27B0
skinparam activityBorderColor #6A1B9A

|Admin/Teacher|
:Access QR Card Generator;
:Select Grade/Section;
if (All Students?) then (Yes)
    :Click Generate All;
else (No)
    :Select Individual Students;
endif

|Frontend|
:Retrieve Student List from Supabase;
:Start Generation Loop;

|QR Code Library|
:Generate QR Code for Each Student;
:Encode Student ID;

|Barcode Library|
:Generate Barcode;
:Add Student Number;

|Frontend|
:Arrange QR Codes in Print Grid;
:Add Student Name;
:Add Grade/Section;
:Format for 8.5x11 Paper;

|Admin/Teacher|
:Preview Generated Cards;
if (Adjust Needed?) then (Yes)
    :Adjust Layout;
else (No)
endif
:Click Print;

|Browser|
:Render Print Dialog;
:Send to Printer;

|Printer|
:Print QR Cards;

|Admin/Teacher|
:Receive Printed Cards;
:Cut and Bundle Cards;
:Distribute to Students;

|Student|
:Receive QR Card;
:Use for Scanning;
:Stop;

@enduml
```

---

## Process Flow Summary

| Process | Primary Actor | Key Systems | Output |
|---------|---------------|-------------|--------|
| **Class Attendance** | Teacher | Frontend, Supabase, Email Service | Attendance record + Parent email |
| **Gate Entry/Exit** | Security Guard | Frontend, Supabase, Optional Email | Entry/exit log |
| **Manual Correction** | Teacher | Frontend, Supabase, Email Service | Updated attendance + Optional parent email |
| **QR Generation** | Admin/Teacher | Frontend, QR Library | Printable QR cards |

---

## Data Flow Notes

- **Frontend handles most logic**: QR decoding, duplicate detection, time classification, and form submissions
- **Backend is minimal**: Only handles email sending and JWT generation
- **Supabase is the single source of truth**: All data persisted there via direct frontend calls
- **Real-time responsiveness**: Users see immediate feedback on successful scans
