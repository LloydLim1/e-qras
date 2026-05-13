# E-QRAS Class Diagram: Core Authentication & Session Management

## Core Authentication & Session Classes

```plantuml
@startuml E-QRAS_CoreAuth
!theme plain
skinparam backgroundColor #ffffff
skinparam classBackgroundColor #E8F4F8
skinparam classBorderColor #2E7D32
skinparam arrowColor #2E7D32

class User {
    - user_id: UUID
    - email: String
    - password_hash: String
    - name: String
    - created_at: DateTime
    - updated_at: DateTime
    - is_active: Boolean
    --
    + login(email, password): Session
    + logout(): void
    + updateProfile(name, email): void
    + changePassword(oldPwd, newPwd): void
    + hasPermission(action): Boolean
    + getRole(): UserRole
}

abstract class UserRole {
    - role_id: UUID
    - user_id: UUID
    - permissions: Permission[]
    --
    + hasPermission(action): Boolean
    + canAccess(resource): Boolean
    + getAccessibleSections(): Section[]
}

class Session {
    - session_id: UUID
    - user_id: UUID
    - user: User
    - role: UserRole
    - token: String
    - created_at: DateTime
    - expires_at: DateTime
    - is_active: Boolean
    - last_activity: DateTime
    --
    + validateToken(): Boolean
    + refreshToken(): String
    + isExpired(): Boolean
    + isValid(): Boolean
    + revoke(): void
    + updateActivity(): void
    + getUser(): User
    + getRole(): UserRole
}

class SessionManager {
    - sessions: Map<String, Session>
    - token_secret: String
    - token_expiry: Int
    --
    + createSession(user): Session
    + validateSession(token): Boolean
    + getSession(token): Session
    + revokeSession(session_id): void
    + revokeAllUserSessions(user_id): void
    + cleanupExpiredSessions(): void
    + refreshToken(old_token): String
}

class AuthService {
    - session_manager: SessionManager
    - user_repository: UserRepository
    --
    + authenticate(email, password): Session
    + registerUser(email, password, name, role): User
    + logout(session_id): void
    + validateToken(token): Boolean
    + getAuthenticatedUser(token): User
    + checkPermission(user, action): Boolean
}

class Permission {
    - permission_id: UUID
    - resource: String
    - action: String
    - description: String
    --
    + matches(resource, action): Boolean
}

class Role {
    - role_id: UUID
    - role_name: String
    - permissions: Permission[]
    - description: String
    --
    + addPermission(permission): void
    + removePermission(permission): void
    + hasPermission(resource, action): Boolean
    + getPermissions(): Permission[]
}

class AccessControl {
    - roles: Map<String, Role>
    --
    + checkAccess(user, resource, action): Boolean
    + isAuthorized(session, action): Boolean
    + enforcePolicy(user_role, target_resource): Boolean
    + getResourcesForRole(role): String[]
}

User "1" --> "1" Session : has active
User "1" --> "1" UserRole : has
Session "1" --> "1" User : references
Session "1" --> "1" UserRole : contains

UserRole <|-- Admin
UserRole <|-- Teacher
UserRole <|-- SecurityGuard
UserRole <|-- Student

SessionManager "1" --> "*" Session : manages
AuthService "1" --> "1" SessionManager : uses
AuthService "1" --> "1" AccessControl : uses

Role "1" --> "*" Permission : contains
AccessControl "1" --> "*" Role : enforces

@enduml
```

---

## Authentication Flow

```
User Input (email, password)
    ↓
AuthService.authenticate(email, password)
    ↓
Validate Credentials
    ↓
SessionManager.createSession(user)
    ↓
Generate JWT Token
    ↓
Return Session with Token
    ↓
Store Session (in-memory + Redis)
    ↓
User authenticated with permissions
```

---

## Authorization Flow

```
Request with Token
    ↓
SessionManager.validateSession(token)
    ↓
Check Token Expiry & Validity
    ↓
Retrieve Session & User Role
    ↓
AccessControl.checkAccess(user, resource, action)
    ↓
Compare against Role Permissions
    ↓
Grant or Deny Access
```

---

## Session Lifecycle

```
1. Login
   └─ User provides credentials
   └─ AuthService creates Session
   └─ SessionManager stores Session
   └─ JWT Token returned to client

2. Active Session
   └─ Client sends requests with token
   └─ SessionManager validates token
   └─ Session.updateActivity() called
   └─ Token refreshed if needed (sliding window)

3. Session Expiry
   └─ Session.isExpired() checks expiry time
   └─ SessionManager.cleanupExpiredSessions() runs periodically
   └─ User redirected to login if expired

4. Logout
   └─ User initiates logout
   └─ SessionManager.revokeSession() called
   └─ Token invalidated
   └─ Session removed from store
```
