// Gate definitions
export const GATE_TYPES = {
  AND: {
    name: "AND",
    inputs: 2,
    outputs: 1,
    width: 80,
    height: 50,
    color: "#6366f1",
  },
  OR: {
    name: "OR",
    inputs: 2,
    outputs: 1,
    width: 80,
    height: 50,
    color: "#22d3ee",
  },
  NOT: {
    name: "NOT",
    inputs: 1,
    outputs: 1,
    width: 70,
    height: 40,
    color: "#f59e0b",
  },
  XOR: {
    name: "XOR",
    inputs: 2,
    outputs: 1,
    width: 80,
    height: 50,
    color: "#10b981",
  },
  NAND: {
    name: "NAND",
    inputs: 2,
    outputs: 1,
    width: 80,
    height: 50,
    color: "#8b5cf6",
  },
  NOR: {
    name: "NOR",
    inputs: 2,
    outputs: 1,
    width: 80,
    height: 50,
    color: "#ec4899",
  },
  INPUT: {
    name: "INPUT",
    inputs: 0,
    outputs: 1,
    width: 50,
    height: 40,
    color: "#10b981",
  },
  OUTPUT: {
    name: "OUTPUT",
    inputs: 1,
    outputs: 0,
    width: 50,
    height: 40,
    color: "#ef4444",
  },
};

export function createGate(type, x, y) {
  const gateType = GATE_TYPES[type];
  if (!gateType) throw new Error(`Unknown gate type: ${type}`);

  const gate = {
    id: "gate-" + Math.random().toString(36).substr(2, 9),
    type,
    x,
    y,
    width: gateType.width,
    height: gateType.height,
    inputs: [],
    outputs: [],
    value: type === "INPUT" ? false : null,
  };

  for (let i = 0; i < gateType.inputs; i++) {
    gate.inputs.push({ id: `${gate.id}-in-${i}`, index: i, wireId: null });
  }
  for (let i = 0; i < gateType.outputs; i++) {
    gate.outputs.push({ id: `${gate.id}-out-${i}`, index: i, wireIds: [] });
  }
  return gate;
}

export function getPinPositions(gate) {
  const gateType = GATE_TYPES[gate.type];
  const pins = { inputs: [], outputs: [] };

  const inputSpacing = gate.height / (gateType.inputs + 1);
  for (let i = 0; i < gateType.inputs; i++) {
    pins.inputs.push({
      id: gate.inputs[i].id,
      x: gate.x,
      y: gate.y + inputSpacing * (i + 1),
    });
  }

  const outputSpacing = gate.height / (gateType.outputs + 1);
  for (let i = 0; i < gateType.outputs; i++) {
    pins.outputs.push({
      id: gate.outputs[i].id,
      x: gate.x + gate.width,
      y: gate.y + outputSpacing * (i + 1),
    });
  }
  return pins;
}

export function drawGate(ctx, gate, isSelected = false, isHovered = false) {
  const gateType = GATE_TYPES[gate.type];
  const { x, y, width, height } = gate;

  ctx.save();
  if (isSelected || isHovered) {
    ctx.shadowColor = isSelected ? "#6366f1" : "rgba(99,102,241,0.5)";
    ctx.shadowBlur = isSelected ? 15 : 8;
  }

  ctx.strokeStyle = gateType.color;
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(30,30,45,0.9)";

  // Draw gate body
  ctx.beginPath();
  if (gate.type === "NOT") {
    ctx.moveTo(x, y);
    ctx.lineTo(x + width * 0.75, y + height / 2);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + width * 0.85, y + height / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (gate.type === "INPUT" || gate.type === "OUTPUT") {
    if (gate.type === "INPUT") {
      ctx.roundRect(x, y, width, height, 5);
    } else {
      ctx.arc(x + width / 2, y + height / 2, height / 2, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + width * 0.5, y);
    ctx.arc(
      x + width * 0.5,
      y + height / 2,
      height / 2,
      -Math.PI / 2,
      Math.PI / 2,
    );
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (gate.type === "NAND" || gate.type === "NOR") {
      ctx.beginPath();
      ctx.arc(x + width + 5, y + height / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();

  // Draw pins
  const pins = getPinPositions(gate);
  pins.inputs.forEach((pin) => {
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#4b5563";
    ctx.fill();
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  pins.outputs.forEach((pin) => {
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#4b5563";
    ctx.fill();
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Draw label
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (gate.type === "INPUT") {
    ctx.fillStyle = gate.value ? "#10b981" : "#ef4444";
    ctx.fillText(gate.value ? "1" : "0", x + width / 2, y + height / 2);
  } else if (gate.type !== "OUTPUT") {
    ctx.fillText(gate.type, x + width / 2, y + height / 2);
  }
}

export function isPointInGate(gate, x, y) {
  return (
    x >= gate.x &&
    x <= gate.x + gate.width &&
    y >= gate.y &&
    y <= gate.y + gate.height
  );
}

export function getPinAtPoint(gate, x, y, radius = 8) {
  const pins = getPinPositions(gate);
  for (const pin of pins.inputs) {
    if (Math.sqrt((x - pin.x) ** 2 + (y - pin.y) ** 2) <= radius) {
      return { type: "input", pin, gateId: gate.id };
    }
  }
  for (const pin of pins.outputs) {
    if (Math.sqrt((x - pin.x) ** 2 + (y - pin.y) ** 2) <= radius) {
      return { type: "output", pin, gateId: gate.id };
    }
  }
  return null;
}
