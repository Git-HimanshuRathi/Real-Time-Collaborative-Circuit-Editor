# Real-Time Collaborative Circuit Editor 🔌

A collaborative circuit editor where multiple users can design logic circuits together in real-time.

## Features

- 🎯 **Real-time collaboration** - Multiple users can edit the same circuit simultaneously
- 🔄 **CRDT-powered sync** - Conflict-free state synchronization using Yjs
- 👥 **Live presence** - See other users' cursors in real-time
- 🔐 **Role-based permissions** - Editor and Viewer roles
- 🎨 **Modern UI** - Dark theme with smooth animations

## Tech Stack

- **Frontend**: Vanilla JavaScript + HTML5 Canvas
- **Backend**: Node.js + Express + WebSocket
- **CRDT**: Yjs (conflict-free replicated data types)
- **Styling**: CSS3 with custom properties

## Getting Started

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Start the Server

```bash
npm run dev
```

Server runs on `http://localhost:3001`

### 3. Open the App

Open `http://localhost:3001` in your browser.

### 4. Create or Join a Session

- Click **"New Session"** to create a session and get an invite code
- Click **"Join"** to enter an invite code and join an existing session

## Usage

### Adding Gates

Drag gates from the left sidebar onto the canvas:

- **AND, OR, NOT, XOR, NAND, NOR** - Logic gates
- **Input** - Toggleable input (double-click to toggle)
- **Output** - Output indicator

### Connecting Wires

1. Click the **Wire Tool** (W key)
2. Click on an output pin (right side of gate)
3. Drag to an input pin (left side of another gate)
4. Release to create connection

### Keyboard Shortcuts

| Key    | Action          |
| ------ | --------------- |
| V      | Select tool     |
| W      | Wire tool       |
| Delete | Delete selected |

## Project Structure

```
├── server/
│   ├── index.js           # Express + WebSocket server
│   ├── sessionManager.js  # Session & permission logic
│   └── package.json
└── client/
    ├── index.html         # Main HTML
    ├── css/styles.css     # Styling
    └── js/
        ├── app.js         # Main orchestrator
        ├── circuitEditor.js # Canvas controller
        ├── crdt.js        # Yjs CRDT integration
        ├── gates.js       # Gate rendering
        ├── wire.js        # Wire connections
        └── presence.js    # Live cursors
```

## API

### REST Endpoints

```
POST /api/sessions           - Create new session
GET  /api/sessions/:id       - Get session info
POST /api/sessions/:id/join  - Join session
GET  /api/sessions/invite/:code - Find by invite code
```

### WebSocket Messages

```javascript
// Client → Server
{ type: 'join', sessionId, userId }
{ type: 'sync', update: [...] }
{ type: 'awareness', state: {...} }

// Server → Client
{ type: 'init', state, users, role }
{ type: 'sync', update: [...] }
{ type: 'user-connected', user }
{ type: 'user-disconnected', userId }
```
