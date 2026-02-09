// Main Application Entry Point
import { getCRDTManager } from "./crdt.js";
import { CircuitEditor } from "./circuitEditor.js";
import { PresenceManager } from "./presence.js";

class CircuitEditorApp {
  constructor() {
    this.crdt = null;
    this.editor = null;
    this.presence = null;
    this.sessionId = null;
    this.userId = null;
    this.inviteCode = null;

    this.init();
  }

  async init() {
    try {
      console.log("⏳ Waiting for Yjs...");
      // Initialize CRDT manager
      this.crdt = getCRDTManager();
      await this.crdt.init();
      console.log("✅ CRDT initialized");

      // Initialize canvas editor
      const canvas = document.getElementById("circuitCanvas");
      this.editor = new CircuitEditor(canvas, this.crdt);
      console.log("✅ Canvas editor initialized");

      // Initialize presence manager
      this.presence = new PresenceManager(this.crdt);
      console.log("✅ Presence manager initialized");

      // Setup UI event listeners
      this.setupUI();
      this.setupDragDrop();
      this.setupModals();
      this.setupToolbar();
      console.log("✅ UI setup complete");

      // Check for session in URL
      this.checkUrlSession();
    } catch (error) {
      console.error("❌ Init error:", error);
    }
  }

  setupUI() {
    // New Session button
    document.getElementById("newSessionBtn").addEventListener("click", () => {
      this.showModal("createSessionModal");
    });

    // Join Session button
    document.getElementById("joinSessionBtn").addEventListener("click", () => {
      this.showModal("joinSessionModal");
    });

    // Share button
    document.getElementById("shareBtn").addEventListener("click", () => {
      if (this.inviteCode) {
        document.getElementById("shareCodeDisplay").textContent =
          this.inviteCode;
        this.showModal("shareModal");
      }
    });

    // Copy invite code
    document.getElementById("copyCodeBtn")?.addEventListener("click", () => {
      navigator.clipboard.writeText(this.inviteCode);
      this.showToast("Invite code copied!", "success");
    });
  }

  setupModals() {
    // Create Session Modal
    document
      .getElementById("confirmCreate")
      .addEventListener("click", () => this.createSession());
    document
      .getElementById("cancelCreate")
      .addEventListener("click", () => this.hideModal("createSessionModal"));
    document
      .getElementById("closeCreateModal")
      .addEventListener("click", () => this.hideModal("createSessionModal"));

    // Join Session Modal
    document
      .getElementById("confirmJoin")
      .addEventListener("click", () => this.joinSession());
    document
      .getElementById("cancelJoin")
      .addEventListener("click", () => this.hideModal("joinSessionModal"));
    document
      .getElementById("closeJoinModal")
      .addEventListener("click", () => this.hideModal("joinSessionModal"));

    // Share Modal
    document
      .getElementById("closeShare")
      .addEventListener("click", () => this.hideModal("shareModal"));
    document
      .getElementById("closeShareModal")
      .addEventListener("click", () => this.hideModal("shareModal"));

    // Close modals on backdrop click
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        e.target.closest(".modal").classList.remove("active");
      });
    });
  }

  setupToolbar() {
    document
      .getElementById("selectTool")
      .addEventListener("click", () => this.editor.setTool("select"));
    document
      .getElementById("wireTool")
      .addEventListener("click", () => this.editor.setTool("wire"));
    document
      .getElementById("deleteTool")
      .addEventListener("click", () => this.editor.setTool("delete"));
    document.getElementById("clearTool").addEventListener("click", () => {
      if (!this.sessionId) {
        this.showToast("Create or join a session first", "error");
        return;
      }
      if (confirm("Clear all components?")) {
        this.editor.clearAll();
      }
    });

    document.getElementById("zoomIn").addEventListener("click", () => {
      this.editor.setZoom(this.editor.zoom + 0.25);
    });
    document.getElementById("zoomOut").addEventListener("click", () => {
      this.editor.setZoom(this.editor.zoom - 0.25);
    });
  }

  setupDragDrop() {
    const canvas = document.getElementById("circuitCanvas");
    const gateItems = document.querySelectorAll(".gate-item");

    gateItems.forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("gate-type", item.dataset.gate);
        item.classList.add("dragging");
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
      });
    });

    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      const gateType = e.dataTransfer.getData("gate-type");
      if (gateType) {
        // Check if session is active
        if (!this.sessionId) {
          this.showToast("Create or join a session to add components", "error");
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top - 44; // Account for toolbar
        this.editor.addGate(gateType, x, y);
      }
    });
  }

  async createSession() {
    const nameInput = document.getElementById("ownerName");
    const name = nameInput.value.trim() || "User";

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: name }),
      });

      const data = await response.json();

      this.sessionId = data.sessionId;
      this.userId = data.userId;
      this.inviteCode = data.inviteCode;

      // Connect to WebSocket
      await this.crdt.connect(this.sessionId, this.userId, data.role);
      this.presence.init(this.userId);
      this.editor.syncFromCRDT();

      this.updateSessionUI(true);
      this.hideModal("createSessionModal");
      this.showToast("Session created!", "success");

      // Update URL
      history.pushState({}, "", `?session=${this.sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      this.showToast("Failed to create session", "error");
    }
  }

  async joinSession() {
    const codeInput = document.getElementById("inviteCode");
    const nameInput = document.getElementById("joinName");
    const roleInputs = document.getElementsByName("joinRole");

    const inviteCode = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim() || "User";
    const role =
      Array.from(roleInputs).find((r) => r.checked)?.value || "editor";

    if (!inviteCode) {
      this.showToast("Please enter an invite code", "error");
      return;
    }

    try {
      // Find session by invite code
      const findResponse = await fetch(`/api/sessions/invite/${inviteCode}`);
      if (!findResponse.ok) {
        this.showToast("Invalid invite code", "error");
        return;
      }

      const session = await findResponse.json();

      // Join the session
      const joinResponse = await fetch(`/api/sessions/${session.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: name, role, inviteCode }),
      });

      const data = await joinResponse.json();

      if (data.error) {
        this.showToast(data.error, "error");
        return;
      }

      this.sessionId = data.sessionId;
      this.userId = data.userId;
      this.inviteCode = inviteCode;

      // Connect to WebSocket
      await this.crdt.connect(this.sessionId, this.userId, data.role);
      this.presence.init(this.userId);
      this.editor.syncFromCRDT();

      this.updateSessionUI(true, data.role);
      this.hideModal("joinSessionModal");
      this.showToast("Joined session!", "success");

      // Update URL
      history.pushState({}, "", `?session=${this.sessionId}`);
    } catch (error) {
      console.error("Failed to join session:", error);
      this.showToast("Failed to join session", "error");
    }
  }

  checkUrlSession() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");

    if (sessionId) {
      // Pre-fill and show join modal
      this.showModal("joinSessionModal");
    }
  }

  updateSessionUI(connected, role = "owner") {
    const badge = document.getElementById("sessionBadge");
    const shareBtn = document.getElementById("shareBtn");
    const readonlyBadge = document.getElementById("readonlyBadge");

    if (connected) {
      badge.textContent = "Connected";
      badge.classList.add("active");
      shareBtn.disabled = false;

      if (role === "viewer") {
        readonlyBadge.style.display = "flex";
      } else {
        readonlyBadge.style.display = "none";
      }
    } else {
      badge.textContent = "No Session";
      badge.classList.remove("active");
      shareBtn.disabled = true;
      readonlyBadge.style.display = "none";
    }
  }

  showModal(modalId) {
    document.getElementById(modalId).classList.add("active");
  }

  hideModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing Circuit Editor App");
  try {
    window.app = new CircuitEditorApp();
    console.log("✅ App initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize app:", error);
  }
});
