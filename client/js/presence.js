// User presence and live cursor management

export class PresenceManager {
  constructor(crdt) {
    this.crdt = crdt;
    this.users = new Map(); // userId -> user info
    this.cursors = new Map(); // userId -> cursor position
    this.localUserId = null;
    this.cursorOverlay = null;

    this.setupListeners();
  }

  setupListeners() {
    if (!this.crdt) return;

    this.crdt.on("awareness", ({ userId, state }) => {
      if (userId === this.localUserId) return;

      if (state.cursor) {
        this.cursors.set(userId, state.cursor);
        this.renderCursors();
      }
    });

    this.crdt.on("connected", ({ users }) => {
      this.updateUsers(users);
    });

    this.crdt.on("userConnected", (user) => {
      this.users.set(user.id, user);
      this.renderUsers();
      this.showToast(`${user.name} joined`, "info");
    });

    this.crdt.on("userDisconnected", (userId) => {
      const user = this.users.get(userId);
      if (user) {
        this.showToast(`${user.name} left`, "info");
      }
      this.users.delete(userId);
      this.cursors.delete(userId);
      this.renderUsers();
      this.renderCursors();
    });

    this.crdt.on("usersUpdated", (users) => {
      this.updateUsers(users);
    });
  }

  init(localUserId) {
    this.localUserId = localUserId;
    this.cursorOverlay = document.getElementById("cursorsOverlay");
  }

  updateUsers(users) {
    this.users.clear();
    users.forEach((user) => {
      this.users.set(user.id, user);
    });
    this.renderUsers();
  }

  renderUsers() {
    // Render user avatars in navbar
    const container = document.getElementById("usersOnline");
    if (!container) return;

    container.innerHTML = "";

    let count = 0;
    for (const [userId, user] of this.users) {
      if (count >= 5) {
        // Show "+N more" indicator
        const more = document.createElement("div");
        more.className = "user-avatar";
        more.style.background = "#4b5563";
        more.textContent = `+${this.users.size - 5}`;
        more.title = `${this.users.size - 5} more users`;
        container.appendChild(more);
        break;
      }

      const avatar = document.createElement("div");
      avatar.className = "user-avatar";
      avatar.style.background = user.color;
      avatar.textContent = user.name.charAt(0).toUpperCase();
      avatar.title = `${user.name} (${user.role})`;
      container.appendChild(avatar);
      count++;
    }

    // Render users list in sidebar
    const usersList = document.getElementById("usersList");
    if (!usersList) return;

    if (this.users.size === 0) {
      usersList.innerHTML =
        '<div class="empty-state small"><p>No active session</p></div>';
      return;
    }

    usersList.innerHTML = "";
    for (const [userId, user] of this.users) {
      const item = document.createElement("div");
      item.className = "user-item";
      item.innerHTML = `
        <div class="user-avatar" style="background: ${user.color}">${user.name.charAt(0).toUpperCase()}</div>
        <div class="user-item-info">
          <div class="user-item-name">${user.name}${userId === this.localUserId ? " (You)" : ""}</div>
          <div class="user-item-role ${user.role}">${user.role}</div>
        </div>
      `;
      usersList.appendChild(item);
    }
  }

  renderCursors() {
    if (!this.cursorOverlay) return;

    // Clear old cursors
    this.cursorOverlay.innerHTML = "";

    for (const [userId, cursor] of this.cursors) {
      if (userId === this.localUserId) continue;

      const user = this.users.get(userId);
      if (!user) continue;

      const cursorEl = document.createElement("div");
      cursorEl.className = "remote-cursor";
      cursorEl.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
      cursorEl.style.setProperty("--cursor-color", user.color);
      cursorEl.innerHTML = `
        <div class="cursor-pointer" style="border-bottom-color: ${user.color}"></div>
        <div class="cursor-label" style="background: ${user.color}">${user.name}</div>
      `;
      this.cursorOverlay.appendChild(cursorEl);
    }
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }
}
