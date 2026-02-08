import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import * as Y from "yjs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createSession,
  joinSession,
  getSession,
  getSessionByInviteCode,
  getUser,
  canEdit,
  leaveSession,
  getSessionUsers,
} from "./sessionManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

// Store Yjs documents per session
const docs = new Map();

// Store WebSocket connections per session
const connections = new Map(); // sessionId -> Set<{ws, userId}>

// Get or create Yjs document for a session
function getYDoc(sessionId) {
  if (!docs.has(sessionId)) {
    const doc = new Y.Doc();

    // Initialize circuit data structures
    doc.getMap("gates"); // Y.Map for gates
    doc.getArray("wires"); // Y.Array for wires
    doc.getMap("metadata"); // Y.Map for session metadata

    docs.set(sessionId, doc);
  }
  return docs.get(sessionId);
}

// Broadcast to all clients in a session
function broadcastToSession(sessionId, message, excludeWs = null) {
  const sessionConnections = connections.get(sessionId);
  if (!sessionConnections) return;

  const data = JSON.stringify(message);
  sessionConnections.forEach(({ ws }) => {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  });
}

// Broadcast awareness (cursor, presence) updates
function broadcastAwareness(sessionId, userId, awarenessState) {
  broadcastToSession(sessionId, {
    type: "awareness",
    userId,
    state: awarenessState,
  });
}

// ========== REST API Endpoints ==========

// Create a new session
app.post("/api/sessions", (req, res) => {
  const { userName } = req.body;
  const result = createSession(userName);
  res.json(result);
});

// Get session info
app.get("/api/sessions/:sessionId", (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session);
});

// Join a session
app.post("/api/sessions/:sessionId/join", (req, res) => {
  const { userName, role, inviteCode } = req.body;
  const result = joinSession(req.params.sessionId, userName, role, inviteCode);

  if (result.error) {
    return res.status(400).json(result);
  }

  // Notify existing users
  broadcastToSession(req.params.sessionId, {
    type: "user-joined",
    users: getSessionUsers(req.params.sessionId),
  });

  res.json(result);
});

// Find session by invite code
app.get("/api/sessions/invite/:inviteCode", (req, res) => {
  const session = getSessionByInviteCode(req.params.inviteCode);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session);
});

// ========== WebSocket Handling ==========

wss.on("connection", (ws, req) => {
  let sessionId = null;
  let userId = null;

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "join": {
          sessionId = message.sessionId;
          userId = message.userId;

          // Verify user exists in session
          const user = getUser(sessionId, userId);
          if (!user) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid session or user",
              }),
            );
            ws.close();
            return;
          }

          // Add to connections
          if (!connections.has(sessionId)) {
            connections.set(sessionId, new Set());
          }
          connections.get(sessionId).add({ ws, userId });

          // Send initial state
          const doc = getYDoc(sessionId);
          const state = Y.encodeStateAsUpdate(doc);

          ws.send(
            JSON.stringify({
              type: "init",
              state: Array.from(state),
              users: getSessionUsers(sessionId),
              role: user.role,
            }),
          );

          // Notify others
          broadcastToSession(
            sessionId,
            {
              type: "user-connected",
              userId,
              user,
            },
            ws,
          );

          break;
        }

        case "sync": {
          // Handle Yjs sync updates
          if (!canEdit(sessionId, userId)) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Permission denied: viewers cannot edit",
              }),
            );
            return;
          }

          const doc = getYDoc(sessionId);
          const update = new Uint8Array(message.update);

          Y.applyUpdate(doc, update);

          // Broadcast to other clients
          broadcastToSession(
            sessionId,
            {
              type: "sync",
              update: message.update,
            },
            ws,
          );

          break;
        }

        case "awareness": {
          // Broadcast cursor/presence updates
          broadcastAwareness(sessionId, userId, message.state);
          break;
        }
      }
    } catch (err) {
      console.error("WebSocket message error:", err);
    }
  });

  ws.on("close", () => {
    if (sessionId && userId) {
      // Remove from connections
      const sessionConnections = connections.get(sessionId);
      if (sessionConnections) {
        for (const conn of sessionConnections) {
          if (conn.ws === ws) {
            sessionConnections.delete(conn);
            break;
          }
        }
      }

      // Notify others
      broadcastToSession(sessionId, {
        type: "user-disconnected",
        userId,
      });

      // Optionally remove user from session after timeout
      // leaveSession(sessionId, userId);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Circuit Editor Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
});
