/**
 * Aerodynamic silhouettes, road-load physics, and Willans-line MPG model
 * for Sedan, Pickup Truck, Minivan, and Aero Teardrop Coupe.
 *
 * Normalized wind tunnel coordinates: x in [0, 1], y in [0, 1] (y = 0 is road).
 * Tunnel dimensions represent 12.0 m length x 5.0 m height (2.4 : 1 aspect).
 * Centerline polygons intentionally keep the underbody open (y >= 0.030)
 * so 2D airflow can pass beneath the chassis rather than being sealed by tires.
 */
(function (root) {
  'use strict';

  const CONSTANTS = Object.freeze({
    RHO_AIR: 1.225,            // kg/m^3 at sea-level ISA 15 C
    GRAVITY: 9.80665,          // m/s^2
    MPH_TO_MS: 0.44704,        // exact conversion
    N_TO_LBF: 0.224808943,     // Newtons to pounds-force
    W_TO_HP: 1 / 745.699872,   // Watts to mechanical horsepower
    M2_TO_FT2: 10.7639104,     // square meters to square feet
    GAS_WH_PER_GAL: 33700,     // EPA gasoline energy equivalent (Wh/gal)
    FUEL_PRICE_PER_GAL: 3.50,  // USD/gal reference
    ANNUAL_MILES: 12000,       // miles/year reference
  });

  const VEHICLE_ORDER = ['sedan', 'suv', 'fullsize_suv', 'minivan', 'truck', 'coupe', 'motorcycle', 'escooter'];

  const VEHICLES = {
    sedan: {
      id: 'sedan',
      name: 'Midsize Sedan',
      shortName: 'Sedan',
      tagline: 'Sloped fastback roofline & low nose',
      cd: 0.27,
      area: 2.25,
      mass: 1580,
      crr: 0.0095,
      idleWatts: 11500,
      drivetrainEta: 0.29,
      colorToken: 'sedan',
      bodyColor: '#3b82f6',
      bodyAccent: '#1d4ed8',
      // Centerline profile (clockwise from front bumper lower lip)
      polygon: [
        [0.200, 0.048],
        [0.200, 0.095],
        [0.208, 0.145],
        [0.232, 0.168],
        [0.295, 0.184],
        [0.365, 0.276],
        [0.415, 0.288],
        [0.478, 0.284],
        [0.545, 0.228],
        [0.594, 0.206],
        [0.606, 0.186],
        [0.607, 0.088],
        [0.596, 0.052],
        [0.545, 0.038],
        [0.240, 0.036],
        [0.212, 0.040],
      ],
      cabinWindow: [
        [0.308, 0.189],
        [0.369, 0.264],
        [0.416, 0.274],
        [0.472, 0.270],
        [0.530, 0.222],
        [0.472, 0.194],
        [0.320, 0.189],
      ],
      wheels: [
        { x: 0.262, y: 0.056, r: 0.056 },
        { x: 0.534, y: 0.056, r: 0.056 },
      ],
      roofMount: { x0: 0.365, x1: 0.495, y: 0.289 },
      callouts: [
        { x: 0.196, y: 0.125, anchorX: 0.12, anchorY: 0.24, label: 'Low Stagnation Nose', tone: 'warn' },
        { x: 0.430, y: 0.292, anchorX: 0.43, anchorY: 0.44, label: 'Attached Fastback Roofline', tone: 'good' },
        { x: 0.625, y: 0.155, anchorX: 0.76, anchorY: 0.26, label: 'Compact Wake (Cd 0.27)', tone: 'info' },
      ],
    },

    suv: {
      id: 'suv',
      name: 'Compact SUV (RAV4)',
      shortName: 'RAV4 SUV',
      tagline: 'Two-box crossover with raised ride height & rear spoiler',
      cd: 0.32,
      area: 2.65,
      mass: 1675,
      crr: 0.0102,
      idleWatts: 12200,
      drivetrainEta: 0.288,
      colorToken: 'suv',
      bodyColor: '#8b5cf6',
      bodyAccent: '#6d28d9',
      polygon: [
        [0.205, 0.064],
        [0.205, 0.172],
        [0.218, 0.194],
        [0.312, 0.208],
        [0.372, 0.336],
        [0.392, 0.340],
        [0.548, 0.340],
        [0.556, 0.332],
        [0.585, 0.205],
        [0.588, 0.188],
        [0.588, 0.074],
        [0.574, 0.052],
        [0.530, 0.046],
        [0.236, 0.046],
      ],
      cabinWindow: [
        [0.324, 0.214],
        [0.378, 0.326],
        [0.536, 0.326],
        [0.568, 0.218],
      ],
      wheels: [
        { x: 0.268, y: 0.064, r: 0.064 },
        { x: 0.520, y: 0.064, r: 0.064 },
      ],
      roofMount: { x0: 0.395, x1: 0.525, y: 0.341 },
      callouts: [
        { x: 0.202, y: 0.145, anchorX: 0.11, anchorY: 0.26, label: 'Blunt Crossover Nose', tone: 'warn' },
        { x: 0.460, y: 0.344, anchorX: 0.46, anchorY: 0.48, label: 'Raised Two-Box Roofline', tone: 'good' },
        { x: 0.605, y: 0.200, anchorX: 0.76, anchorY: 0.30, label: 'Hatchback Suction Wake (Cd 0.32)', tone: 'info' },
      ],
    },

    fullsize_suv: {
      id: 'fullsize_suv',
      name: 'Full-Size SUV (Tahoe)',
      shortName: 'Large SUV',
      tagline: 'Tall body-on-frame profile & boxy rear gate',
      cd: 0.38,
      area: 3.25,
      mass: 2520,
      crr: 0.0112,
      idleWatts: 16500,
      drivetrainEta: 0.278,
      colorToken: 'fullsize_suv',
      bodyColor: '#ec4899',
      bodyAccent: '#be185d',
      polygon: [
        [0.188, 0.070],
        [0.188, 0.232],
        [0.198, 0.252],
        [0.308, 0.264],
        [0.350, 0.382],
        [0.372, 0.386],
        [0.616, 0.386],
        [0.626, 0.374],
        [0.634, 0.088],
        [0.618, 0.064],
        [0.560, 0.056],
        [0.222, 0.056],
      ],
      cabinWindow: [
        [0.320, 0.274],
        [0.356, 0.372],
        [0.606, 0.372],
        [0.614, 0.274],
      ],
      wheels: [
        { x: 0.256, y: 0.072, r: 0.072 },
        { x: 0.554, y: 0.072, r: 0.072 },
      ],
      roofMount: { x0: 0.380, x1: 0.555, y: 0.387 },
      callouts: [
        { x: 0.185, y: 0.180, anchorX: 0.11, anchorY: 0.31, label: 'Tall Bluff Grille (3.25 m\u00b2)', tone: 'warn' },
        { x: 0.490, y: 0.390, anchorX: 0.49, anchorY: 0.51, label: 'Closed Cabin (No Bed Vortex)', tone: 'good' },
        { x: 0.652, y: 0.225, anchorX: 0.79, anchorY: 0.34, label: 'Tall Boxy Wake (Cd 0.38)', tone: 'info' },
      ],
    },

    truck: {
      id: 'truck',
      name: 'Pickup Truck',
      shortName: 'Truck',
      tagline: 'Bluff grille, tall cab & open cargo bed',
      cd: 0.44,
      area: 3.35,
      mass: 2450,
      crr: 0.0115,
      idleWatts: 17000,
      drivetrainEta: 0.275,
      colorToken: 'truck',
      bodyColor: '#f59e0b',
      bodyAccent: '#b45309',
      polygon: [
        [0.185, 0.072],
        [0.185, 0.235],
        [0.194, 0.255],
        [0.300, 0.266],
        [0.338, 0.382],
        [0.365, 0.388],
        [0.472, 0.388],
        [0.478, 0.376],
        [0.478, 0.215],
        [0.642, 0.215],
        [0.644, 0.285],
        [0.664, 0.285],
        [0.664, 0.095],
        [0.648, 0.070],
        [0.575, 0.062],
        [0.220, 0.060],
      ],
      polygonCovered: [
        [0.185, 0.072],
        [0.185, 0.235],
        [0.194, 0.255],
        [0.300, 0.266],
        [0.338, 0.382],
        [0.365, 0.388],
        [0.472, 0.388],
        [0.478, 0.376],
        [0.478, 0.285],
        [0.664, 0.285],
        [0.664, 0.095],
        [0.648, 0.070],
        [0.575, 0.062],
        [0.220, 0.060],
      ],
      cabinWindow: [
        [0.312, 0.276],
        [0.344, 0.372],
        [0.464, 0.372],
        [0.464, 0.276],
      ],
      wheels: [
        { x: 0.254, y: 0.072, r: 0.072 },
        { x: 0.562, y: 0.072, r: 0.072 },
      ],
      roofMount: { x0: 0.345, x1: 0.470, y: 0.389 },
      callouts: [
        { x: 0.182, y: 0.180, anchorX: 0.11, anchorY: 0.31, label: 'Bluff Grille Stagnation', tone: 'warn' },
        { x: 0.558, y: 0.245, anchorX: 0.56, anchorY: 0.46, label: 'Trapped Bed Vortex', tone: 'warn', coveredLabel: 'Tonneau Smoothed Bed' },
        { x: 0.680, y: 0.210, anchorX: 0.80, anchorY: 0.32, label: 'Large Tailgate Suction Wake', tone: 'info' },
      ],
    },

    minivan: {
      id: 'minivan',
      name: 'Family Minivan',
      shortName: 'Minivan',
      tagline: 'Tall frontal area & squareback liftgate',
      cd: 0.33,
      area: 2.85,
      mass: 2060,
      crr: 0.0102,
      idleWatts: 14000,
      drivetrainEta: 0.285,
      colorToken: 'minivan',
      bodyColor: '#10b981',
      bodyAccent: '#047857',
      polygon: [
        [0.195, 0.052],
        [0.195, 0.112],
        [0.205, 0.168],
        [0.250, 0.202],
        [0.315, 0.342],
        [0.345, 0.352],
        [0.608, 0.352],
        [0.620, 0.336],
        [0.625, 0.088],
        [0.612, 0.052],
        [0.545, 0.042],
        [0.232, 0.040],
      ],
      cabinWindow: [
        [0.268, 0.212],
        [0.324, 0.336],
        [0.594, 0.336],
        [0.604, 0.212],
      ],
      wheels: [
        { x: 0.264, y: 0.060, r: 0.060 },
        { x: 0.548, y: 0.060, r: 0.060 },
      ],
      roofMount: { x0: 0.375, x1: 0.530, y: 0.353 },
      callouts: [
        { x: 0.202, y: 0.155, anchorX: 0.12, anchorY: 0.28, label: 'Tall Frontal Area (2.85 m²)', tone: 'warn' },
        { x: 0.460, y: 0.356, anchorX: 0.46, anchorY: 0.49, label: 'Long Attached Roof', tone: 'good' },
        { x: 0.642, y: 0.220, anchorX: 0.78, anchorY: 0.34, label: 'Squareback Base-Drag Wake', tone: 'info' },
      ],
    },

    coupe: {
      id: 'coupe',
      name: 'Hyundai Elantra',
      shortName: 'Elantra',
      tagline: '4-door fastback coupe with ducktail trunk lip',
      cd: 0.28,
      area: 2.12,
      mass: 1385,
      crr: 0.0090,
      idleWatts: 9800,
      drivetrainEta: 0.305,
      colorToken: 'coupe',
      bodyColor: '#06b6d4',
      bodyAccent: '#0e7490',
      polygon: [
        [0.204, 0.048],
        [0.202, 0.095],
        [0.214, 0.138],
        [0.296, 0.168],
        [0.366, 0.274],
        [0.408, 0.283],
        [0.468, 0.274],
        [0.548, 0.202],
        [0.590, 0.196],
        [0.596, 0.184],
        [0.591, 0.118],
        [0.595, 0.070],
        [0.578, 0.044],
        [0.525, 0.034],
        [0.236, 0.032],
      ],
      cabinWindow: [
        [0.306, 0.174],
        [0.370, 0.264],
        [0.412, 0.272],
        [0.465, 0.262],
        [0.535, 0.200],
        [0.468, 0.178],
        [0.320, 0.174],
      ],
      wheels: [
        { x: 0.266, y: 0.055, r: 0.055 },
        { x: 0.524, y: 0.055, r: 0.055 },
      ],
      roofMount: { x0: 0.376, x1: 0.486, y: 0.284 },
      callouts: [
        { x: 0.202, y: 0.112, anchorX: 0.11, anchorY: 0.22, label: 'Parametric Shark Nose', tone: 'good' },
        { x: 0.450, y: 0.286, anchorX: 0.45, anchorY: 0.43, label: 'Fastback 4-Door Roofline', tone: 'good' },
        { x: 0.608, y: 0.175, anchorX: 0.77, anchorY: 0.26, label: 'Ducktail Lip & Low Wake (Cd 0.28)', tone: 'info' },
      ],
    },

    motorcycle: {
      id: 'motorcycle',
      name: 'Sport Motorcyclist',
      shortName: 'Moto',
      tagline: 'Narrow bike + tucked rider (high Cd, tiny frontal area)',
      visualType: 'motorcycle',
      isElectric: false,
      wheelRadiusM: 0.31,
      cd: 0.62,
      area: 0.72,
      mass: 280,
      crr: 0.014,
      idleWatts: 5500,
      drivetrainEta: 0.25,
      colorToken: 'motorcycle',
      bodyColor: '#f97316',
      bodyAccent: '#c2410c',
      polygon: [
        [0.308, 0.100],
        [0.312, 0.172],
        [0.336, 0.212],
        [0.368, 0.194],
        [0.405, 0.174],
        [0.456, 0.200],
        [0.478, 0.188],
        [0.464, 0.140],
        [0.425, 0.082],
        [0.355, 0.056],
        [0.324, 0.068],
      ],
      riderPolygon: [
        [0.352, 0.214],
        [0.364, 0.264],
        [0.382, 0.280],
        [0.404, 0.272],
        [0.436, 0.246],
        [0.448, 0.198],
        [0.415, 0.145],
        [0.376, 0.168],
      ],
      cabinWindow: [
        [0.316, 0.174],
        [0.337, 0.211],
        [0.350, 0.204],
        [0.332, 0.172],
      ],
      wheels: [
        { x: 0.330, y: 0.064, r: 0.064 },
        { x: 0.454, y: 0.064, r: 0.064 },
      ],
      roofMount: null,
      callouts: [
        { x: 0.310, y: 0.155, anchorX: 0.17, anchorY: 0.25, label: 'Narrow Fairing (0.72 m\u00b2)', tone: 'good' },
        { x: 0.382, y: 0.282, anchorX: 0.38, anchorY: 0.43, label: 'Tucked Rider (Cd 0.62)', tone: 'warn' },
        { x: 0.485, y: 0.205, anchorX: 0.67, anchorY: 0.30, label: 'Turbulent Rider Back Wake', tone: 'info' },
      ],
    },

    escooter: {
      id: 'escooter',
      name: 'E-Scooter + Rider',
      shortName: 'E-Scooter',
      tagline: 'Standing human sail (Cd 1.10) on electric commuter scooter',
      visualType: 'escooter',
      isElectric: true,
      wheelRadiusM: 0.13,
      cd: 1.10,
      area: 0.68,
      mass: 98,
      crr: 0.016,
      idleWatts: 60,
      drivetrainEta: 0.80,
      colorToken: 'escooter',
      bodyColor: '#84cc16',
      bodyAccent: '#4d7c0f',
      polygon: [
        [0.340, 0.036],
        [0.438, 0.036],
        [0.438, 0.058],
        [0.362, 0.058],
        [0.354, 0.232],
        [0.342, 0.232],
        [0.350, 0.058],
        [0.340, 0.058],
      ],
      riderPolygon: [
        [0.380, 0.058],
        [0.416, 0.058],
        [0.414, 0.188],
        [0.418, 0.312],
        [0.408, 0.330],
        [0.410, 0.368],
        [0.392, 0.378],
        [0.374, 0.368],
        [0.374, 0.332],
        [0.376, 0.305],
        [0.350, 0.236],
        [0.356, 0.222],
        [0.378, 0.264],
        [0.378, 0.185],
      ],
      cabinWindow: null,
      wheels: [
        { x: 0.346, y: 0.028, r: 0.028 },
        { x: 0.432, y: 0.028, r: 0.028 },
      ],
      roofMount: null,
      callouts: [
        { x: 0.372, y: 0.275, anchorX: 0.20, anchorY: 0.34, label: 'Standing Human Sail (Cd 1.10)', tone: 'warn' },
        { x: 0.392, y: 0.382, anchorX: 0.39, anchorY: 0.50, label: 'More Drag Than a Sedan!', tone: 'warn' },
        { x: 0.448, y: 0.240, anchorX: 0.65, anchorY: 0.32, label: 'Massive Shedding Wake', tone: 'info' },
      ],
    },
  };

  function buildRoofBoxPolygon(mount) {
    const x0 = mount.x0;
    const x1 = mount.x1;
    const y0 = mount.y + 0.016;
    const h = 0.056;
    return [
      [x0, y0],
      [x0 + 0.022, y0 + h * 0.78],
      [x0 + 0.052, y0 + h],
      [x1 - 0.015, y0 + h],
      [x1, y0 + h * 0.65],
      [x1, y0],
    ];
  }

  function getVehicleConfig(vehicleId, options) {
    const opts = options || {};
    const base = VEHICLES[vehicleId] || VEHICLES.sedan;
    const refSedan = VEHICLES.sedan;

    let cd = base.cd;
    let area = base.area;
    const tonneauActive = Boolean(opts.tonneauCover && base.id === 'truck');
    const roofBoxActive = Boolean(opts.roofBox && base.roofMount);

    if (tonneauActive) {
      cd = Math.max(0.18, cd - 0.035);
    }
    if (roofBoxActive) {
      cd += 0.07;
      area += 0.22;
    }

    const isolateShape = Boolean(opts.isolateShape);
    const isElectric = Boolean(base.isElectric && !isolateShape);
    const mass = isolateShape ? refSedan.mass : base.mass;
    const crr = isolateShape ? refSedan.crr : base.crr;
    const idleWatts = isolateShape ? refSedan.idleWatts : base.idleWatts;
    const drivetrainEta = isolateShape ? refSedan.drivetrainEta : base.drivetrainEta;

    const bodyPolygon = tonneauActive && base.polygonCovered ? base.polygonCovered : base.polygon;
    const cfdPolygons = [bodyPolygon];
    if (base.riderPolygon) {
      cfdPolygons.push(base.riderPolygon);
    }
    let roofBoxPolygon = null;
    if (roofBoxActive) {
      roofBoxPolygon = buildRoofBoxPolygon(base.roofMount);
      cfdPolygons.push(roofBoxPolygon);
    }

    return {
      ...base,
      cd,
      area,
      cdA: cd * area,
      mass,
      crr,
      idleWatts,
      drivetrainEta,
      isElectric,
      tonneauActive,
      roofBoxActive,
      isolateShape,
      bodyPolygon,
      roofBoxPolygon,
      cfdPolygons,
    };
  }

  function computeRawMetrics(cfg, speedMph) {
    const vMph = Math.max(0, Number(speedMph) || 0);
    const vMs = vMph * CONSTANTS.MPH_TO_MS;
    const qPa = 0.5 * CONSTANTS.RHO_AIR * vMs * vMs;
    const fDragN = qPa * cfg.cdA;
    const pDragW = fDragN * vMs;
    const fRollN = vMs > 0 ? cfg.crr * cfg.mass * CONSTANTS.GRAVITY * (1 + 0.004 * vMs) : 0;
    const pRollW = fRollN * vMs;
    const pWheelW = pDragW + pRollW;
    const pFuelW = cfg.idleWatts + pWheelW / cfg.drivetrainEta;
    const galPerHour = pFuelW / CONSTANTS.GAS_WH_PER_GAL;
    const mpg = vMph > 0 ? vMph / galPerHour : 0;
    const aeroSharePct = pWheelW > 0 ? (100 * pDragW) / pWheelW : 0;
    const annualFuelCost = mpg > 0 ? (CONSTANTS.ANNUAL_MILES / mpg) * CONSTANTS.FUEL_PRICE_PER_GAL : 0;

    return {
      speedMph: vMph,
      vMs,
      qPa,
      cd: cfg.cd,
      area: cfg.area,
      cdA: cfg.cdA,
      cdAFt2: cfg.cdA * CONSTANTS.M2_TO_FT2,
      fDragN,
      dragLbf: fDragN * CONSTANTS.N_TO_LBF,
      pDragW,
      dragHp: pDragW * CONSTANTS.W_TO_HP,
      dragKw: pDragW / 1000,
      fRollN,
      rollLbf: fRollN * CONSTANTS.N_TO_LBF,
      pRollW,
      rollHp: pRollW * CONSTANTS.W_TO_HP,
      pWheelW,
      wheelHp: pWheelW * CONSTANTS.W_TO_HP,
      pFuelW,
      galPerHour,
      mpg,
      aeroSharePct,
      rollSharePct: pWheelW > 0 ? 100 - aeroSharePct : 0,
      annualFuelCost,
    };
  }

  function computeMetrics(vehicleId, speedMph, options) {
    const cfg = getVehicleConfig(vehicleId, options);
    const current = computeRawMetrics(cfg, speedMph);
    const ref55 = computeRawMetrics(cfg, 55);
    const pctVs55 = ref55.mpg > 0 && current.speedMph > 0
      ? ((current.mpg - ref55.mpg) / ref55.mpg) * 100
      : 0;
    return {
      ...current,
      ref55Mpg: ref55.mpg,
      pctVs55,
      config: cfg,
    };
  }

  function computeCurve(vehicleId, options, minMph, maxMph, stepMph) {
    const cfg = getVehicleConfig(vehicleId, options);
    const start = minMph !== undefined ? minMph : 15;
    const end = maxMph !== undefined ? maxMph : 100;
    const step = stepMph !== undefined ? stepMph : 1;
    const points = [];
    for (let mph = start; mph <= end; mph += step) {
      points.push(computeRawMetrics(cfg, mph));
    }
    return { config: cfg, points };
  }

  const AeroPhysics = {
    CONSTANTS,
    VEHICLE_ORDER,
    VEHICLES,
    getVehicleConfig,
    computeMetrics,
    computeCurve,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AeroPhysics;
  } else {
    root.AeroPhysics = AeroPhysics;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
