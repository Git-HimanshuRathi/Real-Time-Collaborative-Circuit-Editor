# Real-Time Collaborative Circuit Editor 🔌

A collaborative circuit editor where multiple users can design logic circuits together in real-time.

## POC Requirements Checklist

| #   | Requirement                 | Status | Implementation                          |
| --- | --------------------------- | ------ | --------------------------------------- |
| 1   | Real-time editing (2 users) | ✅     | Changes sync within ~100-300ms          |
| 2   | WebSocket-based sync        | ✅     | Native WebSocket, no polling            |
| 3   | Shared state model          | ✅     | Yjs `Y.Map` (gates) + `Y.Array` (wires) |
| 4   | Conflict handling           | ✅     | Yjs CRDT auto-resolution                |
| 5   | Presence awareness          | ✅     | User list + cursor labels               |
| 6   | Session-based collaboration | ✅     | Isolated rooms with invite codes        |
| 🟡  | Read-only vs edit mode      | ✅     | Viewer role enforced server-side        |

---

## Architecture

### Shared Circuit State Model

```javascript
{
  components: Y.Map<string, { id, type, x, y, value? }>,
  wires: Y.Array<{ id, from: {gateId, pin}, to: {gateId, pin} }>
}
```

Every client:

- Applies remote CRDT updates to this structure
- Renders directly from it (single source of truth)

### Conflict Resolution

Using **Yjs CRDT** which automatically handles conflicts:

> "If two users move the same gate simultaneously, Yjs merges the concurrent operations using its internal logical clock. The last-write-wins semantics are applied per-property, ensuring eventual consistency without data loss."

### WebSocket Message Protocol

```javascript
// Client → Server
{ type: 'join', sessionId, userId }      // Join session
{ type: 'sync', update: [...] }          // Send CRDT update
{ type: 'awareness', state: {...} }      // Cursor/presence

// Server → Client
{ type: 'init', state, users, role }     // Initial state
{ type: 'sync', update: [...] }          // Broadcast update
{ type: 'user-connected', user }         // User joined
{ type: 'user-disconnected', userId }    // User left
```

---

## Features

- **Real-time collaboration** - Multiple users can edit simultaneously
- **CRDT-powered sync** - Conflict-free using Yjs
- **Live presence** - See other users' names on components
- **Role-based permissions** - Owner, Editor, Viewer roles
- **CircuitVerse-inspired UI** - White checkered canvas, dark sidebars

## Tech Stack

- **Frontend**: Vanilla JavaScript + HTML5 Canvas
- **Backend**: Node.js + Express + WebSocket
- **CRDT**: Yjs (conflict-free replicated data types)
- **Styling**: CSS3 with CircuitVerse aesthetics

---

## Getting Started

### 1. Install & Run Server

```bash
cd server
npm install
npm run dev
```

Server runs on `http://localhost:3001`

### 2. Test Collaboration

1. **Tab 1**: Click "New Session" → Get invite code
2. **Tab 2**: Click "Join" → Enter invite code
3. **Either tab**: Drag gates, draw wires
4. **Observe**: Changes appear instantly in both tabs

---

## Usage

### Adding Gates

Drag gates from left sidebar: AND, OR, NOT, XOR, NAND, NOR, Input, Output

### Connecting Wires

1. Select Wire Tool (W key)
2. Click output pin → drag to input pin

### Keyboard Shortcuts

| Key | Action          |
| --- | --------------- |
| V   | Select tool     |
| W   | Wire tool       |
| Del | Delete selected |

---

## Project Structure

```
├── server/
│   ├── index.js           # Express + WebSocket + Yjs
│   ├── sessionManager.js  # Sessions & permissions
│   └── package.json
└── client/
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── app.js         # Main orchestrator
        ├── circuitEditor.js
        ├── crdt.js        # Yjs CRDT
        ├── gates.js
        ├── wire.js
        └── presence.js
```

---

## Why CRDTs are Challenging for Circuits

Circuits form **graphs** with complex constraints:

- Wires reference gates by ID (dangling references if gate deleted)
- Cycles can form (feedback loops)
- Pin connectivity has semantic meaning

Standard CRDTs (Y.Map, Y.Array) work well for the component list but struggle with graph invariants. Future work: explore **graph-aware CRDTs** or operation transforms for wire connections.
