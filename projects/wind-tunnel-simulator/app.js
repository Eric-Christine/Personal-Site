/**
 * Main interactive loop, Wind Tunnel Canvas renderer, UI controls,
 * KPI updates, and comparison table synchronization.
 */
(function () {
  'use strict';

  const AeroPhysics = window.AeroPhysics;
  const WindTunnelSolver = window.WindTunnelSolver;
  const AeroCharts = window.AeroCharts;

  const state = {
    vehicleId: 'sedan',
    categoryFilter: 'all',
    speedMph: 65,
    fieldMode: 'velocity', // 'velocity' | 'pressure' | 'vorticity' | 'smoke'
    showCallouts: true,
    showVectors: false,
    isolateShape: false,
    roofBox: false,
    tonneauCover: false,
    dragChartMode: 'power', // 'power' | 'force'
    sweeping: false,
    wheelAngle: 0,
    roadOffset: 0,
  };

  const solver = new WindTunnelSolver(204, 85);

  // Offscreen buffer for bilinearly upscaled CFD field
  const fieldCanvas = document.createElement('canvas');
  fieldCanvas.width = solver.nx;
  fieldCanvas.height = solver.ny;
  const fieldCtx = fieldCanvas.getContext('2d');
  const fieldImage = fieldCtx.createImageData(solver.nx, solver.ny);

  // DOM Elements
  const formEl = document.getElementById('tunnel-controls');
  const vehicleOptionsEl = document.getElementById('vehicle-options');
  const categoryTabsEl = document.getElementById('category-tabs');
  const thLiveSpeed = document.getElementById('th-live-speed');
  const speedSlider = document.getElementById('wind-speed');
  const speedReadout = document.getElementById('speed-readout');
  const sweepBtn = document.getElementById('sweep-btn');
  const roofboxWrap = document.getElementById('roofbox-wrap');
  const tonneauWrap = document.getElementById('tonneau-wrap');
  const optCallouts = document.getElementById('opt-callouts');
  const optVectors = document.getElementById('opt-vectors');
  const optIsolate = document.getElementById('opt-isolate');
  const optRoofbox = document.getElementById('opt-roofbox');
  const optTonneau = document.getElementById('opt-tonneau');
  const tunnelCanvas = document.getElementById('tunnel-canvas');
  const mpgChartCanvas = document.getElementById('mpg-chart');
  const dragChartCanvas = document.getElementById('drag-chart');
  const dragModePowerBtn = document.getElementById('drag-mode-power');
  const dragModeForceBtn = document.getElementById('drag-mode-force');
  const dragChartTitle = document.getElementById('drag-chart-title');
  const dragChartSubtitle = document.getElementById('drag-chart-subtitle');
  const tunnelVehicleTitle = document.getElementById('tunnel-vehicle-title');
  const tunnelLegendDesc = document.getElementById('tunnel-legend-desc');
  const comparisonTbody = document.getElementById('comparison-tbody');
  const isolateNote = document.getElementById('isolate-note');

  const kpiMpg = document.getElementById('kpi-mpg');
  const kpiMpgSub = document.getElementById('kpi-mpg-sub');
  const kpiDragForce = document.getElementById('kpi-drag-force');
  const kpiDragForceSub = document.getElementById('kpi-drag-force-sub');
  const kpiDragPower = document.getElementById('kpi-drag-power');
  const kpiDragPowerSub = document.getElementById('kpi-drag-power-sub');
  const kpiAeroBar = document.getElementById('kpi-aero-bar');
  const kpiCda = document.getElementById('kpi-cda');
  const kpiCdaSub = document.getElementById('kpi-cda-sub');

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function isDarkTheme() {
    if (document.documentElement.classList.contains('light')) return false;
    if (document.documentElement.classList.contains('dark')) return true;
    return darkQuery.matches;
  }

  function getPalette() {
    const dark = isDarkTheme();
    return {
      dark,
      tunnelBg: dark ? '#080e17' : '#e8eef5',
      roadBg: dark ? '#121a26' : '#cbd5e1',
      roadLine: dark ? '#334155' : '#64748b',
      grid: dark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.10)',
      border: dark ? '#25334a' : '#cbd5e1',
      surface: dark ? '#111927' : '#ffffff',
      text: dark ? '#edf2f8' : '#0f172a',
      muted: dark ? '#94a3b8' : '#475569',
      tooltipBg: dark ? 'rgba(17, 25, 39, 0.90)' : 'rgba(255, 255, 255, 0.92)',
      vehicles: {
        sedan: '#3b82f6',
        suv: '#8b5cf6',
        fullsize_suv: '#ec4899',
        truck: '#f59e0b',
        minivan: '#10b981',
        coupe: '#06b6d4',
        motorcycle: '#f97316',
        escooter: '#84cc16',
      },
    };
  }

  function getPhysicsOptions() {
    return {
      isolateShape: state.isolateShape,
      roofBox: state.roofBox,
      tonneauCover: state.tonneauCover,
    };
  }

  function syncSliderVisuals() {
    speedSlider.style.setProperty('--attr-min', speedSlider.min || '0');
    speedSlider.style.setProperty('--attr-max', speedSlider.max || '100');
    speedSlider.style.setProperty('--control-value', String(state.speedMph));
    speedSlider.setAttribute('aria-valuetext', `${state.speedMph} miles per hour`);
  }

  function buildVehicleSvg(svgKey) {
    const s = AeroPhysics.SVG_SHAPES[svgKey] || AeroPhysics.SVG_SHAPES.sedan;
    let inner = '';
    if (s.scooterStroke) {
      inner += `<path d="${s.scooterStroke}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (s.path) {
      inner += `<path d="${s.path}" fill="currentColor" opacity="0.22" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>`;
    }
    if (s.riderPath) {
      inner += `<path d="${s.riderPath}" fill="currentColor" opacity="0.45" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`;
    }
    if (s.head) {
      inner += `<circle cx="${s.head.cx}" cy="${s.head.cy}" r="${s.head.r}" fill="currentColor"/>`;
    }
    for (const w of s.wheels) {
      inner += `<circle cx="${w.cx}" cy="${w.cy}" r="${w.r}" fill="currentColor"/>`;
    }
    return `<svg class="vehicle-icon" viewBox="0 0 120 48" aria-hidden="true">${inner}</svg>`;
  }

  function renderVehicleCards() {
    const visibleIds = new Set(AeroPhysics.getFilteredVehicles(state.categoryFilter));
    if (!vehicleOptionsEl.hasChildNodes()) {
      vehicleOptionsEl.innerHTML = AeroPhysics.VEHICLE_ORDER.map((id) => {
        const v = AeroPhysics.VEHICLES[id];
        const badge = v.isTop10
          ? `<span class="vehicle-badge">${v.salesRank}</span>`
          : (v.isElectric ? `<span class="vehicle-badge">EV</span>` : '');
        return `<div class="vehicle-item" data-vehicle-item="${id}">
          <input class="visually-hidden" type="radio" name="vehicle" id="veh-${id}" value="${id}" ${id === state.vehicleId ? 'checked' : ''} />
          <label class="vehicle-card" for="veh-${id}">
            ${buildVehicleSvg(v.svgKey)}
            <span class="vehicle-meta">
              <span class="vehicle-name"><span class="vehicle-dot" style="background: ${v.bodyColor}"></span><span>${v.name}</span>${badge}</span>
              <span class="vehicle-specs">Cd ${v.cd.toFixed(v.cd % 0.01 ? 3 : 2)} &bull; ${v.area.toFixed(2)} m&sup2; &bull; CdA ${(v.cd * v.area).toFixed(2)}</span>
            </span>
          </label>
        </div>`;
      }).join('');
    }
    vehicleOptionsEl.querySelectorAll('[data-vehicle-item]').forEach((el) => {
      const id = el.getAttribute('data-vehicle-item');
      el.hidden = !visibleIds.has(id);
    });
    const activeRadio = document.getElementById(`veh-${state.vehicleId}`);
    if (activeRadio) activeRadio.checked = true;
  }

  function updateObstacles() {
    const cfg = AeroPhysics.getVehicleConfig(state.vehicleId, getPhysicsOptions());
    solver.setObstacles(cfg.cfdPolygons);
    tonneauWrap.hidden = !cfg.polygonCovered;
    if (roofboxWrap) roofboxWrap.hidden = !cfg.roofMount;
  }

  function updateTelemetry() {
    const opts = getPhysicsOptions();
    const m = AeroPhysics.computeMetrics(state.vehicleId, state.speedMph, opts);
    const cfg = m.config;

    speedReadout.textContent = `${state.speedMph} mph (${m.vMs.toFixed(1)} m/s)`;
    tunnelVehicleTitle.textContent = `${cfg.name} \u2022 ${state.speedMph} mph`;

    const modeDescs = {
      velocity: 'Air velocity magnitude + 14 RK2 smoke ribbons \u2022 Moving road floor',
      pressure: 'Pressure Cp (Red: High Stagnation, Cyan/Blue: Low Suction Wake)',
      vorticity: 'Wake vorticity & eddy shedding (Amber/Red: CW, Cyan/Blue: CCW)',
      smoke: 'High-contrast wind tunnel smoke rake & tracer streaks',
    };
    tunnelLegendDesc.textContent = modeDescs[state.fieldMode] || modeDescs.velocity;

    const unit = cfg.isElectric ? 'MPGe' : 'MPG';
    if (state.speedMph === 0) {
      kpiMpg.textContent = `0.0 ${unit}`;
      kpiMpgSub.textContent = cfg.isElectric
        ? `${(m.pFuelW / 1000).toFixed(2)} kW elec idle \u2022 Stationary`
        : `${m.galPerHour.toFixed(2)} gal/hr idle \u2022 Stationary`;
    } else {
      const sign = m.pctVs55 >= 0 ? '+' : '';
      kpiMpg.textContent = `${m.mpg.toFixed(1)} ${unit}`;
      kpiMpgSub.textContent = cfg.isElectric
        ? `${(m.pFuelW / 1000).toFixed(2)} kW elec \u2022 ${sign}${m.pctVs55.toFixed(1)}% vs 55 mph`
        : `${m.galPerHour.toFixed(2)} gal/hr \u2022 ${sign}${m.pctVs55.toFixed(1)}% vs 55 mph`;
    }

    kpiDragForce.textContent = `${m.dragLbf.toFixed(1)} lbf`;
    kpiDragForceSub.textContent = `${Math.round(m.fDragN)} N \u2022 Dynamic q = ${Math.round(m.qPa)} Pa`;

    kpiDragPower.textContent = `${m.dragHp.toFixed(1)} hp`;
    kpiDragPowerSub.textContent = `${m.dragKw.toFixed(1)} kW \u2022 ${m.aeroSharePct.toFixed(1)}% Aero / ${m.rollSharePct.toFixed(1)}% Rolling`;
    kpiAeroBar.style.inlineSize = `${Math.max(0, Math.min(100, m.aeroSharePct)).toFixed(1)}%`;

    kpiCda.textContent = `${m.cdA.toFixed(3)} m\u00b2`;
    kpiCdaSub.textContent = `Cd ${m.cd.toFixed(3)} \u00d7 ${m.area.toFixed(2)} m\u00b2 (${m.cdAFt2.toFixed(2)} ft\u00b2)`;

    isolateNote.innerHTML = state.isolateShape
      ? '<strong>Isolate Shape Effect active:</strong> Mass (1,580 kg), rolling resistance, and powertrain efficiency are locked to the Sedan so differences come 100% from body shape (Cd &times; A).'
      : 'Real-world mode uses each vehicle\u2019s typical mass, rolling resistance, frontal area, and powertrain baseline. Enable <strong>Isolate Shape Effect</strong> above to lock weight &amp; engine equal to the Sedan and observe pure body-shape drag.';

    updateComparisonTable(opts);
    drawCharts();
  }

  function updateComparisonTable(opts) {
    if (thLiveSpeed) thLiveSpeed.textContent = `Live @ ${state.speedMph} mph`;
    const list = AeroPhysics.getFilteredVehicles(state.categoryFilter);
    const ids = list.includes(state.vehicleId) ? list : [state.vehicleId, ...list];
    const rows = ids
      .map((id) => {
        const m35 = AeroPhysics.computeMetrics(id, 35, opts);
        const m65 = AeroPhysics.computeMetrics(id, 65, opts);
        const m100 = AeroPhysics.computeMetrics(id, 100, opts);
        const mLive = AeroPhysics.computeMetrics(id, state.speedMph, opts);
        return { id, m35, m65, m100, mLive };
      })
      .sort((a, b) => a.mLive.cdA - b.mLive.cdA);

    comparisonTbody.innerHTML = rows
      .map(({ id, m35, m65, m100, mLive }) => {
        const cfg = mLive.config;
        const unit = cfg.isElectric ? 'MPGe' : 'MPG';
        const active = id === state.vehicleId ? ' data-active-row="true"' : '';
        const liveCell = state.speedMph === 0
          ? `0.0 ${unit} &bull; 0 lbf &bull; 0.0 hp`
          : `${mLive.mpg.toFixed(1)} ${unit} &bull; ${mLive.dragLbf.toFixed(0)} lbf &bull; ${mLive.dragHp.toFixed(1)} hp`;
        return `<tr${active}>
          <th scope="row">
            <button type="button" class="table-select-btn" data-select-vehicle="${id}">
              <span class="vehicle-dot" style="background: ${cfg.bodyColor}"></span>
              <span>${cfg.name}</span>
            </button>
          </th>
          <td>${cfg.powertrain || 'Gas'}</td>
          <td>${mLive.cd.toFixed(3)}</td>
          <td>${mLive.area.toFixed(2)} m&sup2;</td>
          <td>${mLive.cdA.toFixed(3)} m&sup2;</td>
          <td>${m35.mpg.toFixed(1)} ${unit}</td>
          <td>${m65.mpg.toFixed(1)} ${unit}</td>
          <td>${m100.mpg.toFixed(1)} ${unit}</td>
          <td>${liveCell}</td>
        </tr>`;
      })
      .join('');
  }

  function drawCharts() {
    const palette = getPalette();
    const opts = getPhysicsOptions();
    const peerIds = AeroPhysics.getChartPeers(state.vehicleId, state.categoryFilter);

    AeroCharts.renderSpeedChart(mpgChartCanvas, {
      AeroPhysics,
      activeVehicleId: state.vehicleId,
      vehicleIds: peerIds,
      speedMph: state.speedMph,
      physicsOptions: opts,
      palette,
      kind: 'mpg',
    });

    AeroCharts.renderSpeedChart(dragChartCanvas, {
      AeroPhysics,
      activeVehicleId: state.vehicleId,
      vehicleIds: peerIds,
      speedMph: state.speedMph,
      physicsOptions: opts,
      palette,
      kind: state.dragChartMode,
    });
  }

  // Color ramp helpers for the 204x85 CFD field
  function writeFieldPixels(palette) {
    const { nx, ny, u, v, cp, curl, smoke, s } = solver;
    const data = fieldImage.data;
    const uRef = Math.max(0.45, solver.lastUSim || 0.45);
    const speedIntensity = Math.min(1, 0.25 + 0.75 * (state.speedMph / 100));
    const dark = palette.dark;

    for (let x = 0; x < nx; x++) {
      const col = x * ny;
      for (let y = 0; y < ny; y++) {
        // Canvas Y is flipped relative to CFD Y (y=0 is floor at bottom)
        const py = ny - 1 - y;
        const idx = (py * nx + x) * 4;
        const cell = col + y;

        if (s[cell] === 0 && y > 0 && y < ny - 1 && x > 0) {
          data[idx] = dark ? 15 : 220;
          data[idx + 1] = dark ? 23 : 228;
          data[idx + 2] = dark ? 38 : 238;
          data[idx + 3] = 255;
          continue;
        }

        const sm = Math.min(1, smoke[cell]);
        let r = dark ? 8 : 232;
        let g = dark ? 14 : 238;
        let b = dark ? 23 : 245;

        if (state.fieldMode === 'velocity') {
          const uc = 0.5 * (u[col + y] + u[(x + 1) * ny + y]);
          const vc = 0.5 * (v[x * (ny + 1) + y] + v[x * (ny + 1) + y + 1]);
          const mag = Math.hypot(uc, vc) / (uRef * 1.45);
          const t = Math.max(0, Math.min(1, mag));
          // Deep slate -> royal blue -> cyan -> bright teal/amber
          if (t < 0.45) {
            const k = t / 0.45;
            r = (dark ? 10 : 210) + k * (dark ? 18 : -110);
            g = (dark ? 18 : 224) + k * (dark ? 68 : -84);
            b = (dark ? 36 : 242) + k * (dark ? 150 : -20);
          } else {
            const k = (t - 0.45) / 0.55;
            r = (dark ? 28 : 100) + k * 56;
            g = (dark ? 86 : 140) + k * 100;
            b = (dark ? 186 : 222) + k * 30;
          }
          const mist = sm * (dark ? 72 : 42);
          r = Math.min(255, r + mist * 0.55);
          g = Math.min(255, g + mist * 0.85);
          b = Math.min(255, b + mist);
        } else if (state.fieldMode === 'pressure') {
          const val = Math.max(-1.6, Math.min(1.6, cp[cell] * speedIntensity));
          if (val >= 0) {
            const k = Math.min(1, val / 1.15);
            r = (dark ? 16 : 232) + k * (239 - (dark ? 16 : 232));
            g = (dark ? 24 : 238) + k * (82 - (dark ? 24 : 238));
            b = (dark ? 38 : 245) + k * (44 - (dark ? 38 : 245));
          } else {
            const k = Math.min(1, -val / 1.15);
            r = (dark ? 16 : 232) + k * (14 - (dark ? 16 : 232));
            g = (dark ? 24 : 238) + k * (165 - (dark ? 24 : 238));
            b = (dark ? 38 : 245) + k * (233 - (dark ? 38 : 245));
          }
          r = Math.min(255, r + sm * 28);
          g = Math.min(255, g + sm * 35);
          b = Math.min(255, b + sm * 42);
        } else if (state.fieldMode === 'vorticity') {
          const w = (curl[cell] / uRef) * 3.2;
          if (w >= 0) {
            const k = Math.min(1, w);
            r = (dark ? 10 : 232) + k * (245 - (dark ? 10 : 232));
            g = (dark ? 16 : 238) + k * (118 - (dark ? 16 : 238));
            b = (dark ? 28 : 245) + k * (24 - (dark ? 28 : 245));
          } else {
            const k = Math.min(1, -w);
            r = (dark ? 10 : 232) + k * (34 - (dark ? 10 : 232));
            g = (dark ? 16 : 238) + k * (198 - (dark ? 16 : 238));
            b = (dark ? 28 : 245) + k * (245 - (dark ? 28 : 245));
          }
          const mist = sm * 25;
          r = Math.min(255, r + mist);
          g = Math.min(255, g + mist);
          b = Math.min(255, b + mist);
        } else {
          // Pure Smoke
          const base = dark ? 10 : 235;
          const sMix = sm;
          if (dark) {
            r = base + sMix * 170;
            g = base + 5 + sMix * 215;
            b = base + 14 + sMix * 240;
          } else {
            r = base - sMix * 195;
            g = base + 3 - sMix * 115;
            b = base + 8 - sMix * 20;
          }
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    fieldCtx.putImageData(fieldImage, 0, 0);
  }

  function drawVehicle(ctx, w, h, cfg, palette) {
    const toX = (nx) => nx * w;
    const toY = (ny) => (1 - ny) * h;

    // 1. Optional roof cargo box & mounting bars
    if (cfg.roofBoxPolygon) {
      ctx.save();
      ctx.strokeStyle = palette.dark ? '#94a3b8' : '#475569';
      ctx.lineWidth = Math.max(2, w * 0.003);
      const m = cfg.roofMount;
      ctx.beginPath();
      ctx.moveTo(toX(m.x0 + 0.025), toY(m.y));
      ctx.lineTo(toX(m.x0 + 0.025), toY(m.y + 0.017));
      ctx.moveTo(toX(m.x1 - 0.025), toY(m.y));
      ctx.lineTo(toX(m.x1 - 0.025), toY(m.y + 0.017));
      ctx.stroke();

      ctx.beginPath();
      cfg.roofBoxPolygon.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(toX(px), toY(py));
        else ctx.lineTo(toX(px), toY(py));
      });
      ctx.closePath();
      ctx.fillStyle = palette.dark ? '#334155' : '#475569';
      ctx.fill();
      ctx.strokeStyle = palette.dark ? '#cbd5e1' : '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Main vehicle body silhouette with metallic gradient
    ctx.save();
    ctx.beginPath();
    cfg.bodyPolygon.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(toX(px), toY(py));
      else ctx.lineTo(toX(px), toY(py));
    });
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, toY(0.42), 0, toY(0.03));
    grad.addColorStop(0, cfg.bodyColor);
    grad.addColorStop(1, cfg.bodyAccent);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = palette.dark ? '#e2e8f0' : '#0f172a';
    ctx.stroke();

    // Tonneau cover highlight line if active on truck
    if (cfg.tonneauActive) {
      ctx.beginPath();
      ctx.moveTo(toX(0.478), toY(0.285));
      ctx.lineTo(toX(0.664), toY(0.285));
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = palette.dark ? '#f8fafc' : '#1e293b';
      ctx.stroke();
    }

    // Cabin windows
    if (cfg.cabinWindow) {
      ctx.beginPath();
      cfg.cabinWindow.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(toX(px), toY(py));
        else ctx.lineTo(toX(px), toY(py));
      });
      ctx.closePath();
      ctx.fillStyle = palette.dark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.72)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
      ctx.stroke();
    }

    // Headlight & taillight accents
    if (cfg.visualType === 'motorcycle') {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(toX(0.308), toY(0.165), 5, 6);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(toX(0.471), toY(0.194), 5, 4);
    } else if (cfg.visualType === 'escooter') {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(toX(0.338), toY(0.220), 4, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(toX(0.435), toY(0.056), 4, 4);
    } else {
      const nosePt = cfg.bodyPolygon[1];
      const tailPt = cfg.bodyPolygon[cfg.bodyPolygon.length - 5];
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(toX(nosePt[0]), toY(nosePt[1]) - 3, 6, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(toX(tailPt[0]) - 5, toY(tailPt[1]) - 3, 5, 6);
    }
    ctx.restore();

    // 2b. Optional human rider silhouette (motorcyclist / e-scooter commuter)
    if (cfg.riderPolygon) {
      ctx.save();
      ctx.beginPath();
      cfg.riderPolygon.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(toX(px), toY(py));
        else ctx.lineTo(toX(px), toY(py));
      });
      ctx.closePath();
      ctx.fillStyle = palette.dark ? '#1e293b' : '#334155';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = palette.dark ? '#cbd5e1' : '#0f172a';
      ctx.stroke();

      if (cfg.visualType === 'motorcycle') {
        // Handlebar grip + tucked racing helmet & visor
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(toX(0.344), toY(0.205));
        ctx.lineTo(toX(0.365), toY(0.214));
        ctx.stroke();

        ctx.fillStyle = cfg.bodyColor;
        ctx.beginPath();
        ctx.ellipse(toX(0.386), toY(0.264), Math.max(8, w * 0.017), Math.max(7, h * 0.019), 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = palette.dark ? '#f8fafc' : '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(toX(0.374), toY(0.263), Math.max(4, w * 0.007), Math.max(3, h * 0.008), 0.15, 0, Math.PI * 2);
        ctx.fill();
      } else if (cfg.visualType === 'escooter') {
        // Scooter handlebar grip + upright commuter helmet & visor
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(toX(0.340), toY(0.232));
        ctx.lineTo(toX(0.362), toY(0.232));
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(toX(0.392), toY(0.352), Math.max(7, w * 0.016), Math.max(7, h * 0.024), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(toX(0.374), toY(0.358), Math.max(5, w * 0.009), Math.max(4, h * 0.011));
      }
      ctx.restore();
    }

    // 3. Rotating wheels drawn in foreground (outside CFD underbody gap)
    for (const wh of cfg.wheels) {
      const cx = toX(wh.x);
      const cy = toY(wh.y);
      const radiusPx = wh.r * h;

      // Wheel arch shadow
      ctx.fillStyle = '#090d14';
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx * 1.12, Math.PI, 0);
      ctx.fill();

      // Tire
      ctx.fillStyle = '#181e29';
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      // Alloy rim
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx * 0.58, 0, Math.PI * 2);
      ctx.fill();

      // Rotating spokes
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(state.wheelAngle);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.5, radiusPx * 0.11);
      for (let k = 0; k < 5; k++) {
        const a = (k * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * radiusPx * 0.54, Math.sin(a) * radiusPx * 0.54);
        ctx.stroke();
      }
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, radiusPx * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTunnel(dtSec) {
    const dpr = window.devicePixelRatio || 1;
    const width = tunnelCanvas.clientWidth;
    const height = tunnelCanvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (tunnelCanvas.width !== targetW || tunnelCanvas.height !== targetH) {
      tunnelCanvas.width = targetW;
      tunnelCanvas.height = targetH;
    }

    const palette = getPalette();
    const cfg = AeroPhysics.getVehicleConfig(state.vehicleId, getPhysicsOptions());
    const ctx = tunnelCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Bilinearly upscaled Eulerian CFD field
    writeFieldPixels(palette);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fieldCanvas, 0, 0, width, height);

    const toX = (nx) => nx * width;
    const toY = (ny) => (1 - ny) * height;

    // 2. Smoke rake nozzles on left wall
    ctx.fillStyle = palette.dark ? '#64748b' : '#475569';
    for (const ry of solver.rakeY) {
      const py = toY(ry);
      ctx.fillRect(0, py - 1.5, 10, 3);
    }

    // 3. 14 RK2 continuous smoke ribbons
    if (state.speedMph > 0) {
      const lines = solver.traceStreamlines(200);
      ctx.save();
      ctx.lineWidth = state.fieldMode === 'smoke' ? 2.0 : 1.35;
      ctx.strokeStyle =
        state.fieldMode === 'smoke'
          ? (palette.dark ? 'rgba(224, 242, 254, 0.78)' : 'rgba(14, 116, 144, 0.72)')
          : (palette.dark ? 'rgba(255, 255, 255, 0.42)' : 'rgba(15, 23, 42, 0.35)');
      for (const pts of lines) {
        if (pts.length < 2) continue;
        ctx.beginPath();
        pts.forEach(([px, py], idx) => {
          if (idx === 0) ctx.moveTo(toX(px), toY(py));
          else ctx.lineTo(toX(px), toY(py));
        });
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. 1,400 Lagrangian streak particles
    if (state.speedMph > 0) {
      ctx.save();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle =
        palette.dark ? 'rgba(186, 230, 253, 0.58)' : 'rgba(2, 132, 199, 0.52)';
      ctx.beginPath();
      for (let i = 0; i < solver.particleCount; i++) {
        const x0 = solver.prevPx[i];
        const y0 = solver.prevPy[i];
        const x1 = solver.px[i];
        const y1 = solver.py[i];
        // Skip respawn jumps across the tunnel
        if (Math.abs(x1 - x0) > 0.08 || Math.abs(y1 - y0) > 0.08) continue;
        ctx.moveTo(toX(x0), toY(y0));
        ctx.lineTo(toX(x1), toY(y1));
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Optional velocity vector arrows
    if (state.showVectors && state.speedMph > 0) {
      const uRef = Math.max(0.45, solver.lastUSim || 0.45);
      ctx.save();
      ctx.strokeStyle = palette.dark ? 'rgba(248, 250, 252, 0.65)' : 'rgba(15, 23, 42, 0.60)';
      ctx.lineWidth = 1.1;
      for (let gx = 8; gx < solver.nx - 6; gx += 11) {
        for (let gy = 4; gy < solver.ny - 3; gy += 6) {
          if (solver.s[gx * solver.ny + gy] === 0) continue;
          const xn = (gx + 0.5) / solver.nx;
          const yn = (gy + 0.5) / solver.ny;
          const vel = solver.sampleVelocityNorm(xn, yn);
          const sx = toX(xn);
          const sy = toY(yn);
          const dx = (vel.u / uRef) * 14;
          const dy = -(vel.v / uRef) * 14;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + dx, sy + dy);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 6. Moving road floor belt
    const roadH = Math.max(8, height / solver.ny);
    const roadY = height - roadH;
    ctx.fillStyle = palette.roadBg;
    ctx.fillRect(0, roadY, width, roadH);
    ctx.fillStyle = palette.roadLine;
    const speedMs = state.speedMph * AeroPhysics.CONSTANTS.MPH_TO_MS;
    state.roadOffset = (state.roadOffset + speedMs * dtSec * 36) % 48;
    for (let rx = -state.roadOffset; rx < width; rx += 48) {
      ctx.fillRect(rx, roadY + roadH * 0.35, 22, 2);
    }

    // 7. Vehicle profile & spinning wheels
    drawVehicle(ctx, width, height, cfg, palette);

    // 8. Anchored Aero Callout Badges
    if (state.showCallouts) {
      ctx.save();
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      for (const pin of cfg.callouts) {
        const text = cfg.tonneauActive && pin.coveredLabel ? pin.coveredLabel : pin.label;
        const px = toX(pin.x);
        const py = toY(pin.y);
        const ax = toX(pin.anchorX);
        const ay = toY(pin.anchorY);
        const textW = ctx.measureText(text).width + 14;
        const boxH = 22;
        const bx = Math.max(14, Math.min(width - textW - 8, ax - textW / 2));
        const by = Math.max(10, Math.min(height - 36, ay - boxH / 2));

        ctx.strokeStyle = palette.dark ? 'rgba(226, 232, 240, 0.55)' : 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(bx + textW / 2, by + boxH / 2);
        ctx.stroke();

        ctx.fillStyle = pin.tone === 'good' ? '#10b981' : pin.tone === 'warn' ? '#f59e0b' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = palette.tooltipBg;
        ctx.strokeStyle = palette.border;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, textW, boxH, 6);
        else ctx.rect(bx, by, textW, boxH);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = palette.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + textW / 2, by + boxH / 2);
      }
      ctx.restore();
    }

    // 9. Corner Field Legend Pill
    const legendLabels = {
      velocity: 'Velocity: Dark Low \u2192 Cyan Fast',
      pressure: 'Cp: Blue Suction \u2194 Red Stagnation',
      vorticity: 'Vorticity: Cyan CCW \u2194 Amber CW',
      smoke: 'Smoke Rake: 14 Laminar/Wake Ribbons',
    };
    const legText = legendLabels[state.fieldMode] || legendLabels.velocity;
    ctx.save();
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    const lw = ctx.measureText(legText).width + 16;
    ctx.fillStyle = palette.tooltipBg;
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(width - lw - 10, 10, lw, 22, 6);
    else ctx.rect(width - lw - 10, 10, lw, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(legText, width - lw - 2, 21);
    ctx.restore();
  }

  function setSpeed(mph) {
    const clamped = Math.max(0, Math.min(100, Math.round(mph)));
    state.speedMph = clamped;
    speedSlider.value = String(clamped);
    syncSliderVisuals();
    updateTelemetry();
  }

  // Event bindings
  formEl.addEventListener('submit', (ev) => ev.preventDefault());

  formEl.addEventListener('change', (ev) => {
    const target = ev.target;
    if (target.name === 'vehicle') {
      state.vehicleId = target.value;
      updateObstacles();
      updateTelemetry();
    } else if (target.name === 'fieldMode') {
      state.fieldMode = target.value;
      updateTelemetry();
    }
  });

  speedSlider.addEventListener('input', () => {
    state.sweeping = false;
    sweepBtn.setAttribute('aria-pressed', 'false');
    sweepBtn.textContent = 'Sweep 0\u2192100';
    setSpeed(Number(speedSlider.value));
  });

  document.querySelectorAll('[data-speed-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.sweeping = false;
      sweepBtn.setAttribute('aria-pressed', 'false');
      sweepBtn.textContent = 'Sweep 0\u2192100';
      setSpeed(Number(btn.getAttribute('data-speed-preset')));
    });
  });

  sweepBtn.addEventListener('click', () => {
    state.sweeping = !state.sweeping;
    sweepBtn.setAttribute('aria-pressed', String(state.sweeping));
    sweepBtn.textContent = state.sweeping ? 'Pause Sweep' : 'Sweep 0\u2192100';
    if (state.sweeping && state.speedMph >= 99) {
      setSpeed(0);
    }
  });

  optCallouts.addEventListener('change', () => { state.showCallouts = optCallouts.checked; });
  optVectors.addEventListener('change', () => { state.showVectors = optVectors.checked; });
  optIsolate.addEventListener('change', () => {
    state.isolateShape = optIsolate.checked;
    updateTelemetry();
  });
  optRoofbox.addEventListener('change', () => {
    state.roofBox = optRoofbox.checked;
    updateObstacles();
    updateTelemetry();
  });
  optTonneau.addEventListener('change', () => {
    state.tonneauCover = optTonneau.checked;
    updateObstacles();
    updateTelemetry();
  });

  dragModePowerBtn.addEventListener('click', () => {
    state.dragChartMode = 'power';
    dragModePowerBtn.classList.add('btn-active');
    dragModeForceBtn.classList.remove('btn-active');
    dragModePowerBtn.setAttribute('aria-pressed', 'true');
    dragModeForceBtn.setAttribute('aria-pressed', 'false');
    dragChartTitle.textContent = 'Aerodynamic Power Lost vs. Speed (v\u00b3)';
    dragChartSubtitle.textContent = 'Doubling speed from 50 to 100 mph multiplies aero power 8\u00d7';
    drawCharts();
  });

  dragModeForceBtn.addEventListener('click', () => {
    state.dragChartMode = 'force';
    dragModeForceBtn.classList.add('btn-active');
    dragModePowerBtn.classList.remove('btn-active');
    dragModeForceBtn.setAttribute('aria-pressed', 'true');
    dragModePowerBtn.setAttribute('aria-pressed', 'false');
    dragChartTitle.textContent = 'Aerodynamic Drag Force vs. Speed (v\u00b2)';
    dragChartSubtitle.textContent = 'Doubling speed from 50 to 100 mph multiplies drag force 4\u00d7';
    drawCharts();
  });

  AeroCharts.bindScrubInteraction(mpgChartCanvas, 15, 100, 50, 18, (mph) => {
    state.sweeping = false;
    sweepBtn.setAttribute('aria-pressed', 'false');
    sweepBtn.textContent = 'Sweep 0\u2192100';
    setSpeed(mph);
  });

  AeroCharts.bindScrubInteraction(dragChartCanvas, 0, 100, 50, 18, (mph) => {
    state.sweeping = false;
    sweepBtn.setAttribute('aria-pressed', 'false');
    sweepBtn.textContent = 'Sweep 0\u2192100';
    setSpeed(mph);
  });

  if (typeof darkQuery.addEventListener === 'function') {
    darkQuery.addEventListener('change', () => {
      drawCharts();
    });
  }
  window.addEventListener('themechange', () => {
    drawCharts();
  });

  const ro = new ResizeObserver(() => {
    drawCharts();
  });
  ro.observe(tunnelCanvas);
  ro.observe(mpgChartCanvas);
  ro.observe(dragChartCanvas);

  function selectVehicle(id) {
    if (!AeroPhysics.VEHICLES[id]) return;
    state.vehicleId = id;
    renderVehicleCards();
    updateObstacles();
    updateTelemetry();
  }

  if (categoryTabsEl) {
    categoryTabsEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-category]');
      if (!btn) return;
      const cat = btn.getAttribute('data-category');
      state.categoryFilter = cat;
      categoryTabsEl.querySelectorAll('[data-category]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      const list = AeroPhysics.getFilteredVehicles(cat);
      if (!list.includes(state.vehicleId) && list.length > 0) {
        state.vehicleId = list[0];
      }
      renderVehicleCards();
      updateObstacles();
      updateTelemetry();
    });
  }

  comparisonTbody.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-select-vehicle]');
    if (!btn) return;
    selectVehicle(btn.getAttribute('data-select-vehicle'));
  });

  // Initialize solver & pre-warm 36 steps for immediate wake clarity on load
  renderVehicleCards();
  updateObstacles();
  syncSliderVisuals();
  for (let i = 0; i < 36; i++) {
    solver.step(state.speedMph);
  }
  updateTelemetry();

  let lastTime = performance.now();
  let sweepAccum = 0;

  function tick(now) {
    const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    if (state.sweeping) {
      sweepAccum += dtSec * 14; // ~7s sweep from 0 to 100 mph
      if (sweepAccum >= 1) {
        const stepInt = Math.floor(sweepAccum);
        sweepAccum -= stepInt;
        const nextMph = state.speedMph + stepInt;
        if (nextMph >= 100) {
          setSpeed(100);
          state.sweeping = false;
          sweepBtn.setAttribute('aria-pressed', 'false');
          sweepBtn.textContent = 'Sweep 0\u2192100';
        } else {
          setSpeed(nextMph);
        }
      }
    }

    // Advance rotating wheels at road speed using each vehicle's wheel radius
    const activeCfg = AeroPhysics.getVehicleConfig(state.vehicleId, getPhysicsOptions());
    const wheelR = activeCfg.wheelRadiusM || 0.34;
    const vMs = state.speedMph * AeroPhysics.CONSTANTS.MPH_TO_MS;
    state.wheelAngle = (state.wheelAngle + (vMs / wheelR) * dtSec) % (Math.PI * 2);

    solver.step(state.speedMph);
    drawTunnel(dtSec);

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
