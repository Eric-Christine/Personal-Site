# Automotive Wind Tunnel & MPG Efficiency Simulator

An interactive 2D Computational Fluid Dynamics (CFD) wind tunnel and road-load fuel economy simulator exploring how vehicle shapes (**Midsize Sedan**, **Compact SUV (RAV4)**, **Full-Size SUV (Tahoe)**, **Family Minivan**, **Pickup Truck**, **Hyundai Elantra**, **Sport Motorcyclist**, and **E-Scooter + Rider**) and driving speeds (**0 to 100 mph**) affect airflow, wake turbulence, aerodynamic drag, and MPG/MPGe.

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
