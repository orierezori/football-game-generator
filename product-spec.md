Football Game Generator — Comprehensive Product Specification
This version folds every item from the original outline (login, registration, game registration, friend registration, admin flows, WhatsApp sharing, etc.) into the full-fidelity spec we refined together.

1. Description
A mobile-web PWA that lets community footballers subscribe to the next match (7-a-side → 12-a-side) and allows admins to auto-generate two balanced teams, adjust them via drag-and-drop, and share the final sheet to a WhatsApp group. Past games are archived for reference.

2. User-Facing Section (Players)
Screen
Purpose & Behaviour
Key UI Elements
Data Rules
Login
Authenticate via Google OAuth 2.0 (config flag allows e-mail magic-link fallback if enabled).
“Continue with Google” button.Branded loading overlay.
Session valid 30 days; silent refresh.No other providers exposed in MVP.
Registration
Complete profile on first login.
Form: First Name, Last Name, Nickname, Self-Rating 1-10, Primary Pos (GK/DEF/MID/ATT), Secondary Pos (optional).Save.
self_skill_rating captured with source=SELF; immutable by player thereafter.
Game Registration
View next game, declare attendance.
• Text block (date/time/location & markdown description).• Three buttons: I’m In, Out, Join Wait-list.• Dynamic roster ordered by registration time (CONFIRMED then WAITING).• Your status pill.
Hard cap 24 CONFIRMED → 25th+ become WAITING. Players may toggle status until teams are published.
Register a Friend
Add guest players.
Fields: Full Name, Rating 1-10, Position, Add Friend.Inline guest list with Remove trash-icon per row.
Guests stored in GuestPlayer; editable by inviter or admins.Multiple friends allowed.


3. Admin Section
Screen
Purpose & Behaviour
Key UI Elements
Data Rules
Create Game
Set up the single upcoming match.
• Date & Time pickers (device native).• Location drop-down or free text.• Markdown invite template (live preview).• Create Game button.
On save: any existing state=OPEN game auto-archived; new game inserted with state=OPEN.
Manage Users
Maintain player base.
Table with search & sort:Nickname, Current Rating, Primary+Secondary Pos.Inline edit (rating 1-10 slider, position chips).Add New User modal.
Changes logged to PlayerSkillHistory (source=ADMIN).
Create Teams
Generate & tweak balanced teams, then share.
• Generate Teams (runs algorithm).• Two team cards (drag-and-drop via React Beautiful DnD).• Badge stats: player count, Σ skill, GK count.• Share to WhatsApp (admins only).
WhatsApp text ≤ 1 000 chars, includes deep link ?gameId=.Dragging triggers instant badge recalculation.


4. Core Logic & Constraints
Topic
Final Rule
Match Size
7-vs-7 minimum, 12-vs-12 maximum; max_total_players = 24.
Attendance States
CONFIRMED, WAITING, OUT, LATE_CONFIRMED, CANCELLED. Automatic wait-list promotion.
GK Quorum
≥ 2 GKs → one per team.1 GK → GK Team A, top-rated DEF becomes “DEF→GK” Team B.0 GK → top-rated DEF on each team as “DEF→GK”.
Team Balancing
Equal team sizes → maximise skill parity (simulated annealing ≤ 500 iters). Primary positions filled first, then secondary.


5. Data Model (simplified)
User { id, oauth_uid, first_name, last_name, nickname, phone, photo_url }


PlayerSkillHistory { id, user_id, rating, source, changed_at }


PlayerPosition { user_id, position, priority }


Game (see JSON in previous answer)


Attendance { game_id, player_id, status, registered_at }


GuestPlayer { id, game_id, full_name, rating, primary_pos, secondary_pos, created_by, expires_at }


Team { id, game_id, name }


TeamPlayer { team_id, player_id|guest_id, is_gk_fallback }



6. Key User Flows
Player toggles I’m In / Out → Attendance updated, roster re-renders, wait-list auto-adjusts.


Admin creates game → previous game archives, push “new game live” toast on next load.


Admin generates teams → algorithm output, manual tweaks, WhatsApp share, game state=CLOSED.


History browsing → Players open History tab, select past date, view attendance + team sheets (no scores).



7. Implementation & Success Metrics
Unchanged from prior draft (tech stack, security, analytics, risk matrix). All referenced screens from the original high-level spec are now explicitly documented above.


