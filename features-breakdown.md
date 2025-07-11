# Football Game Generator – Features & Acceptance Criteria

---

## 1  Authentication & Profile

### 1.1  Google OAuth Login

* **AC‑1**  Given the config flag `enable_magic_link = false`, *only* a **“Continue with Google”** button is visible on the Login screen.
* **AC‑2**  Upon successful OAuth sign‑in, the user receives a session token that remains valid for **30 days**, with silent token refresh before expiry.
* **AC‑3**  If the OAuth flow fails (network or provider error), the user is returned to the Login screen and shown an actionable error message.
* **AC‑4**  No other social or email providers are visible in the MVP when the magic‑link fallback is disabled.

### 1.2  Email Magic‑Link Login *(optional config)*

* **AC‑1**  Given the config flag `enable_magic_link = true`, a single‑field **Email** input and **“Send Magic Link”** button appear beneath the Google button.
* **AC‑2**  Submitting a valid email sends a signed, one‑time link that expires after **15 minutes**.
* **AC‑3**  Clicking an expired or previously used link redirects the user to Login with an "Invalid or expired link" notice.

### 1.3  Profile Completion (First Login)

* **AC‑1**  If the user has no profile, they are redirected to a **Registration** form immediately after authentication.
* **AC‑2**  **First Name, Last Name, Nickname, Self‑Rating (1‑10), Primary Pos, Secondary Pos (optional)** are required before saving.
* **AC‑3**  `self_skill_rating` is stored with `source = SELF` and cannot be edited by the player after the first save.
* **AC‑4**  Upon successful save, the user is routed to the **Home / Next Game** screen.

---

## 2  Player – Game Registration

### 2.1  View Upcoming Game

* **AC‑1**  When a `state = OPEN` game exists, its **date, time, location, and markdown description** are shown at the top of Home.
* **AC‑2**  If no upcoming game exists, the screen displays “No game scheduled” and hides attendance buttons.

### 2.2  Declare Attendance (In / Out / Wait‑list)

* **AC‑1**  Three buttons **I’m In, Out, Join Wait‑list** are displayed when an OPEN game is available.
* **AC‑2**  Pressing **I’m In** sets `status = CONFIRMED` *iff* `CONFIRMED < 24`; otherwise sets `status = WAITING`.
* **AC‑3**  Pressing **Out** sets `status = OUT`. Pressing **Join Wait‑list** sets `status = WAITING`.
* **AC‑4**  Players may change their status at any time until teams are published (game `state = CLOSED`).
* **AC‑5**  Roster lists **CONFIRMED** players first in order of `registered_at`, followed by **WAITING** players.

### 2.3  Automatic Wait‑list Promotion

* **AC‑1**  If a CONFIRMED player switches to OUT or is removed, the earliest WAITING player is auto‑promoted to `status = LATE_CONFIRMED`.
* **AC‑2**  Promoted players receive an in‑app toast “You’ve been moved to CONFIRMED!”.

### 2.4  Register a Friend (Guest Players)

* **AC‑1**  Players with `status = CONFIRMED` or `WAITING` can add guest(s) via **Add Friend** form (Full Name, Rating 1‑10, Position).
* **AC‑2**  Guests appear inline beneath the inviter with a **trash icon** for removal.
* **AC‑3**  A guest entry is stored in **GuestPlayer** and is editable only by its creator or an Admin until teams are published.
* **AC‑4**  Guests count toward the CONFIRMED cap of 24.

---

## 3  Player – History Browsing

* **AC‑1**  A **History** tab lists past games (state = ARCHIVED) in reverse‑chronological order.
* **AC‑2**  Selecting a date shows the final attendance roster and team sheets. Scores are **not** displayed (out of scope).

---

## 4  Admin – Game Lifecycle

### 4.1  Create Game

* **AC‑1**  Admin may create a new game by selecting **Date, Time, Location, Invite Markdown** and clicking **Create Game**.
* **AC‑2**  Upon save, any existing game with `state = OPEN` is automatically set to `state = ARCHIVED`.
* **AC‑3**  All players see the new invite the next time they open the app (or immediately if online), with a toast “New game is live!”.

### 4.2  Manage Users

* **AC‑1**  Admin can view a searchable, sortable table of all registered users showing **Nickname, Current Rating, Primary+Secondary Pos**.
* **AC‑2**  Admin may inline‑edit a player’s **rating** (1‑10 slider) or **positions** (chip selector). Changes persist on blur.
* **AC‑3**  Each change writes a row to **PlayerSkillHistory** with `source = ADMIN` and timestamp `changed_at`.

### 4.3  Generate & Tweak Teams

* **AC‑1**  Pressing **Generate Teams** runs the balancing algorithm and produces **Two team cards** with drag‑and‑drop enabled.
* **AC‑2**  Each card shows **player count, Σ skill, GK count** badges; these update live when players are moved.
* **AC‑3**  The **Share to WhatsApp** button is enabled once team sizes are equal and each team has ≥ 7 players.
* **AC‑4**  Clicking **Share to WhatsApp** opens the native WhatsApp share sheet with pre‑formatted text ≤ 1 000 chars, including a deep‑link `?gameId=`.
* **AC‑5**  After sharing, the game `state` changes to **CLOSED**, locking attendance toggles for players.

---

## 5  Core Logic & Constraints

### 5.1  Player Caps

* **AC‑1**  `max_total_players = 24` is enforced across CONFIRMED + WAITING + guests.
* **AC‑2**  Minimum viable match size is **7‑vs‑7**; the **Generate Teams** button remains disabled until ≥ 14 CONFIRMED players exist.

### 5.2  Attendance States

* **AC‑1**  Valid states are **CONFIRMED, WAITING, OUT, LATE\_CONFIRMED, CANCELLED**; any other value is rejected at API layer.
* **AC‑2**  State transitions follow the diagram in the original spec; invalid jumps (e.g., WAITING → OUT → LATE\_CONFIRMED) are blocked.

### 5.3  GK Quorum Rules

* **AC‑1**  If ≥ 2 registered GKs exist, the algorithm assigns exactly one GK per team.
* **AC‑2**  If exactly 1 GK exists, that GK is placed on **Team A**; the highest‑rated DEF is converted to “DEF→GK” for **Team B** and flagged `is_gk_fallback = true`.
* **AC‑3**  If 0 GKs exist, the two highest‑rated DEFs are converted, one per team, both flagged as fallbacks.

### 5.4  Team Balancing Algorithm

* **AC‑1**  Teams are generated with **equal player counts** and the smallest possible absolute difference in **Σ skill** after ≤ 500 simulated‑annealing iterations.
* **AC‑2**  The algorithm prioritises **primary positions** before filling secondary positions.
* **AC‑3**  The resulting skill‑gap badge colour: **Green** ≤ 1, **Amber** ≤ 3, **Red** > 3.

---

## 6  Non‑Functional & PWA

* **AC‑1**  The app installs as a PWA with offline fallback for static assets and last‑known game data.
* **AC‑2**  All interactive flows complete within **≤ 200 ms** median response time under a 3G connection.
* **AC‑3**  The UI meets WCAG AA contrast requirements.

---

*End of initial feature breakdown.  Please review and let me know what needs refinement or additional coverage.*
