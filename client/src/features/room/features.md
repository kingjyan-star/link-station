# Feature: Room

**States:** `makeOrJoinRoom`, `makeroom`, `joinroom`, `checkpassword`, `joinroomwithqr`, `waitingroom`  
**Purpose:** Room lifecycle – create, join, lobby, master controls, QR sharing.

---

## Components

- **MakeOrJoinRoom** – Hub: make room, join room, exit
- **MakeRoom** – Create room form (name, password, capacity)
- **JoinRoom** – Join by room name
- **CheckPassword** – Password verification for protected rooms
- **JoinRoomWithQR** – Join via QR URL (username input)
- **WaitingRoom** – Lobby: user list, QR, role selection, master controls, game selection, liar settings

---

## Role

- Room creation, join flows, password check
- Waiting room: attenders/observers, kick, game select (Telepathy/Liar), liar settings
- QR code sharing
- Master controls: start game, kick users

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/create-room` | Create room |
| POST `/api/join-room` | Join by name |
| POST `/api/join-room-qr` | Join via QR |
| POST `/api/check-password` | Verify password |
| GET `/api/room/:id` | Poll room status |

---

## Boundaries

- Does NOT handle game play (telepathy, liar) or auth (user).
- May import: shared/api, shared/session, qrcode.react.

---

**Consolidated from:** room-hub, room-create, room-join, room-join-qr, waiting-room (2026-03).
