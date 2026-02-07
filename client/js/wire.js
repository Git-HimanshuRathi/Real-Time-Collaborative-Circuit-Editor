// Wire management

export function createWire(fromGateId, fromPinId, toGateId, toPinId) {
  return {
    id: "wire-" + Math.random().toString(36).substr(2, 9),
    from: { gateId: fromGateId, pinId: fromPinId },
    to: { gateId: toGateId, pinId: toPinId },
  };
}

export function drawWire(ctx, fromX, fromY, toX, toY, isSelected = false) {
  ctx.save();

  const dx = toX - fromX;
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 80);

  if (isSelected) {
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(
      fromX + controlOffset,
      fromY,
      toX - controlOffset,
      toY,
      toX,
      toY,
    );
    ctx.strokeStyle = "rgba(99,102,241,0.5)";
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.bezierCurveTo(
    fromX + controlOffset,
    fromY,
    toX - controlOffset,
    toY,
    toX,
    toY,
  );
  ctx.strokeStyle = isSelected ? "#818cf8" : "#6b7280";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(fromX, fromY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(toX, toY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawTempWire(ctx, fromX, fromY, toX, toY) {
  ctx.save();

  const dx = toX - fromX;
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 80);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.bezierCurveTo(
    fromX + controlOffset,
    fromY,
    toX - controlOffset,
    toY,
    toX,
    toY,
  );
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.stroke();

  ctx.restore();
}
