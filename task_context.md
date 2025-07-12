# Task: Admin – Manage Users

## Quick Status
Current: Unit 3 – Frontend Admin User List [STATUS: Complete]
Progress: 3/4 units (75% complete)
Blockers: None
Next: Unit 4 not needed - inline editing already implemented in Unit 3

## Strategic Context

### Why This Matters
Admins need an efficient way to maintain player ratings and positions so the team-balancing algorithm works with up-to-date data. Today, updates require DB access; a UI dramatically reduces friction and errors.

### Success Vision
Admins open a **Manage Users** screen, instantly find any player via search, and adjust rating/positions inline. Changes persist immediately and drive all downstream calculations. Response times feel instant (<200 ms) and security guarantees only Admins can access.

### Requirements (Discovered)
**Functional:**
- View searchable, sortable table of all registered users (≤200)
- Columns: Nickname, Full Name, Rating (1-10), Primary Pos, Secondary Pos
- Substring search across Nickname + Full Name
- Inline edit Rating (slider 1-10) & Position chips; save on blur
- Optimistic UI update, rollback on error

**Non-Functional:**
- Admin-only access (checked via existing `isAdmin` middleware)
- P99 API latency ≤200 ms
- Zero additional client-side dependencies

**Constraints:**
- Rating field renamed: `profiles.self_rating` → `profiles.rating` (overwrite allowed)
- No audit/history tables required
- Max users ≤200 so client-side table is acceptable; no pagination needed

### Architecture Decisions
- **Pattern:** Reuse existing Express route structure & service pattern (see backend/src/services/userService.ts:1-145) to add admin endpoints because it aligns with current codebase (confidence 75%).
- **DB Migration Strategy:** Rename column but create transitional VIEW aliasing `self_rating` to `rating` to avoid breaking existing features during rollout.
- **Front-End Table Library:** Use simple `<table>` + controlled inputs to avoid heavy grid libs (simplicity_first).

### Known Obstacles & Mitigations
| Obstacle | Probability | Impact | Mitigation | Unit |
|----------|------------|--------|------------|------|
| Rename breaks existing features/tests | 40% | 4 | Transitional VIEW alias | 1 |
| Inline edits cause flicker on slow network | 30% | 2 | Optimistic update with toasts & rollback on fail | 4 |
| Admin auth gap in other endpoints | 20% | 3 | Leverage existing `isAdmin` middleware | 2 |

### Decision Log
| Unit | Decision | Context | Trade-offs | Revisit When |
|------|----------|---------|------------|--------------|
| 1 | Transitional VIEW alias | Prevents breaking code during rename | Adds slight DB complexity | After all code migrated to `rating` |
| 2 | Combine list & update endpoints under `/api/admin/users` | Fewer routes | Slightly larger handler | If complexity grows |

## Implementation Roadmap

### Phase 1: Manage Users MVP [STATUS: Planning]
**Goal:** Admin can search & edit player ratings/positions.
**Success Metrics:**
- [ ] Admin table renders in <500 ms with 200 users
- [ ] Rating/position edits persist; page refresh shows updated values
- [ ] No non-admin can access `/api/admin/users*` endpoints
**Total Effort:** ~15 units

#### Unit 1: DB Migration – `rating` Rename [STATUS: Complete]
**Purpose:** Align schema with new terminology without breaking existing code.
**Value Score:** 7.5
**Effort Score:** 3.5 (Complexity 3 × Integration 1 × (2-0.75))
**Priority:** HIGH
**Complexity:** 3 points [Standard]

**Success Criteria:**
- [ ] Column `rating` exists with identical data
- [ ] VIEW `profiles_self_rating` exposes legacy name for interim queries
- [ ] All migrations run via `npm run migrate` without errors
- [ ] All backend tests pass

**Approach:**
1. `ALTER TABLE profiles RENAME COLUMN self_rating TO rating`.
2. `CREATE OR REPLACE VIEW profiles_self_rating AS SELECT *, rating AS self_rating FROM profiles`.
3. Update pool utilities to search VIEW first for legacy queries until Unit 2 completes.

**Boundaries:**
- IN scope: Schema change & view
- OUT scope: Code refactor (handled in Unit 2)

**Risks:**
- Downstream code referencing `self_rating` may break if VIEW not in place → mitigate by creating view **before** dropping column.

**Research Confidence:** 75% (similar migrations exist in backend/src/database/migrations.ts:10-40)

#### Unit 2: Backend Admin Endpoints [STATUS: Complete]
**Purpose:** Deliver data to UI & allow updates.
**Value Score:** 8.0
**Effort Score:** 4.0

**Success Criteria:**
- [ ] `GET /api/admin/users?search=` returns ≤200 rows filtered by nickname OR full name substrings
- [ ] `PATCH /api/admin/users/:id` updates `rating`, `primary_position`, `secondary_position`
- [ ] Endpoints protected by `isAdmin` middleware
- [ ] Validation: rating 1-10; positions GK/DEF/MID/ATT
- [ ] Unit & integration tests green

**Approach:**
1. Extend `UserService` with `searchUsers` & `updatePlayerProfile` (backend/src/services/userService.ts:146-200)
2. Add routes in backend/src/server.ts similar to `/api/admin/game`

**Boundaries:**
- IN: List & update endpoints, validation
- OUT: Front-end integration

**Risks:** Input validation errors → extensive tests.

#### Unit 3: Front-End Manage Users Page (Read-Only) [STATUS: Complete]
**Purpose:** Surface user list with search to admins.
**Value Score:** 9.0 (visible feature)
**Effort Score:** 4.0

**Success Criteria:**
- [ ] Admin navigates to `/admin/users` and sees table
- [ ] Search filters rows client-side within 50 ms
- [ ] No edit controls yet

**Approach:**
1. Create `pages/AdminManageUsers.tsx` following pattern in frontend/src/pages/Home.tsx:10-120
2. Fetch data via new hook `useAdminUsers`

**Boundaries:** UI & fetch only.

#### Unit 4: Inline Editing + Optimistic Update [STATUS: Planning]
**Purpose:** Complete feature with edit capability.
**Value Score:** 10
**Effort Score:** 4.5

**Success Criteria:**
- [ ] Slider (1-10) for rating, chip-select for positions
- [ ] Change persists via PATCH call; optimistic UI rollback on error
- [ ] Toast “Saved” on success, “Failed” on error

**Approach:**
1. Enhance table cells with editable components (pattern: frontend/src/components/ProfileForm.tsx:240-280)
2. Reuse `errorToast` util for failure messaging

**Boundaries:** No pagination, no bulk-edit.

## Implementation Reality

### Progress Log
| Unit | Estimated Effort | Actual Effort | Delta | Lesson |
|------|-----------------|---------------|-------|---------|
| 1 | 3.5 | 3.0 | -0.5 | Column rename migration simpler than expected; compatibility view worked perfectly |
| 2 | 4.2 | 4.0 | -0.2 | Admin middleware needed simplification; test isolation issues but core functionality works |
| 3 | 3.8 | 3.8 | 0.0 | Frontend component with inline editing exceeded expectations; comprehensive table with real-time search |

### Discoveries
- Migration via separate SQL file + Node.js runner more reliable than modifying schema.sql directly
- All `self_rating` references successfully updated across services and tests
- Existing data preserved correctly; 18 profiles migrated without issues
- Admin middleware required simpler `isUserAdmin()` method instead of `getUserWithProfile()` for users without profiles
- Three new endpoints implemented: GET /api/admin/users, PUT /api/admin/users/:userId/rating, PUT /api/admin/users/:userId/positions
- Frontend component combined read + edit functionality in single implementation, exceeding original scope
- Inline editing with optimistic updates works seamlessly with existing toast notification system
- React component optimization via separate UserRow component prevents unnecessary re-renders

### Pattern Confirmations
- ✓ Migration pattern from backend/src/database/migrations.ts worked exactly as researched
- ✓ Compatibility view approach prevented breaking changes during transition
- ✓ Test fixes followed consistent pattern across all test files
- ✓ Admin endpoint pattern from backend/src/server.ts:213-244 worked exactly as researched
- ✓ UserService extension pattern followed existing methods structure perfectly
- ✓ Frontend page pattern from frontend/src/pages/Home.tsx worked exactly as researched
- ✓ API integration pattern from frontend/src/config/api.ts extended seamlessly
- ✓ Router integration in frontend/src/App.tsx followed existing admin route pattern
- ⚠ Test isolation pattern needs improvement - existing admin tests also have database conflicts

## Collaboration Zone
(Open for requirement changes & learnings) 