/**
 * HiDPI Canvas Dual-Chart Renderer
 * - Chart 1: MPG Efficiency vs. Speed (15 - 100 mph) for all 4 vehicle shapes
 * - Chart 2: Aerodynamic Drag Power (hp, v^3) or Force (lbf, v^2) vs. Speed (0 - 100 mph)
 * - Supports click/drag scrubbing along the speed axis
 */
(function (root) {
  'use strict';

  function getVehicleColor(id, palette) {
    return (palette.vehicles && palette.vehicles[id]) || '#3b82f6';
  }

  function bindScrubInteraction(canvas, minSpeed, maxSpeed, padLeft, padRight, onSpeedChange) {
    let dragging = false;

    function speedFromEvent(ev) {
      const rect = canvas.getBoundingClientRect();
      const plotW = Math.max(1, rect.width - padLeft - padRight);
      const x = Math.max(0, Math.min(plotW, ev.clientX - rect.left - padLeft));
      const raw = minSpeed + (x / plotW) * (maxSpeed - minSpeed);
      return Math.round(Math.max(0, Math.min(100, raw)));
    }

    canvas.addEventListener('pointerdown', (ev) => {
      dragging = true;
      canvas.setPointerCapture(ev.pointerId);
      onSpeedChange(speedFromEvent(ev));
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      onSpeedChange(speedFromEvent(ev));
    });

    const stop = () => { dragging = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  function renderSpeedChart(canvas, opts) {
    const {
      AeroPhysics,
      activeVehicleId,
      speedMph,
      physicsOptions,
      palette,
      kind, // 'mpg' | 'power' | 'force'
    } = opts;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = { left: 50, right: 18, top: 20, bottom: 34 };
    const plotW = Math.max(10, width - pad.left - pad.right);
    const plotH = Math.max(10, height - pad.top - pad.bottom);

    const minX = kind === 'mpg' ? 15 : 0;
    const maxX = 100;

    const curves = AeroPhysics.VEHICLE_ORDER.map((id) =>
      AeroPhysics.computeCurve(id, physicsOptions, minX, maxX, 1)
    );

    let yMax = 0;
    const includeElectricInMpgScale =
      kind === 'mpg' && activeVehicleId === 'escooter' && !(physicsOptions && physicsOptions.isolateShape);
    for (const c of curves) {
      if (kind === 'mpg' && c.config.isElectric && !includeElectricInMpgScale) continue;
      for (const pt of c.points) {
        const val = kind === 'mpg' ? pt.mpg : kind === 'power' ? pt.dragHp : pt.dragLbf;
        if (val > yMax) yMax = val;
      }
    }
    const niceStep =
      kind === 'mpg' ? (includeElectricInMpgScale ? 200 : 10) : kind === 'power' ? 25 : 100;
    yMax = Math.max(niceStep, Math.ceil((yMax * 1.12) / niceStep) * niceStep);

    const xToPx = (mph) => pad.left + ((mph - minX) / (maxX - minX)) * plotW;
    const yToPx = (val) => pad.top + plotH - (val / yMax) * plotH;

    // Gridlines
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.lineWidth = 1;
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const val = (yMax * i) / yTicks;
      const y = yToPx(val);
      ctx.strokeStyle = palette.grid;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      ctx.fillStyle = palette.muted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(val).toString(), pad.left - 8, y);
    }

    const xTicks = kind === 'mpg' ? [15, 35, 55, 75, 100] : [0, 25, 50, 75, 100];
    for (const mph of xTicks) {
      const x = xToPx(mph);
      ctx.strokeStyle = palette.grid;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();

      ctx.fillStyle = palette.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${mph} mph`, x, pad.top + plotH + 8);
    }

    // 55 mph highway reference on MPG chart
    if (kind === 'mpg') {
      const refX = xToPx(55);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = palette.muted;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(refX, pad.top);
      ctx.lineTo(refX, pad.top + plotH);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = palette.muted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('55 mph ref', refX + 4, pad.top + 4);
    }

    // Draw inactive curves first, then active vehicle bold with area fill (clipped inside plot box)
    const ordered = [...curves].sort((a, b) =>
      a.config.id === activeVehicleId ? 1 : b.config.id === activeVehicleId ? -1 : 0
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plotW, plotH);
    ctx.clip();

    for (const curve of ordered) {
      const isActive = curve.config.id === activeVehicleId;
      const color = getVehicleColor(curve.config.id, palette);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 3 : 1.75;
      ctx.globalAlpha = isActive ? 1 : 0.65;
      ctx.beginPath();

      curve.points.forEach((pt, idx) => {
        const val = kind === 'mpg' ? pt.mpg : kind === 'power' ? pt.dragHp : pt.dragLbf;
        const px = xToPx(pt.speedMph);
        const py = yToPx(val);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      if (isActive && curve.points.length > 1) {
        ctx.lineTo(xToPx(curve.points[curve.points.length - 1].speedMph), pad.top + plotH);
        ctx.lineTo(xToPx(curve.points[0].speedMph), pad.top + plotH);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
        grad.addColorStop(0, color + '36');
        grad.addColorStop(1, color + '02');
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();

      // Peak MPG marker on active curve
      if (isActive && kind === 'mpg') {
        let peakPt = curve.points[0];
        for (const pt of curve.points) {
          if (pt.mpg > peakPt.mpg) peakPt = pt;
        }
        const pkX = xToPx(peakPt.speedMph);
        const pkY = yToPx(peakPt.mpg);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pkX, pkY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Peak ${peakPt.mpg.toFixed(1)} @ ${peakPt.speedMph}`, pkX, Math.max(pad.top + 12, pkY - 7));
      }
    }

    // Active speed cursor line + dots
    const clampedMph = Math.max(minX, Math.min(maxX, speedMph));
    const cursorX = xToPx(clampedMph);
    ctx.save();
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cursorX, pad.top);
    ctx.lineTo(cursorX, pad.top + plotH);
    ctx.stroke();
    ctx.restore();

    // Dots & compact readout box
    const activeVals = AeroPhysics.VEHICLE_ORDER.map((id) => {
      const m = AeroPhysics.computeMetrics(id, clampedMph, physicsOptions);
      const val = kind === 'mpg' ? m.mpg : kind === 'power' ? m.dragHp : m.dragLbf;
      return { id, name: m.config.shortName, val, isElectric: m.config.isElectric, color: getVehicleColor(id, palette) };
    });

    for (const item of activeVals) {
      const py = yToPx(item.val);
      const isAct = item.id === activeVehicleId;
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(cursorX, py, isAct ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (isAct) {
        ctx.strokeStyle = palette.surface;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();

    // Floating multi-vehicle legend box at top-right (or top-left for power/force curves)
    const rowH = 14;
    const boxW = 166;
    const boxH = 20 + activeVals.length * rowH;
    const boxX = kind === 'mpg' ? pad.left + plotW - boxW - 6 : pad.left + 8;
    const boxY = pad.top + 6;

    ctx.fillStyle = palette.tooltipBg;
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`@ ${clampedMph} mph`, boxX + 8, boxY + 4);

    ctx.font = '10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    activeVals.forEach((item, idx) => {
      const rowY = boxY + 19 + idx * rowH;
      const unit = kind === 'mpg' ? (item.isElectric ? 'MPGe' : 'MPG') : kind === 'power' ? 'hp' : 'lbf';
      ctx.fillStyle = item.color;
      ctx.fillRect(boxX + 8, rowY + 2, 7, 7);
      ctx.fillStyle = item.id === activeVehicleId ? palette.text : palette.muted;
      ctx.fillText(`${item.name}: ${item.val.toFixed(1)} ${unit}`, boxX + 19, rowY);
    });
  }

  const AeroCharts = {
    bindScrubInteraction,
    renderSpeedChart,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AeroCharts;
  } else {
    root.AeroCharts = AeroCharts;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
