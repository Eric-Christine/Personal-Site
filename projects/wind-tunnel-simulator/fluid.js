/**
 * Real-time 2D Incompressible Navier-Stokes Wind Tunnel CFD Solver
 *
 * - 204 x 85 staggered Marker-and-Cell (MAC) grid in Float32Arrays
 * - Gauss-Seidel SOR pressure-velocity projection (omega = 1.88, 22 iterations)
 * - Vorticity confinement with wake symmetry-breaking perturbation
 * - Moving road floor boundary condition + open right outlet
 * - Semi-Lagrangian bilinear advection for u, v, and Eulerian smoke mist
 * - 14 RK2 continuous smoke-rake streamlines + 1,400 Lagrangian streak tracers
 */
(function (root) {
  'use strict';

  function pointInPolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0];
      const yi = poly[i][1];
      const xj = poly[j][0];
      const yj = poly[j][1];
      const intersect =
        yi > py !== yj > py &&
        px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  class WindTunnelSolver {
    constructor(nx = 204, ny = 85) {
      this.nx = nx;
      this.ny = ny;
      const n = nx * ny;

      this.u = new Float32Array((nx + 1) * ny);
      this.newU = new Float32Array((nx + 1) * ny);
      this.v = new Float32Array(nx * (ny + 1));
      this.newV = new Float32Array(nx * (ny + 1));
      this.p = new Float32Array(n);
      this.cp = new Float32Array(n);
      this.curl = new Float32Array(n);
      this.smoke = new Float32Array(n);
      this.newSmoke = new Float32Array(n);
      this.s = new Uint8Array(n).fill(1);

      this.stepCount = 0;
      this.lastUSim = 0;

      // 14 smoke rake nozzle heights in normalized [0, 1] tunnel Y
      this.rakeY = [];
      for (let i = 0; i < 14; i++) {
        this.rakeY.push(0.04 + (i / 13) * 0.58);
      }

      // 1,400 Lagrangian streak particles (SOA layout for zero GC churn)
      this.particleCount = 1400;
      this.px = new Float32Array(this.particleCount);
      this.py = new Float32Array(this.particleCount);
      this.prevPx = new Float32Array(this.particleCount);
      this.prevPy = new Float32Array(this.particleCount);
      this.pAge = new Float32Array(this.particleCount);
      this.pMaxAge = new Float32Array(this.particleCount);

      this.initParticles();
    }

    initParticles() {
      for (let i = 0; i < this.particleCount; i++) {
        this.respawnParticle(i, true);
      }
    }

    respawnParticle(i, initialSpread = false) {
      const band = i % this.rakeY.length;
      const jitterY = (Math.random() - 0.5) * 0.022;
      const y = Math.min(0.95, Math.max(0.015, this.rakeY[band] + jitterY));
      const x = initialSpread ? 0.015 + Math.random() * 0.96 : 0.012 + Math.random() * 0.025;
      this.px[i] = x;
      this.py[i] = y;
      this.prevPx[i] = x;
      this.prevPy[i] = y;
      this.pAge[i] = initialSpread ? Math.random() * 80 : 0;
      this.pMaxAge[i] = 140 + Math.random() * 140;
    }

    setObstacles(polygons) {
      const { nx, ny, s, u, v } = this;
      s.fill(1);

      // Tunnel boundaries: floor (y=0), ceiling (y=ny-1), inlet (x=0).
      // Right outlet (x=nx-1) stays open fluid (s=1) for Dirichlet outflow.
      for (let x = 0; x < nx; x++) {
        s[x * ny + 0] = 0;
        s[x * ny + (ny - 1)] = 0;
      }
      for (let y = 0; y < ny; y++) {
        s[0 * ny + y] = 0;
      }

      const polys = Array.isArray(polygons) ? polygons : [];
      for (let x = 1; x < nx - 1; x++) {
        const cx = (x + 0.5) / nx;
        const col = x * ny;
        for (let y = 1; y < ny - 1; y++) {
          const cy = (y + 0.5) / ny;
          for (let k = 0; k < polys.length; k++) {
            if (pointInPolygon(cx, cy, polys[k])) {
              s[col + y] = 0;
              break;
            }
          }
        }
      }

      // Enforce zero normal flow on newly rasterized solid faces while preserving
      // surrounding fluid velocity for smooth transitions between vehicle shapes.
      for (let x = 1; x < nx - 1; x++) {
        const col = x * ny;
        for (let y = 1; y < ny - 1; y++) {
          if (s[col + y] === 0) {
            u[col + y] = 0;
            u[(x + 1) * ny + y] = 0;
            v[x * (ny + 1) + y] = 0;
            v[x * (ny + 1) + y + 1] = 0;
          }
        }
      }
    }

    sampleU(xGrid, yGrid) {
      const { nx, ny, u } = this;
      const x = Math.max(0, Math.min(nx, xGrid));
      const y = Math.max(0, Math.min(ny - 1, yGrid - 0.5));
      const x0 = Math.min(nx - 1, Math.floor(x));
      const y0 = Math.min(ny - 2, Math.floor(y));
      const tx = x - x0;
      const ty = y - y0;
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const u00 = u[x0 * ny + y0];
      const u10 = u[x1 * ny + y0];
      const u01 = u[x0 * ny + y1];
      const u11 = u[x1 * ny + y1];
      return (1 - tx) * ((1 - ty) * u00 + ty * u01) + tx * ((1 - ty) * u10 + ty * u11);
    }

    sampleV(xGrid, yGrid) {
      const { nx, ny, v } = this;
      const ny1 = ny + 1;
      const x = Math.max(0, Math.min(nx - 1, xGrid - 0.5));
      const y = Math.max(0, Math.min(ny, yGrid));
      const x0 = Math.min(nx - 2, Math.floor(x));
      const y0 = Math.min(ny - 1, Math.floor(y));
      const tx = x - x0;
      const ty = y - y0;
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const v00 = v[x0 * ny1 + y0];
      const v10 = v[x1 * ny1 + y0];
      const v01 = v[x0 * ny1 + y1];
      const v11 = v[x1 * ny1 + y1];
      return (1 - tx) * ((1 - ty) * v00 + ty * v01) + tx * ((1 - ty) * v10 + ty * v11);
    }

    sampleCellField(field, xGrid, yGrid) {
      const { nx, ny } = this;
      const x = Math.max(0, Math.min(nx - 1, xGrid - 0.5));
      const y = Math.max(0, Math.min(ny - 1, yGrid - 0.5));
      const x0 = Math.min(nx - 2, Math.floor(x));
      const y0 = Math.min(ny - 2, Math.floor(y));
      const tx = x - x0;
      const ty = y - y0;
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const f00 = field[x0 * ny + y0];
      const f10 = field[x1 * ny + y0];
      const f01 = field[x0 * ny + y1];
      const f11 = field[x1 * ny + y1];
      return (1 - tx) * ((1 - ty) * f00 + ty * f01) + tx * ((1 - ty) * f10 + ty * f11);
    }

    sampleVelocityNorm(xn, yn) {
      const gx = xn * this.nx;
      const gy = yn * this.ny;
      return {
        u: this.sampleU(gx, gy),
        v: this.sampleV(gx, gy),
      };
    }

    isSolidNorm(xn, yn) {
      const x = Math.max(0, Math.min(this.nx - 1, Math.floor(xn * this.nx)));
      const y = Math.max(0, Math.min(this.ny - 1, Math.floor(yn * this.ny)));
      return this.s[x * this.ny + y] === 0;
    }

    step(speedMph) {
      const mph = Math.max(0, Math.min(100, Number(speedMph) || 0));
      const { nx, ny, u, v, newU, newV, p, cp, curl, smoke, newSmoke, s } = this;
      const ny1 = ny + 1;

      if (mph === 0) {
        for (let i = 0; i < u.length; i++) u[i] *= 0.92;
        for (let i = 0; i < v.length; i++) v[i] *= 0.92;
        p.fill(0);
        cp.fill(0);
        curl.fill(0);
        for (let i = 0; i < smoke.length; i++) smoke[i] *= 0.96;
        this.lastUSim = 0;
        this.stepCount += 1;
        return;
      }

      const uSim = (mph / 100) * 2.5;
      this.lastUSim = uSim;
      const substeps = mph > 55 ? 2 : 1;
      const dt = substeps === 2 ? 0.5 : 1.0;
      const vortEps = 0.06 + 0.24 * (mph / 100);
      const maxVel = 3.5 * uSim + 0.5;

      for (let sub = 0; sub < substeps; sub++) {
        this.stepCount += 1;

        // 1. Inlet boundary + 14-nozzle smoke rake injection
        for (let y = 1; y < ny - 1; y++) {
          u[1 * ny + y] = uSim;
          u[0 * ny + y] = uSim;
          v[0 * ny1 + y] = 0;
          v[1 * ny1 + y] = 0;

          const yn = (y + 0.5) / ny;
          let bandGlow = 0;
          for (let r = 0; r < this.rakeY.length; r++) {
            const dy = yn - this.rakeY[r];
            bandGlow += Math.exp(-(dy * dy) / 0.00011);
          }
          smoke[1 * ny + y] = Math.min(1.0, bandGlow * 0.95);
        }

        // 2. Vorticity calculation & confinement (strictly on interior fluid cells)
        curl.fill(0);
        for (let x = 1; x < nx - 1; x++) {
          const col = x * ny;
          const colP = (x + 1) * ny;
          const vColP = (x + 1) * ny1;
          const vColM = (x - 1) * ny1;
          for (let y = 1; y < ny - 1; y++) {
            if (s[col + y] === 0) continue;
            const vcP = 0.5 * (v[vColP + y] + v[vColP + y + 1]);
            const vcM = 0.5 * (v[vColM + y] + v[vColM + y + 1]);
            const ucP = 0.5 * (u[col + y + 1] + u[colP + y + 1]);
            const ucM = 0.5 * (u[col + y - 1] + u[colP + y - 1]);
            curl[col + y] = 0.5 * ((vcP - vcM) - (ucP - ucM));
          }
        }

        const wakeOsc = 0.015 * uSim * Math.sin(this.stepCount * 0.25);
        const wakeXMin = Math.floor(nx * 0.58);
        const wakeXMax = Math.floor(nx * 0.72);
        const wakeYMin = Math.floor(ny * 0.08);
        const wakeYMax = Math.floor(ny * 0.38);

        for (let x = 3; x < nx - 3; x++) {
          const col = x * ny;
          for (let y = 2; y < ny - 2; y++) {
            if (
              s[col + y] === 0 ||
              s[(x - 1) * ny + y] === 0 ||
              s[(x + 1) * ny + y] === 0 ||
              s[col + y - 1] === 0 ||
              s[col + y + 1] === 0 ||
              s[(x - 1) * ny + y - 1] === 0 ||
              s[(x - 1) * ny + y + 1] === 0 ||
              s[(x + 1) * ny + y - 1] === 0 ||
              s[(x + 1) * ny + y + 1] === 0
            ) {
              continue;
            }
            const dx = Math.abs(curl[(x + 1) * ny + y]) - Math.abs(curl[(x - 1) * ny + y]);
            const dy = Math.abs(curl[col + y + 1]) - Math.abs(curl[col + y - 1]);
            const len = Math.hypot(dx, dy) + 1e-6;
            const nxV = dx / len;
            const nyV = dy / len;
            const cVal = curl[col + y];
            const fx = nyV * cVal * vortEps;
            const fy = -nxV * cVal * vortEps;

            u[col + y] += dt * fx * 0.5;
            u[(x + 1) * ny + y] += dt * fx * 0.5;
            v[x * ny1 + y] += dt * fy * 0.5;
            v[x * ny1 + y + 1] += dt * fy * 0.5;

            if (x >= wakeXMin && x <= wakeXMax && y >= wakeYMin && y <= wakeYMax) {
              v[x * ny1 + y] += dt * wakeOsc;
            }
          }
        }

        // 3. Gauss-Seidel SOR pressure projection (22 iterations, omega = 1.88)
        p.fill(0);
        const omega = 1.88;
        for (let iter = 0; iter < 22; iter++) {
          for (let x = 1; x < nx - 1; x++) {
            const col = x * ny;
            const colPrev = (x - 1) * ny;
            const colNext = (x + 1) * ny;
            const vCol = x * ny1;
            for (let y = 1; y < ny - 1; y++) {
              if (s[col + y] === 0) continue;
              const sx0 = s[colPrev + y];
              const sx1 = s[colNext + y];
              const sy0 = s[col + y - 1];
              const sy1 = s[col + y + 1];
              const sumS = sx0 + sx1 + sy0 + sy1;
              if (sumS === 0) continue;

              const div = u[colNext + y] - u[col + y] + v[vCol + y + 1] - v[vCol + y];
              const dp = (-div / sumS) * omega;
              p[col + y] += dp;

              u[col + y] -= sx0 * dp;
              u[colNext + y] += sx1 * dp;
              v[vCol + y] -= sy0 * dp;
              v[vCol + y + 1] += sy1 * dp;
            }
          }
        }

        // 4. Moving ground belt, free-slip ceiling, and open right outlet
        for (let x = 0; x < nx; x++) {
          u[x * ny + 0] = uSim;
          if (s[x * ny + 1] === 1) {
            u[x * ny + 1] = 0.85 * u[x * ny + 1] + 0.15 * uSim;
          }
          u[x * ny + (ny - 1)] = u[x * ny + (ny - 2)];
        }
        for (let y = 1; y < ny - 1; y++) {
          u[nx * ny + y] = Math.max(0, u[(nx - 1) * ny + y]);
          v[(nx - 1) * ny1 + y] = v[(nx - 2) * ny1 + y];
        }

        // 5. Semi-Lagrangian advection for u, v, and smoke
        newU.set(u);
        newV.set(v);
        newSmoke.set(smoke);

        for (let x = 2; x < nx; x++) {
          const col = x * ny;
          for (let y = 1; y < ny - 1; y++) {
            if (s[col + y] === 0 || s[(x - 1) * ny + y] === 0) {
              newU[col + y] = 0;
              continue;
            }
            const uVal = u[col + y];
            const vVal =
              0.25 *
              (v[(x - 1) * ny1 + y] +
                v[x * ny1 + y] +
                v[(x - 1) * ny1 + y + 1] +
                v[x * ny1 + y + 1]);
            const srcX = x - dt * uVal;
            const srcY = y + 0.5 - dt * vVal;
            const adv = this.sampleU(srcX, srcY);
            newU[col + y] = Math.max(-maxVel, Math.min(maxVel, adv));
          }
        }

        for (let x = 1; x < nx - 1; x++) {
          const vCol = x * ny1;
          for (let y = 1; y < ny; y++) {
            if (s[x * ny + y] === 0 || s[x * ny + y - 1] === 0) {
              newV[vCol + y] = 0;
              continue;
            }
            const uVal =
              0.25 *
              (u[x * ny + y - 1] +
                u[(x + 1) * ny + y - 1] +
                u[x * ny + y] +
                u[(x + 1) * ny + y]);
            const vVal = v[vCol + y];
            const srcX = x + 0.5 - dt * uVal;
            const srcY = y - dt * vVal;
            const adv = this.sampleV(srcX, srcY);
            newV[vCol + y] = Math.max(-maxVel, Math.min(maxVel, adv));
          }
        }

        for (let x = 2; x < nx; x++) {
          const col = x * ny;
          for (let y = 1; y < ny - 1; y++) {
            if (s[col + y] === 0) {
              newSmoke[col + y] = 0;
              continue;
            }
            const uVal = 0.5 * (u[col + y] + u[(x + 1) * ny + y]);
            const vVal = 0.5 * (v[x * ny1 + y] + v[x * ny1 + y + 1]);
            const srcX = x + 0.5 - dt * uVal;
            const srcY = y + 0.5 - dt * vVal;
            newSmoke[col + y] = this.sampleCellField(smoke, srcX, srcY) * 0.996;
          }
        }

        u.set(newU);
        v.set(newV);
        smoke.set(newSmoke);

        // 6. Advance Lagrangian tracer particles with RK2
        const invNx = 1 / nx;
        const invNy = 1 / ny;
        for (let i = 0; i < this.particleCount; i++) {
          this.prevPx[i] = this.px[i];
          this.prevPy[i] = this.py[i];
          const x0 = this.px[i];
          const y0 = this.py[i];

          const vel1 = this.sampleVelocityNorm(x0, y0);
          const midX = x0 + 0.5 * dt * vel1.u * invNx;
          const midY = y0 + 0.5 * dt * vel1.v * invNy;
          const vel2 = this.sampleVelocityNorm(midX, midY);

          const x1 = x0 + dt * vel2.u * invNx;
          const y1 = y0 + dt * vel2.v * invNy;

          this.px[i] = x1;
          this.py[i] = y1;
          this.pAge[i] += dt;

          if (
            x1 > 0.995 ||
            x1 < 0.005 ||
            y1 < 0.006 ||
            y1 > 0.975 ||
            this.pAge[i] > this.pMaxAge[i] ||
            this.isSolidNorm(x1, y1)
          ) {
            this.respawnParticle(i, false);
          }
        }
      }

      // 7. Compute dimensionless Pressure Coefficient Cp relative to upper ceiling free stream
      const qSim = Math.max(0.06, 0.5 * uSim * uSim);
      const refY = ny - 4;
      for (let x = 1; x < nx - 1; x++) {
        const col = x * ny;
        const pAmbient = p[col + refY];
        for (let y = 1; y < ny - 1; y++) {
          if (s[col + y] === 0) {
            cp[col + y] = 0;
          } else {
            const rawCp = (p[col + y] - pAmbient) / qSim;
            cp[col + y] = Math.max(-2.5, Math.min(2.5, rawCp));
          }
        }
      }
    }

    /**
     * Trace 14 continuous smoke-rake ribbons using 2nd-order Runge-Kutta (RK2)
     */
    traceStreamlines(maxSteps = 210) {
      const ds = 0.006;
      const lines = [];
      const aspectScale = this.nx / this.ny; // 2.4 : 1

      for (let r = 0; r < this.rakeY.length; r++) {
        let x = 0.02;
        let y = this.rakeY[r];
        const pts = [[x, y]];

        for (let step = 0; step < maxSteps; step++) {
          const v1 = this.sampleVelocityNorm(x, y);
          const mag1 = Math.hypot(v1.u, v1.v * aspectScale);
          if (mag1 < 0.025) break;

          const dx1 = (v1.u / mag1) * ds;
          const dy1 = ((v1.v * aspectScale) / mag1) * ds * (1 / aspectScale);

          const v2 = this.sampleVelocityNorm(x + 0.5 * dx1, y + 0.5 * dy1);
          const mag2 = Math.hypot(v2.u, v2.v * aspectScale);
          if (mag2 < 0.025) break;

          const nxPos = x + (v2.u / mag2) * ds;
          const nyPos = y + ((v2.v * aspectScale) / mag2) * ds * (1 / aspectScale);

          if (nxPos >= 0.995 || nyPos <= 0.008 || nyPos >= 0.985 || this.isSolidNorm(nxPos, nyPos)) {
            break;
          }
          x = nxPos;
          y = nyPos;
          pts.push([x, y]);
        }
        lines.push(pts);
      }

      return lines;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WindTunnelSolver, pointInPolygon };
  } else {
    root.WindTunnelSolver = WindTunnelSolver;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
