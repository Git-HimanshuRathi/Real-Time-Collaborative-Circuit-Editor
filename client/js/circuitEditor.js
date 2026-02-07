// Canvas-based Circuit Editor
import {
  GATE_TYPES,
  createGate,
  drawGate,
  isPointInGate,
  getPinAtPoint,
  getPinPositions,
} from "./gates.js";
import { createWire, drawWire, drawTempWire } from "./wire.js";

export class CircuitEditor {
  constructor(canvas, crdt) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.crdt = crdt;

    // State
    this.gates = new Map();
    this.wires = [];
    this.selectedGate = null;
    this.selectedWire = null;
    this.hoveredGate = null;
    this.hoveredPin = null;

    // Tools
    this.currentTool = "select"; // 'select', 'wire', 'delete'

    // Drag state
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };

    // Wire drawing state
    this.isDrawingWire = false;
    this.wireStart = null;
    this.wireEnd = { x: 0, y: 0 };

    // View state
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };

    // Grid
    this.gridSize = 20;
    this.snapToGrid = true;

    this.setupCanvas();
    this.setupEventListeners();
    this.setupCRDTListeners();
  }

  setupCanvas() {
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const toolbar = container.querySelector(".canvas-toolbar");
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 44;

    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight - toolbarHeight;
    this.draw();
  }

  setupEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("dblclick", (e) => this.onDoubleClick(e));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  setupCRDTListeners() {
    if (!this.crdt) return;

    this.crdt.on("gatesChanged", () => {
      this.gates = this.crdt.getAllGates();
      this.draw();
    });

    this.crdt.on("wiresChanged", () => {
      this.wires = this.crdt.getAllWires();
      this.draw();
    });
  }

  // Sync state from CRDT
  syncFromCRDT() {
    if (!this.crdt) return;
    this.gates = this.crdt.getAllGates();
    this.wires = this.crdt.getAllWires();
    this.draw();
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.zoom - this.pan.x,
      y: (e.clientY - rect.top) / this.zoom - this.pan.y,
    };
  }

  snapToGridPos(pos) {
    if (!this.snapToGrid) return pos;
    return {
      x: Math.round(pos.x / this.gridSize) * this.gridSize,
      y: Math.round(pos.y / this.gridSize) * this.gridSize,
    };
  }

  onMouseDown(e) {
    const pos = this.getMousePos(e);

    if (this.currentTool === "wire") {
      // Check if clicking on an output pin
      for (const [_, gate] of this.gates) {
        const pin = getPinAtPoint(gate, pos.x, pos.y);
        if (pin && pin.type === "output") {
          this.isDrawingWire = true;
          this.wireStart = pin;
          const pins = getPinPositions(gate);
          const startPin = pins.outputs.find((p) => p.id === pin.pin.id);
          this.wireEnd = { x: startPin.x, y: startPin.y };
          return;
        }
      }
    }

    if (this.currentTool === "select") {
      // Check for gate selection
      for (const [id, gate] of this.gates) {
        if (isPointInGate(gate, pos.x, pos.y)) {
          this.selectedGate = id;
          this.selectedWire = null;
          this.isDragging = true;
          this.dragOffset = {
            x: pos.x - gate.x,
            y: pos.y - gate.y,
          };
          this.draw();
          this.emitSelection();
          return;
        }
      }

      // Deselect
      this.selectedGate = null;
      this.selectedWire = null;
      this.draw();
      this.emitSelection();
    }

    if (this.currentTool === "delete") {
      // Delete gate
      for (const [id, gate] of this.gates) {
        if (isPointInGate(gate, pos.x, pos.y)) {
          this.deleteGate(id);
          return;
        }
      }
    }
  }

  onMouseMove(e) {
    const pos = this.getMousePos(e);

    // Update cursor position for presence
    if (this.crdt) {
      this.crdt.sendAwareness({
        cursor: { x: pos.x, y: pos.y },
        selection: this.selectedGate ? [this.selectedGate] : [],
      });
    }

    // Wire drawing
    if (this.isDrawingWire) {
      this.wireEnd = pos;
      this.draw();
      return;
    }

    // Dragging gate
    if (this.isDragging && this.selectedGate) {
      const gate = this.gates.get(this.selectedGate);
      if (gate && this.crdt && this.crdt.canEdit()) {
        const newPos = this.snapToGridPos({
          x: pos.x - this.dragOffset.x,
          y: pos.y - this.dragOffset.y,
        });
        this.crdt.updateGate(this.selectedGate, { x: newPos.x, y: newPos.y });
      }
      return;
    }

    // Hover detection
    let foundHover = false;
    for (const [id, gate] of this.gates) {
      if (isPointInGate(gate, pos.x, pos.y)) {
        this.hoveredGate = id;
        foundHover = true;
        break;
      }
      const pin = getPinAtPoint(gate, pos.x, pos.y);
      if (pin) {
        this.hoveredPin = pin;
        foundHover = true;
        break;
      }
    }
    if (!foundHover) {
      this.hoveredGate = null;
      this.hoveredPin = null;
    }

    this.draw();
  }

  onMouseUp(e) {
    const pos = this.getMousePos(e);

    // Complete wire connection
    if (this.isDrawingWire && this.wireStart) {
      for (const [_, gate] of this.gates) {
        const pin = getPinAtPoint(gate, pos.x, pos.y);
        if (
          pin &&
          pin.type === "input" &&
          pin.gateId !== this.wireStart.gateId
        ) {
          // Create wire
          const wire = createWire(
            this.wireStart.gateId,
            this.wireStart.pin.id,
            pin.gateId,
            pin.pin.id,
          );
          if (this.crdt) {
            this.crdt.addWire(wire);
          }
          break;
        }
      }
    }

    this.isDrawingWire = false;
    this.wireStart = null;
    this.isDragging = false;
    this.draw();
  }

  onDoubleClick(e) {
    const pos = this.getMousePos(e);

    // Toggle input gate value
    for (const [id, gate] of this.gates) {
      if (gate.type === "INPUT" && isPointInGate(gate, pos.x, pos.y)) {
        if (this.crdt && this.crdt.canEdit()) {
          this.crdt.updateGate(id, { value: !gate.value });
        }
        return;
      }
    }
  }

  onKeyDown(e) {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selectedGate) {
        this.deleteGate(this.selectedGate);
      }
    }
    if (e.key === "v" || e.key === "V") {
      this.setTool("select");
    }
    if (e.key === "w" || e.key === "W") {
      this.setTool("wire");
    }
  }

  // Add gate from drag and drop
  addGate(type, x, y) {
    if (!this.crdt || !this.crdt.canEdit()) return null;

    const pos = this.snapToGridPos({ x, y });
    const gate = createGate(type, pos.x, pos.y);
    this.crdt.addGate(gate);
    return gate;
  }

  deleteGate(gateId) {
    if (!this.crdt || !this.crdt.canEdit()) return;
    this.crdt.deleteGate(gateId);
    if (this.selectedGate === gateId) {
      this.selectedGate = null;
    }
    this.draw();
  }

  deleteWire(wireId) {
    if (!this.crdt || !this.crdt.canEdit()) return;
    this.crdt.deleteWire(wireId);
    this.draw();
  }

  clearAll() {
    if (!this.crdt || !this.crdt.canEdit()) return;
    this.crdt.clearCircuit();
    this.selectedGate = null;
    this.draw();
  }

  setTool(tool) {
    this.currentTool = tool;
    document
      .querySelectorAll(".tool-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document.getElementById(`${tool}Tool`)?.classList.add("active");
  }

  setZoom(zoom) {
    this.zoom = Math.max(0.25, Math.min(2, zoom));
    document.getElementById("zoomLevel").textContent =
      `${Math.round(this.zoom * 100)}%`;
    this.draw();
  }

  // Drawing
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(this.pan.x, this.pan.y);

    // Draw grid
    this.drawGrid();

    // Draw wires
    for (const wire of this.wires) {
      const fromGate = this.gates.get(wire.from.gateId);
      const toGate = this.gates.get(wire.to.gateId);
      if (fromGate && toGate) {
        const fromPins = getPinPositions(fromGate);
        const toPins = getPinPositions(toGate);
        const fromPin = fromPins.outputs.find((p) => p.id === wire.from.pinId);
        const toPin = toPins.inputs.find((p) => p.id === wire.to.pinId);
        if (fromPin && toPin) {
          drawWire(
            ctx,
            fromPin.x,
            fromPin.y,
            toPin.x,
            toPin.y,
            this.selectedWire === wire.id,
          );
        }
      }
    }

    // Draw temp wire
    if (this.isDrawingWire && this.wireStart) {
      const gate = this.gates.get(this.wireStart.gateId);
      if (gate) {
        const pins = getPinPositions(gate);
        const pin = pins.outputs.find((p) => p.id === this.wireStart.pin.id);
        if (pin) {
          drawTempWire(ctx, pin.x, pin.y, this.wireEnd.x, this.wireEnd.y);
        }
      }
    }

    // Draw gates
    for (const [id, gate] of this.gates) {
      drawGate(ctx, gate, this.selectedGate === id, this.hoveredGate === id);
    }

    ctx.restore();
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;

    const width = this.canvas.width / this.zoom;
    const height = this.canvas.height / this.zoom;

    for (let x = 0; x < width; x += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  emitSelection() {
    const event = new CustomEvent("selectionchange", {
      detail: {
        gateId: this.selectedGate,
        gate: this.selectedGate ? this.gates.get(this.selectedGate) : null,
      },
    });
    this.canvas.dispatchEvent(event);
  }
}
