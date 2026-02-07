// CRDT integration using Yjs for real-time collaboration

// CRDT Document Manager
export class CRDTManager {
  constructor() {
    this.doc = null;
    this.gates = null;
    this.wires = null;
    this.metadata = null;
    this.ws = null;
    this.listeners = new Map();
    this.userId = null;
    this.sessionId = null;
    this.role = null;
    this.Y = null;
  }

  // Initialize the CRDT document
  async init() {
    // Import Yjs dynamically from Skypack CDN (ES module)
    try {
      const Y = await import("https://cdn.skypack.dev/yjs@13.6.10");
      this.Y = Y;
      console.log("✅ Yjs loaded");
    } catch (error) {
      console.error("Failed to load Yjs:", error);
      throw error;
    }

    this.doc = new this.Y.Doc();
    this.gates = this.doc.getMap("gates");
    this.wires = this.doc.getArray("wires");
    this.metadata = this.doc.getMap("metadata");

    this.setupObservers();
    return this;
  }

  // Apply state from server
  applyState(stateArray) {
    if (!stateArray || !this.doc) return;
    const state = new Uint8Array(stateArray);
    this.Y.applyUpdate(this.doc, state);
  }

  // Apply incremental update
  applyUpdate(updateArray) {
    if (!updateArray || !this.doc) return;
    const update = new Uint8Array(updateArray);
    this.Y.applyUpdate(this.doc, update);
  }

  // Connect to WebSocket server
  async connect(sessionId, userId, role) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.role = role;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "localhost";
    const port = 3001;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${protocol}//${host}:${port}`);

      this.ws.onopen = () => {
        console.log("🔌 WebSocket connected");
        this.ws.send(
          JSON.stringify({
            type: "join",
            sessionId,
            userId,
          }),
        );
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
          if (message.type === "init") {
            resolve(message);
          }
        } catch (e) {
          console.error("Failed to parse message:", e);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log("🔌 WebSocket disconnected");
        this.emit("disconnected");
      };
    });
  }

  // Handle incoming messages
  handleMessage(message) {
    switch (message.type) {
      case "init":
        if (message.state) this.applyState(message.state);
        this.role = message.role;
        this.emit("connected", { users: message.users, role: message.role });
        break;
      case "sync":
        this.applyUpdate(message.update);
        break;
      case "awareness":
        this.emit("awareness", {
          userId: message.userId,
          state: message.state,
        });
        break;
      case "user-connected":
        this.emit("userConnected", message.user);
        break;
      case "user-disconnected":
        this.emit("userDisconnected", message.userId);
        break;
      case "user-joined":
        this.emit("usersUpdated", message.users);
        break;
      case "error":
        console.error("Server error:", message.message);
        this.emit("error", message.message);
        break;
    }
  }

  // Set up CRDT observers
  setupObservers() {
    this.gates.observe((event) => {
      this.emit("gatesChanged", {
        added: Array.from(event.changes.keys.entries())
          .filter(([_, change]) => change.action === "add")
          .map(([key]) => this.gates.get(key)),
        deleted: Array.from(event.changes.keys.entries())
          .filter(([_, change]) => change.action === "delete")
          .map(([key]) => key),
        updated: Array.from(event.changes.keys.entries())
          .filter(([_, change]) => change.action === "update")
          .map(([key]) => this.gates.get(key)),
      });
    });

    this.wires.observe(() => {
      this.emit("wiresChanged", { wires: this.getAllWires() });
    });
  }

  // Send CRDT update to server
  sendUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.role === "viewer") return;

    const update = this.Y.encodeStateAsUpdate(this.doc);
    this.ws.send(
      JSON.stringify({
        type: "sync",
        update: Array.from(update),
      }),
    );
  }

  // Send awareness update
  sendAwareness(state) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "awareness", state }));
  }

  // Gate operations
  addGate(gate) {
    if (this.role === "viewer") return false;
    this.doc.transact(() => {
      this.gates.set(gate.id, gate);
    });
    this.sendUpdate();
    return true;
  }

  updateGate(gateId, updates) {
    if (this.role === "viewer") return false;
    const gate = this.gates.get(gateId);
    if (!gate) return false;
    this.doc.transact(() => {
      this.gates.set(gateId, { ...gate, ...updates });
    });
    this.sendUpdate();
    return true;
  }

  deleteGate(gateId) {
    if (this.role === "viewer") return false;
    this.doc.transact(() => {
      this.gates.delete(gateId);
      // Delete associated wires
      const wiresToDelete = [];
      this.wires.forEach((wire, index) => {
        if (wire.from.gateId === gateId || wire.to.gateId === gateId) {
          wiresToDelete.unshift(index);
        }
      });
      wiresToDelete.forEach((index) => this.wires.delete(index, 1));
    });
    this.sendUpdate();
    return true;
  }

  getGate(gateId) {
    return this.gates.get(gateId);
  }

  getAllGates() {
    const gates = new Map();
    this.gates.forEach((value, key) => gates.set(key, value));
    return gates;
  }

  // Wire operations
  addWire(wire) {
    if (this.role === "viewer") return false;
    this.doc.transact(() => {
      this.wires.push([wire]);
    });
    this.sendUpdate();
    return true;
  }

  deleteWire(wireId) {
    if (this.role === "viewer") return false;
    let wireIndex = -1;
    this.wires.forEach((wire, index) => {
      if (wire.id === wireId) wireIndex = index;
    });
    if (wireIndex === -1) return false;
    this.doc.transact(() => {
      this.wires.delete(wireIndex, 1);
    });
    this.sendUpdate();
    return true;
  }

  getAllWires() {
    return this.wires.toArray();
  }

  clearCircuit() {
    if (this.role === "viewer") return false;
    this.doc.transact(() => {
      const gateIds = [];
      this.gates.forEach((_, key) => gateIds.push(key));
      gateIds.forEach((id) => this.gates.delete(id));
      while (this.wires.length > 0) this.wires.delete(0, 1);
    });
    this.sendUpdate();
    return true;
  }

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const listeners = this.listeners.get(event);
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error("Event error:", e);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  canEdit() {
    return this.role === "owner" || this.role === "editor";
  }
}

// Singleton
let instance = null;
export function getCRDTManager() {
  if (!instance) instance = new CRDTManager();
  return instance;
}
