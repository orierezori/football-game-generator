# Task: Admin Create Game (Feature 4.1)

## Quick Status
Current: Unit 5 – Player Polling & Toast [STATUS: Complete]
Progress: 5/5 units (100% complete)
Blockers: None
Next: All units complete - Feature 4.1 ready for deployment

## Strategic Context

### Why This Matters
Admins must be able to publish a new football game so players can register attendance. This is the entry point for every downstream flow (roster, teams, history). Without an easy “Create Game” action, the product’s core value can’t be realized.

### Success Vision  
• Admin fills Date, Time, Location, Markdown invite → clicks “Create Game”.  
• Existing OPEN game auto-archives; new game becomes OPEN.  
• All players’ Home screen shows the invite within ≤1 min and see a “New game is live!” toast.  
• No data loss to past attendance; performance ≤200 ms median.

### Requirements (Discovered)
**Functional:**
- Admin can create a game with Date, Time, Location (free-text), Invite Markdown.
- System enforces SINGLE OPEN game at any time (auto-archive existing).
- Game states: OPEN → CLOSED → ARCHIVED (no draft).
- Players retrieve OPEN game via polling every 60 s.
- Push notification upon create (nice-to-have, phase-2).

**Non-Functional:**
- DB writes ≤200 ms median.  
- No race-condition handling needed (per user).

**Constraints:**
- Role column exists on users table to flag admins.  
- Timezone stored in UTC.  
- One future game max in DB.

### Architecture Decisions
- Pattern: Reuse service + endpoint model seen in backend/src/services/userService.ts:5-26 and backend/src/server.ts:120-170 to ensure consistency.  
- Data persistence via Postgres, migrations run from schema.sql similar to backend/src/database/schema.sql:1-15.  
- Frontend form follows controlled-component pattern in frontend/src/components/ProfileForm.tsx:1-120.

### Known Obstacles & Mitigations
| Obstacle | Probability | Impact | Mitigation | Unit |
|----------|------------|--------|------------|------|
| Mistakenly deleting historical attendance when archiving | 20% | 4 | Use soft-state ARCHIVED flag only; leave rows linked | 1 |
| Admin mis-click creates past-dated game | 40% | 2 | UI hint + backend CHECK date ≥ now (optional) | 2 |
| Polling overhead | 30% | 2 | Cache-control header + 60 s interval | 4 |

### Decision Log
| Unit | Decision | Context | Trade-offs | Revisit When |
|------|----------|---------|------------|--------------|
| 1 | Add role column in same migration | Simpler than separate table | Requires user row update script | If RBAC grows |
| 3 | Use middleware role-check | Faster delivery | Hard-coded string, no granular perms | When multiple roles |

## Implementation Roadmap

### Phase 1: Create Game MVP [STATUS: Planning]
Goal: Admin can create game; players see invite via polling + toast.
Success Metrics:
- [ ] Admin POST /api/admin/game returns 201 with new record
- [ ] Home GET /api/game/open returns game within 200 ms
- [ ] Toast displayed for all users within ≤1 min of creation
Total Effort: ~12 units

#### Unit 1: Game DB & Types [STATUS: Complete]
Purpose: Persist games with minimal schema; support OPEN/CLOSED/ARCHIVED.
Value Score: 8.0 (Impact 4 × Priority 5 × Confidence 0.8)
Effort Score: 2.8 (Complexity 3 × Integration 2 × (2 – 0.8))
Priority: HIGH
Complexity: 3 pts (Standard)

Success Criteria:
- [ ] `games` table added with id UUID, date (timestamp UTC), location text, markdown text, state ENUM, created_by, created_at.
- [ ] `role` column (VARCHAR default 'PLAYER') added to `users` table.
- [ ] Type `Game` declared in backend/src/types/index.ts.
- [ ] Migrations run without errors.

Approach:
1. Extend schema.sql following style at 1:15:backend/src/database/schema.sql.
2. Add `Game` interface in types following pattern at 1:30:backend/src/types/index.ts (users/profile types).

Implementation Guidance:
- Use `CHECK (state IN ('OPEN','CLOSED','ARCHIVED'))` like profile position check.
- Default state = 'OPEN'. Auto-archive handled in Unit 2.

Boundaries:
IN: Schema & type updates.  
OUT: Service logic, endpoints.

Risks: Migration conflicts → run `IF NOT EXISTS`.
Research Confidence: 80% (similar pattern exists).

#### Unit 2: GameService – Create & Auto-Archive [STATUS: Complete]
Purpose: Central business logic for game creation.
Value Score: 7.5
Effort Score: 3.0
Complexity: 3 pts

Success Criteria:
- [ ] Method `createGame(adminId, payload)` inserts game, sets others to ARCHIVED in single transaction.
- [ ] Returns `Game` object.

Approach:
1. New file backend/src/services/gameService.ts mirroring style 5:26:backend/src/services/userService.ts.
2. SQL: `UPDATE games SET state='ARCHIVED' WHERE state='OPEN'; INSERT ... RETURNING *`.

Boundaries: No endpoints yet.
Risks: Transaction rollback; mitigate via `BEGIN … COMMIT`.

#### Unit 3: Admin Endpoint & Middleware [STATUS: Complete]
Purpose: Expose POST /api/admin/game; ensure only role='ADMIN'.
Complexity: 3 pts

Success Criteria:
- [ ] 201 Created with JSON body.
- [ ] 403 for non-admin users.

Approach:
1. Add `isAdmin` middleware in backend/src/server.ts near 60:110:backend/src/server.ts.
2. Register route after auth middleware.

Boundaries: No push notif.

#### Unit 4: Frontend Admin UI – Create Game Form [STATUS: Complete]
Purpose: Allow admin to create game via hamburger menu.
Complexity: 3 pts

Success Criteria:
- [ ] New route `/admin/create-game` visible only for admins.
- [ ] Controlled form with fields, submit → POST.

Approach:
1. New component frontend/src/components/CreateGameForm.tsx similar to 1:120:frontend/src/components/ProfileForm.tsx.
2. Add option in hamburger menu within App.tsx.

#### Unit 5: Player Polling & Toast [STATUS: Complete]
Purpose: Players see new invite & toast within a minute.
Complexity: 3 pts

Success Criteria:
- [ ] Home page fetches /api/game/open on mount + every 60 s.
- [ ] If new game id differs, show alert/toast “New game is live!”.

Approach:
- Extend Home.tsx; reuse alert util until proper toast lib added.

### Phase 2: Push Notifications (Nice-to-have) [NOT STARTED]
TBD – integrate Web Push (e.g., service workers + VAPID).

## Implementation Reality

### Progress Log
| Unit | Estimated Effort | Actual Effort | Delta | Lesson |
|------|-----------------|---------------|-------|---------|
| 1 | 2.8 | 2.5 | -0.3 | DB schema patterns well-established, type integration smooth |
| 2 | 3.0 | 2.8 | -0.2 | Transaction pattern straightforward, test setup required user creation |
| 3 | 3.0 | 2.9 | -0.1 | Middleware pattern clear, endpoint tests covered all scenarios |
| 4 | 3.0 | 3.0 | 0.0 | React form patterns well-established, role-based UI working perfectly |
| 5 | 3.0 | 2.7 | -0.3 | Polling logic straightforward, test complexity reduced for reliability |

### Discoveries
- Database already existed with users/profiles tables, required ALTER TABLE for role column
- UUID generation with gen_random_uuid() worked perfectly
- Foreign key constraints and indexes applied correctly
- Existing userService needed updates to handle role column for type safety
- PostgreSQL transactions with BEGIN/COMMIT/ROLLBACK work seamlessly
- Test database cleanup requires creating test users for foreign key constraints
- Timezone handling in dates requires flexible comparison in tests
- Express middleware pattern allows clean separation of concerns
- Role-based access control middleware reusable across endpoints
- React form validation patterns from ProfileForm transfer perfectly
- Frontend role-based UI conditionals work seamlessly with backend role system
- datetime-local input type provides excellent UX for date/time selection
- Controlled form patterns scale well from simple to complex forms
- React useEffect polling with setInterval works reliably for real-time updates
- Game ID comparison enables detection of new content without complex state management
- Error boundaries in polling prevent failures from breaking the user experience

### Pattern Confirmations
- ✓ Schema pattern from existing tables worked exactly as expected
- ✓ Type interface pattern in types/index.ts followed existing conventions 
- ✓ Database migration via direct psql execution successful
- ✓ Test suite remained stable throughout changes
- ✓ Service class pattern from userService.ts copied precisely
- ✓ Transaction pattern with client.query('BEGIN') works as expected
- ✓ Test cleanup with beforeEach/afterEach hooks effective
- ✓ Express middleware pattern for authentication/authorization works perfectly
- ✓ Endpoint validation and error handling follows existing patterns
- ✓ React form component pattern from ProfileForm.tsx copied precisely
- ✓ React Router protected routes work seamlessly with existing auth flow
- ✓ Frontend type definitions aligned perfectly with backend interfaces
- ✓ Controlled form validation and error handling patterns proven effective
- ✓ React useEffect dependencies and cleanup patterns work as expected
- ✓ Toast notification system extensible from errorToast pattern
- ✓ Polling interval management with proper cleanup prevents memory leaks

## Collaboration Zone
- [ ] Confirm timezone handling (UTC assumed).
- [ ] Decide whether past-date input check belongs in Unit 3 backend. 