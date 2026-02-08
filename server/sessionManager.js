import { v4 as uuidv4 } from "uuid";

// In-memory session storage (can be upgraded to Redis for production)
const sessions = new Map();
const userSessions = new Map(); // userId -> sessionId mapping

/**
 * Session structure:
 * {
 *   id: string,
 *   name: string,
 *   ownerId: string,
 *   inviteCode: string,
 *   createdAt: Date,
 *   users: Map<userId, { id, name, role, color, joinedAt }>
 * }
 */

// Generate a random invite code
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate a random color for user
function generateUserColor() {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
    "#F8B500",
    "#00CED1",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Create a new session
export function createSession(ownerName) {
  const sessionId = uuidv4();
  const ownerId = uuidv4();
  const inviteCode = generateInviteCode();

  const session = {
    id: sessionId,
    name: `Circuit Session`,
    ownerId,
    inviteCode,
    createdAt: new Date(),
    users: new Map(),
  };

  // Add owner as first user
  session.users.set(ownerId, {
    id: ownerId,
    name: ownerName || "Owner",
    role: "owner",
    color: generateUserColor(),
    joinedAt: new Date(),
  });

  sessions.set(sessionId, session);
  userSessions.set(ownerId, sessionId);

  return {
    sessionId,
    userId: ownerId,
    inviteCode,
    role: "owner",
  };
}

// Join an existing session
export function joinSession(
  sessionId,
  userName,
  role = "editor",
  inviteCode = null,
) {
  const session = sessions.get(sessionId);

  if (!session) {
    return { error: "Session not found" };
  }

  // Validate invite code if provided
  if (inviteCode && session.inviteCode !== inviteCode) {
    return { error: "Invalid invite code" };
  }

  const userId = uuidv4();
  const validRole = role === "viewer" ? "viewer" : "editor";

  session.users.set(userId, {
    id: userId,
    name: userName || `User ${session.users.size + 1}`,
    role: validRole,
    color: generateUserColor(),
    joinedAt: new Date(),
  });

  userSessions.set(userId, sessionId);

  return {
    sessionId,
    userId,
    role: validRole,
    users: Array.from(session.users.values()),
  };
}

// Get session info
export function getSession(sessionId) {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    name: session.name,
    inviteCode: session.inviteCode,
    createdAt: session.createdAt,
    users: Array.from(session.users.values()),
  };
}

// Get session by invite code
export function getSessionByInviteCode(inviteCode) {
  for (const [sessionId, session] of sessions) {
    if (session.inviteCode === inviteCode) {
      return {
        id: session.id,
        name: session.name,
        userCount: session.users.size,
      };
    }
  }
  return null;
}

// Get user info
export function getUser(sessionId, userId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return session.users.get(userId) || null;
}

// Check if user can edit
export function canEdit(sessionId, userId) {
  const user = getUser(sessionId, userId);
  if (!user) return false;
  return user.role === "owner" || user.role === "editor";
}

// Remove user from session
export function leaveSession(sessionId, userId) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.users.delete(userId);
  userSessions.delete(userId);

  // If no users left, delete session
  if (session.users.size === 0) {
    sessions.delete(sessionId);
  }

  return true;
}

// Update user role
export function updateUserRole(sessionId, targetUserId, newRole, requesterId) {
  const session = sessions.get(sessionId);
  if (!session) return { error: "Session not found" };

  const requester = session.users.get(requesterId);
  if (!requester || requester.role !== "owner") {
    return { error: "Only owner can change roles" };
  }

  const target = session.users.get(targetUserId);
  if (!target) return { error: "User not found" };

  if (target.role === "owner") {
    return { error: "Cannot change owner role" };
  }

  target.role = newRole === "viewer" ? "viewer" : "editor";
  return { success: true, user: target };
}

// Get all users in a session
export function getSessionUsers(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return Array.from(session.users.values());
}

export default {
  createSession,
  joinSession,
  getSession,
  getSessionByInviteCode,
  getUser,
  canEdit,
  leaveSession,
  updateUserRole,
  getSessionUsers,
};
