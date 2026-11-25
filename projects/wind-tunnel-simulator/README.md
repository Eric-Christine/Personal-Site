# Automotive Wind Tunnel & MPG Efficiency Simulator

An interactive 2D Computational Fluid Dynamics (CFD) wind tunnel and road-load fuel economy simulator featuring **18 vehicles**: 8 core archetypes (**Midsize Sedan**, **Compact SUV (Gas)**, **Full-Size SUV (Tahoe)**, **Family Minivan**, **Pickup Truck (Base)**, **Hyundai Elantra**, **Sport Motorcyclist**, **E-Scooter + Rider**) plus the **Top 10 Best-Selling US Models** (**Ford F-150**, **Chevrolet Silverado 1500**, **Honda CR-V**, **Ram 1500**, **Tesla Model Y**, **Toyota Camry**, **GMC Sierra 1500**, **Toyota RAV4**, **Toyota Tacoma**, and **Nissan Rogue**) from **0 to 100 mph**.

## Run Locally

No build step or external dependencies. Open `index.html` directly or serve locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Semantic controls, wind tunnel viewport, KPI telemetry, charts, and speed table |
| `styles.css` | Light/dark `color-scheme` styling, custom cross-browser range slider, responsive layout |
| `physics.js` | Vehicle profiles, centerline polygons, aero modifiers, and SAE road-load MPG model |
| `fluid.js` | 204 &times; 85 staggered MAC Navier-Stokes solver, vorticity confinement, RK2 smoke ribbons &amp; tracers |
| `charts.js` | HiDPI dual-chart renderer (MPG vs. speed and quadratic force / cubic power vs. speed) |
| `app.js` | Animation loop, wind tunnel canvas renderer, interactive controls, and live DOM updates |

## Physics &amp; Reference Values (Real-World Mode)

- **Drag Force**: $F_d = \frac{1}{2}\rho C_d A v^2$ (doubles speed &rarr; **4&times;** drag force)
- **Drag Power**: $P_d = F_d v = \frac{1}{2}\rho C_d A v^3$ (doubles speed &rarr; **8&times;** power required)
- **Road-Load + Willans-Line MPG**: $P_{\text{fuel}} = P_{\text{idle}} + (P_{\text{drag}} + P_{\text{roll}}) / \eta_{\text{drivetrain}}$, with $33{,}700\text{ Wh/gal}$ gasoline energy content.

| Vehicle | Cd | Frontal Area | CdA | 35 mph MPG | 65 mph MPG | 100 mph MPG |
| --- | --- | --- | --- | --- | --- | --- |
| Midsize Sedan | 0.27 | 2.25 m&sup2; | 0.608 m&sup2; | 47.5 | 36.9 | 22.0 |
| Compact SUV (RAV4) | 0.32 | 2.65 m&sup2; | 0.848 m&sup2; | 41.0 | 29.1 | 16.5 |
| Family Minivan | 0.33 | 2.85 m&sup2; | 0.941 m&sup2; | 34.9 | 25.2 | 14.5 |
| Full-Size SUV (Tahoe) | 0.38 | 3.25 m&sup2; | 1.235 m&sup2; | 27.1 | 19.0 | 10.8 |
| Pickup Truck | 0.44 | 3.35 m&sup2; | 1.474 m&sup2; | 25.5 | 16.8 | 9.3 |
| Hyundai Elantra | 0.28 | 2.12 m&sup2; | 0.594 m&sup2; | 56.1 | 42.1 | 24.5 |
| Sport Motorcyclist | 0.62 | 0.72 m&sup2; | 0.446 m&sup2; | 96.3 | 58.7 | 30.3 |
| E-Scooter + Rider (MPGe) | 1.10 | 0.68 m&sup2; | 0.748 m&sup2; | 458.4 | 148.7 | 64.5 |
| Ford F-Series (F-150) | 0.390 | 3.24 m&sup2; | 1.264 m&sup2; | 34.3 | 22.6 | 12.4 |
| Chevrolet Silverado 1500 | 0.405 | 3.30 m&sup2; | 1.337 m&sup2; | 29.1 | 19.6 | 10.9 |
| Honda CR-V | 0.310 | 2.66 m&sup2; | 0.825 m&sup2; | 46.8 | 32.8 | 18.5 |
| Ram Pickup (1500) | 0.357 | 3.32 m&sup2; | 1.185 m&sup2; | 32.5 | 22.4 | 12.6 |
| Tesla Model Y (MPGe) | 0.230 | 2.62 m&sup2; | 0.603 m&sup2; | 220.9 | 127.1 | 69.2 |
| Toyota Camry (Hybrid) | 0.275 | 2.24 m&sup2; | 0.616 m&sup2; | 71.4 | 50.4 | 28.9 |
| GMC Sierra 1500 | 0.420 | 3.36 m&sup2; | 1.411 m&sup2; | 27.8 | 18.5 | 10.3 |
| Toyota RAV4 (Hybrid) | 0.320 | 2.65 m&sup2; | 0.848 m&sup2; | 56.5 | 37.2 | 20.6 |
| Toyota Tacoma | 0.385 | 2.78 m&sup2; | 1.070 m&sup2; | 36.2 | 24.3 | 13.6 |
| Nissan Rogue | 0.334 | 2.62 m&sup2; | 0.875 m&sup2; | 49.6 | 33.5 | 18.5 |
