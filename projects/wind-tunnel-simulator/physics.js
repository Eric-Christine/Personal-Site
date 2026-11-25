/**
 * Aerodynamic silhouettes, road-load physics, and Willans-line MPG/MPGe model
 * across 18 vehicles: 8 core archetypes + Top 10 Best-Selling US Models.
 *
 * Normalized wind tunnel coordinates: x in [0, 1], y in [0, 1] (y = 0 is road).
 * Tunnel dimensions represent 12.0 m length x 5.0 m height (2.4 : 1 aspect).
 * Centerline polygons keep underbody clearance open (y >= 0.030) so 2D airflow
 * passes beneath the chassis; wheels render in foreground.
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

  const VEHICLE_ORDER = [
    'sedan',
    'suv',
    'fullsize_suv',
    'minivan',
    'truck',
    'coupe',
    'motorcycle',
    'escooter',
    'ford_f150',
    'chevy_silverado',
    'honda_crv',
    'ram_1500',
    'tesla_model_y',
    'toyota_camry',
    'gmc_sierra',
    'toyota_rav4',
    'toyota_tacoma',
    'nissan_rogue',
  ];

  const SVG_SHAPES = {
    sedan: {
      path: 'M10 35 L10 26 L18 22 L34 20 L48 10 L76 10 L96 18 L110 21 L111 33 L103 35 Z',
      wheels: [{ cx: 30, cy: 36, r: 7 }, { cx: 90, cy: 36, r: 7 }],
    },
    fastback: {
      path: 'M10 35 L9 27 L17 22 L34 19 L49 10 L74 10 L96 19 L109 19 L111 22 L109 32 L102 35 Z',
      wheels: [{ cx: 30, cy: 36, r: 7 }, { cx: 89, cy: 36, r: 7 }],
    },
    compact_suv: {
      path: 'M10 34 L10 19 L18 16 L36 14 L50 7 L94 7 L107 20 L108 33 L98 35 Z',
      wheels: [{ cx: 29, cy: 35, r: 7.5 }, { cx: 90, cy: 35, r: 7.5 }],
    },
    ev_crossover: {
      path: 'M10 35 L11 24 L20 18 L36 15 L52 8 L76 8 L104 18 L110 25 L105 34 L96 35 Z',
      wheels: [{ cx: 30, cy: 35, r: 7.5 }, { cx: 90, cy: 35, r: 7.5 }],
    },
    fullsize_suv: {
      path: 'M8 34 L8 15 L32 13 L42 5 L108 5 L112 10 L113 33 L103 34 Z',
      wheels: [{ cx: 28, cy: 35, r: 8 }, { cx: 92, cy: 35, r: 8 }],
    },
    minivan: {
      path: 'M10 35 L10 24 L20 18 L34 7 L104 7 L109 12 L110 35 Z',
      wheels: [{ cx: 30, cy: 36, r: 7.5 }, { cx: 92, cy: 36, r: 7.5 }],
    },
    truck: {
      path: 'M8 34 L8 15 L32 14 L40 6 L66 6 L66 21 L108 21 L111 16 L112 34 Z',
      wheels: [{ cx: 28, cy: 36, r: 8 }, { cx: 92, cy: 36, r: 8 }],
    },
    midsize_truck: {
      path: 'M10 34 L10 17 L32 15 L41 7 L68 7 L68 21 L106 21 L108 17 L109 34 Z',
      wheels: [{ cx: 29, cy: 35, r: 7.5 }, { cx: 90, cy: 35, r: 7.5 }],
    },
    motorcycle: {
      path: 'M26 32 L30 22 L42 17 L56 22 L80 22 L92 18 L86 28 L72 34 L42 34 Z',
      riderPath: 'M46 16 L54 9 L64 11 L78 17 L74 23 L54 22 Z',
      head: { cx: 57, cy: 9.5, r: 5 },
      wheels: [{ cx: 34, cy: 34, r: 8 }, { cx: 85, cy: 34, r: 8 }],
    },
    escooter: {
      scooterStroke: 'M34 38 L82 38 M42 38 L37 15 L44 15',
      riderPath: 'M54 38 L54 15 L66 15 L66 38 M54 19 L40 16',
      head: { cx: 60, cy: 8.5, r: 4.5 },
      wheels: [{ cx: 38, cy: 39, r: 4.5 }, { cx: 79, cy: 39, r: 4.5 }],
    },
  };

  const VEHICLES = {
    sedan: {
      id: 'sedan',
      name: 'Midsize Sedan',
      shortName: 'Sedan',
      tagline: 'Sloped fastback roofline & low nose',
      category: 'cars',
      isTop10: false,
      salesRank: 'Baseline',
      powertrain: 'Gas',
      svgKey: 'sedan',
      cd: 0.27,
      area: 2.25,
      mass: 1580,
      crr: 0.0095,
      idleWatts: 11500,
      drivetrainEta: 0.29,
      colorToken: 'sedan',
      bodyColor: '#3b82f6',
      bodyAccent: '#1d4ed8',
      polygon: [
        [0.200, 0.048], [0.200, 0.095], [0.208, 0.145], [0.232, 0.168],
        [0.295, 0.184], [0.365, 0.276], [0.415, 0.288], [0.478, 0.284],
        [0.545, 0.228], [0.594, 0.206], [0.606, 0.186], [0.607, 0.088],
        [0.596, 0.052], [0.545, 0.038], [0.240, 0.036], [0.212, 0.040],
      ],
      cabinWindow: [
        [0.308, 0.189], [0.369, 0.264], [0.416, 0.274], [0.472, 0.270],
        [0.530, 0.222], [0.472, 0.194], [0.320, 0.189],
      ],
      wheels: [{ x: 0.262, y: 0.056, r: 0.056 }, { x: 0.534, y: 0.056, r: 0.056 }],
      roofMount: { x0: 0.365, x1: 0.495, y: 0.289 },
      callouts: [
        { x: 0.196, y: 0.125, anchorX: 0.12, anchorY: 0.24, label: 'Low Stagnation Nose', tone: 'warn' },
        { x: 0.430, y: 0.292, anchorX: 0.43, anchorY: 0.44, label: 'Attached Fastback Roofline', tone: 'good' },
        { x: 0.625, y: 0.155, anchorX: 0.76, anchorY: 0.26, label: 'Compact Wake (Cd 0.27)', tone: 'info' },
      ],
    },

    suv: {
      id: 'suv',
      name: 'Compact SUV (Gas)',
      shortName: 'Gas SUV',
      tagline: 'Two-box crossover with raised ride height & rear spoiler',
      category: 'suvs',
      isTop10: false,
      salesRank: 'Baseline',
      powertrain: 'Gas',
      svgKey: 'compact_suv',
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
        [0.205, 0.064], [0.205, 0.172], [0.218, 0.194], [0.312, 0.208],
        [0.372, 0.336], [0.392, 0.340], [0.548, 0.340], [0.556, 0.332],
        [0.585, 0.205], [0.588, 0.188], [0.588, 0.074], [0.574, 0.052],
        [0.530, 0.046], [0.236, 0.046],
      ],
      cabinWindow: [
        [0.324, 0.214], [0.378, 0.326], [0.536, 0.326], [0.568, 0.218],
      ],
      wheels: [{ x: 0.268, y: 0.064, r: 0.064 }, { x: 0.520, y: 0.064, r: 0.064 }],
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
      category: 'suvs',
      isTop10: false,
      salesRank: 'Archetype',
      powertrain: 'Gas V8',
      svgKey: 'fullsize_suv',
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
        [0.188, 0.070], [0.188, 0.232], [0.198, 0.252], [0.308, 0.264],
        [0.350, 0.382], [0.372, 0.386], [0.616, 0.386], [0.626, 0.374],
        [0.634, 0.088], [0.618, 0.064], [0.560, 0.056], [0.222, 0.056],
      ],
      cabinWindow: [
        [0.320, 0.274], [0.356, 0.372], [0.606, 0.372], [0.614, 0.274],
      ],
      wheels: [{ x: 0.256, y: 0.072, r: 0.072 }, { x: 0.554, y: 0.072, r: 0.072 }],
      roofMount: { x0: 0.380, x1: 0.555, y: 0.387 },
      callouts: [
        { x: 0.185, y: 0.180, anchorX: 0.11, anchorY: 0.31, label: 'Tall Bluff Grille (3.25 m\u00b2)', tone: 'warn' },
        { x: 0.490, y: 0.390, anchorX: 0.49, anchorY: 0.51, label: 'Closed Cabin (No Bed Vortex)', tone: 'good' },
        { x: 0.652, y: 0.225, anchorX: 0.79, anchorY: 0.34, label: 'Tall Boxy Wake (Cd 0.38)', tone: 'info' },
      ],
    },

    minivan: {
      id: 'minivan',
      name: 'Family Minivan',
      shortName: 'Minivan',
      tagline: 'Tall frontal area & squareback liftgate',
      category: 'cars',
      isTop10: false,
      salesRank: 'Archetype',
      powertrain: 'Gas V6',
      svgKey: 'minivan',
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
        [0.195, 0.052], [0.195, 0.112], [0.205, 0.168], [0.250, 0.202],
        [0.315, 0.342], [0.345, 0.352], [0.608, 0.352], [0.620, 0.336],
        [0.625, 0.088], [0.612, 0.052], [0.545, 0.042], [0.232, 0.040],
      ],
      cabinWindow: [
        [0.268, 0.212], [0.324, 0.336], [0.594, 0.336], [0.604, 0.212],
      ],
      wheels: [{ x: 0.264, y: 0.060, r: 0.060 }, { x: 0.548, y: 0.060, r: 0.060 }],
      roofMount: { x0: 0.375, x1: 0.530, y: 0.353 },
      callouts: [
        { x: 0.202, y: 0.155, anchorX: 0.12, anchorY: 0.28, label: 'Tall Frontal Area (2.85 m\u00b2)', tone: 'warn' },
        { x: 0.460, y: 0.356, anchorX: 0.46, anchorY: 0.49, label: 'Long Attached Roof', tone: 'good' },
        { x: 0.642, y: 0.220, anchorX: 0.78, anchorY: 0.34, label: 'Squareback Base-Drag Wake', tone: 'info' },
      ],
    },

    truck: {
      id: 'truck',
      name: 'Pickup Truck (Base)',
      shortName: 'Base Truck',
      tagline: 'Bluff grille, tall cab & open cargo bed',
      category: 'trucks',
      isTop10: false,
      salesRank: 'Baseline',
      powertrain: 'Gas V8',
      svgKey: 'truck',
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
        [0.185, 0.072], [0.185, 0.235], [0.194, 0.255], [0.300, 0.266],
        [0.338, 0.382], [0.365, 0.388], [0.472, 0.388], [0.478, 0.376],
        [0.478, 0.215], [0.642, 0.215], [0.644, 0.285], [0.664, 0.285],
        [0.664, 0.095], [0.648, 0.070], [0.575, 0.062], [0.220, 0.060],
      ],
      polygonCovered: [
        [0.185, 0.072], [0.185, 0.235], [0.194, 0.255], [0.300, 0.266],
        [0.338, 0.382], [0.365, 0.388], [0.472, 0.388], [0.478, 0.376],
        [0.478, 0.285], [0.664, 0.285], [0.664, 0.095], [0.648, 0.070],
        [0.575, 0.062], [0.220, 0.060],
      ],
      cabinWindow: [[0.312, 0.276], [0.344, 0.372], [0.464, 0.372], [0.464, 0.276]],
      wheels: [{ x: 0.254, y: 0.072, r: 0.072 }, { x: 0.562, y: 0.072, r: 0.072 }],
      roofMount: { x0: 0.345, x1: 0.470, y: 0.389 },
      callouts: [
        { x: 0.182, y: 0.180, anchorX: 0.11, anchorY: 0.31, label: 'Bluff Grille Stagnation', tone: 'warn' },
        { x: 0.558, y: 0.245, anchorX: 0.56, anchorY: 0.46, label: 'Trapped Bed Vortex', tone: 'warn', coveredLabel: 'Tonneau Smoothed Bed' },
        { x: 0.680, y: 0.210, anchorX: 0.80, anchorY: 0.32, label: 'Large Tailgate Suction Wake', tone: 'info' },
      ],
    },

    coupe: {
      id: 'coupe',
      name: 'Hyundai Elantra',
      shortName: 'Elantra',
      tagline: '4-door fastback coupe with ducktail trunk lip',
      category: 'cars',
      isTop10: false,
      salesRank: 'CN7 Coupe',
      powertrain: 'Gas 2.0L',
      svgKey: 'fastback',
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
        [0.204, 0.048], [0.202, 0.095], [0.214, 0.138], [0.296, 0.168],
        [0.366, 0.274], [0.408, 0.283], [0.468, 0.274], [0.548, 0.202],
        [0.590, 0.196], [0.596, 0.184], [0.591, 0.118], [0.595, 0.070],
        [0.578, 0.044], [0.525, 0.034], [0.236, 0.032],
      ],
      cabinWindow: [
        [0.306, 0.174], [0.370, 0.264], [0.412, 0.272], [0.465, 0.262],
        [0.535, 0.200], [0.468, 0.178], [0.320, 0.174],
      ],
      wheels: [{ x: 0.266, y: 0.055, r: 0.055 }, { x: 0.524, y: 0.055, r: 0.055 }],
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
      category: 'twowheel',
      isTop10: false,
      salesRank: '2-Wheel',
      powertrain: 'Gas',
      svgKey: 'motorcycle',
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
        [0.308, 0.100], [0.312, 0.172], [0.336, 0.212], [0.368, 0.194],
        [0.405, 0.174], [0.456, 0.200], [0.478, 0.188], [0.464, 0.140],
        [0.425, 0.082], [0.355, 0.056], [0.324, 0.068],
      ],
      riderPolygon: [
        [0.352, 0.214], [0.364, 0.264], [0.382, 0.280], [0.404, 0.272],
        [0.436, 0.246], [0.448, 0.198], [0.415, 0.145], [0.376, 0.168],
      ],
      cabinWindow: [[0.316, 0.174], [0.337, 0.211], [0.350, 0.204], [0.332, 0.172]],
      wheels: [{ x: 0.330, y: 0.064, r: 0.064 }, { x: 0.454, y: 0.064, r: 0.064 }],
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
      category: 'twowheel',
      isTop10: false,
      salesRank: '2-Wheel EV',
      powertrain: 'EV',
      svgKey: 'escooter',
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
        [0.340, 0.036], [0.438, 0.036], [0.438, 0.058], [0.362, 0.058],
        [0.354, 0.232], [0.342, 0.232], [0.350, 0.058], [0.340, 0.058],
      ],
      riderPolygon: [
        [0.380, 0.058], [0.416, 0.058], [0.414, 0.188], [0.418, 0.312],
        [0.408, 0.330], [0.410, 0.368], [0.392, 0.378], [0.374, 0.368],
        [0.374, 0.332], [0.376, 0.305], [0.350, 0.236], [0.356, 0.222],
        [0.378, 0.264], [0.378, 0.185],
      ],
      cabinWindow: null,
      wheels: [{ x: 0.346, y: 0.028, r: 0.028 }, { x: 0.432, y: 0.028, r: 0.028 }],
      roofMount: null,
      callouts: [
        { x: 0.372, y: 0.275, anchorX: 0.20, anchorY: 0.34, label: 'Standing Human Sail (Cd 1.10)', tone: 'warn' },
        { x: 0.392, y: 0.382, anchorX: 0.39, anchorY: 0.50, label: 'More Drag Than a Sedan!', tone: 'warn' },
        { x: 0.448, y: 0.240, anchorX: 0.65, anchorY: 0.32, label: 'Massive Shedding Wake', tone: 'info' },
      ],
    },

    // --- TOP 10 BEST-SELLING US MODELS ---
    ford_f150: {
      id: 'ford_f150',
      name: 'Ford F-Series (F-150)',
      shortName: 'F-150',
      tagline: 'Aluminum SuperCrew with active air dam & grille shutters',
      category: 'trucks',
      isTop10: true,
      salesRank: '#1 US \u2022 561k+',
      powertrain: '2.7L EcoBoost',
      svgKey: 'truck',
      cd: 0.390,
      area: 3.24,
      mass: 2190,
      crr: 0.0110,
      idleWatts: 12500,
      drivetrainEta: 0.315,
      bodyColor: '#2563eb',
      bodyAccent: '#1e40af',
      polygon: [
        [0.180, 0.056], [0.180, 0.232], [0.192, 0.256], [0.302, 0.268],
        [0.338, 0.386], [0.362, 0.392], [0.474, 0.392], [0.480, 0.380],
        [0.480, 0.216], [0.646, 0.216], [0.648, 0.286], [0.670, 0.286],
        [0.670, 0.094], [0.652, 0.068], [0.578, 0.060], [0.214, 0.056],
      ],
      polygonCovered: [
        [0.180, 0.056], [0.180, 0.232], [0.192, 0.256], [0.302, 0.268],
        [0.338, 0.386], [0.362, 0.392], [0.474, 0.392], [0.480, 0.380],
        [0.480, 0.286], [0.670, 0.286], [0.670, 0.094], [0.652, 0.068],
        [0.578, 0.060], [0.214, 0.056],
      ],
      cabinWindow: [[0.312, 0.276], [0.344, 0.376], [0.466, 0.376], [0.466, 0.276]],
      wheels: [{ x: 0.250, y: 0.072, r: 0.072 }, { x: 0.568, y: 0.072, r: 0.072 }],
      roofMount: { x0: 0.350, x1: 0.470, y: 0.393 },
      callouts: [
        { x: 0.180, y: 0.070, anchorX: 0.11, anchorY: 0.20, label: 'Active Front Air Dam', tone: 'good' },
        { x: 0.478, y: 0.250, anchorX: 0.56, anchorY: 0.47, label: 'Open Bed Recirculation', tone: 'warn', coveredLabel: 'Tonneau Smoothed Bed' },
        { x: 0.684, y: 0.205, anchorX: 0.80, anchorY: 0.31, label: 'Aluminum Crew Wake (Cd 0.39)', tone: 'info' },
      ],
    },

    chevy_silverado: {
      id: 'chevy_silverado',
      name: 'Chevrolet Silverado 1500',
      shortName: 'Silverado',
      tagline: 'Wide bluff grille, air-curtain bumper & cab rear spoiler lip',
      category: 'trucks',
      isTop10: true,
      salesRank: '#2 US \u2022 422k+',
      powertrain: '5.3L V8',
      svgKey: 'truck',
      cd: 0.405,
      area: 3.30,
      mass: 2330,
      crr: 0.0112,
      idleWatts: 15500,
      drivetrainEta: 0.295,
      bodyColor: '#dc2626',
      bodyAccent: '#991b1b',
      polygon: [
        [0.180, 0.066], [0.180, 0.236], [0.190, 0.258], [0.298, 0.268],
        [0.336, 0.378], [0.362, 0.384], [0.476, 0.384], [0.484, 0.378],
        [0.482, 0.214], [0.648, 0.214], [0.650, 0.284], [0.671, 0.284],
        [0.671, 0.095], [0.652, 0.068], [0.578, 0.062], [0.216, 0.062],
      ],
      polygonCovered: [
        [0.180, 0.066], [0.180, 0.236], [0.190, 0.258], [0.298, 0.268],
        [0.336, 0.378], [0.362, 0.384], [0.476, 0.384], [0.484, 0.378],
        [0.484, 0.284], [0.671, 0.284], [0.671, 0.095], [0.652, 0.068],
        [0.578, 0.062], [0.216, 0.062],
      ],
      cabinWindow: [[0.310, 0.276], [0.342, 0.370], [0.468, 0.370], [0.468, 0.276]],
      wheels: [{ x: 0.250, y: 0.072, r: 0.072 }, { x: 0.568, y: 0.072, r: 0.072 }],
      roofMount: { x0: 0.348, x1: 0.470, y: 0.385 },
      callouts: [
        { x: 0.178, y: 0.185, anchorX: 0.11, anchorY: 0.31, label: 'Wide Silverado Grille (3.30 m\u00b2)', tone: 'warn' },
        { x: 0.484, y: 0.380, anchorX: 0.52, anchorY: 0.49, label: 'Cab Spoiler Over Bed', tone: 'good', coveredLabel: 'Tonneau Smoothed Bed' },
        { x: 0.684, y: 0.210, anchorX: 0.80, anchorY: 0.32, label: 'Tailgate Suction (Cd 0.405)', tone: 'info' },
      ],
    },

    honda_crv: {
      id: 'honda_crv',
      name: 'Honda CR-V',
      shortName: 'CR-V',
      tagline: '6th-gen long hood & swept D-pillar compact crossover',
      category: 'suvs',
      isTop10: true,
      salesRank: '#3 US \u2022 336k+',
      powertrain: '1.5L Turbo',
      svgKey: 'compact_suv',
      cd: 0.310,
      area: 2.66,
      mass: 1665,
      crr: 0.0098,
      idleWatts: 10500,
      drivetrainEta: 0.312,
      bodyColor: '#0284c7',
      bodyAccent: '#075985',
      polygon: [
        [0.200, 0.060], [0.200, 0.168], [0.214, 0.194], [0.318, 0.208],
        [0.376, 0.334], [0.398, 0.338], [0.552, 0.338], [0.562, 0.328],
        [0.588, 0.202], [0.591, 0.184], [0.590, 0.072], [0.576, 0.050],
        [0.530, 0.044], [0.232, 0.044],
      ],
      cabinWindow: [[0.328, 0.214], [0.382, 0.324], [0.542, 0.324], [0.572, 0.214]],
      wheels: [{ x: 0.264, y: 0.064, r: 0.064 }, { x: 0.522, y: 0.064, r: 0.064 }],
      roofMount: { x0: 0.400, x1: 0.532, y: 0.339 },
      callouts: [
        { x: 0.200, y: 0.145, anchorX: 0.11, anchorY: 0.26, label: 'Sculpted CR-V Grille', tone: 'warn' },
        { x: 0.468, y: 0.342, anchorX: 0.47, anchorY: 0.47, label: 'Clean Roofline (Cd 0.31)', tone: 'good' },
        { x: 0.606, y: 0.200, anchorX: 0.77, anchorY: 0.30, label: 'Swept D-Pillar Wake', tone: 'info' },
      ],
    },

    ram_1500: {
      id: 'ram_1500',
      name: 'Ram Pickup (1500)',
      shortName: 'Ram 1500',
      tagline: 'Best-in-class truck aero: rounded nose & active air dam',
      category: 'trucks',
      isTop10: true,
      salesRank: '#4 US \u2022 325k+',
      powertrain: 'Active Aero',
      svgKey: 'truck',
      cd: 0.357,
      area: 3.32,
      mass: 2390,
      crr: 0.0110,
      idleWatts: 13500,
      drivetrainEta: 0.310,
      bodyColor: '#7c3aed',
      bodyAccent: '#5b21b6',
      polygon: [
        [0.178, 0.054], [0.180, 0.220], [0.198, 0.252], [0.306, 0.270],
        [0.344, 0.388], [0.368, 0.394], [0.476, 0.394], [0.484, 0.384],
        [0.482, 0.218], [0.648, 0.218], [0.650, 0.288], [0.671, 0.288],
        [0.671, 0.094], [0.654, 0.068], [0.580, 0.058], [0.212, 0.054],
      ],
      polygonCovered: [
        [0.178, 0.054], [0.180, 0.220], [0.198, 0.252], [0.306, 0.270],
        [0.344, 0.388], [0.368, 0.394], [0.476, 0.394], [0.484, 0.384],
        [0.484, 0.288], [0.671, 0.288], [0.671, 0.094], [0.654, 0.068],
        [0.580, 0.058], [0.212, 0.054],
      ],
      cabinWindow: [[0.316, 0.278], [0.348, 0.378], [0.468, 0.378], [0.468, 0.278]],
      wheels: [{ x: 0.250, y: 0.072, r: 0.072 }, { x: 0.568, y: 0.072, r: 0.072 }],
      roofMount: { x0: 0.354, x1: 0.472, y: 0.395 },
      callouts: [
        { x: 0.182, y: 0.190, anchorX: 0.11, anchorY: 0.31, label: 'Rounded Nose + Active Dam', tone: 'good' },
        { x: 0.484, y: 0.386, anchorX: 0.53, anchorY: 0.49, label: 'Cab Spoiler (Cd 0.357)', tone: 'good', coveredLabel: 'Tonneau Smoothed Bed' },
        { x: 0.684, y: 0.205, anchorX: 0.80, anchorY: 0.31, label: 'Lowest Full-Size Truck CdA', tone: 'info' },
      ],
    },

    tesla_model_y: {
      id: 'tesla_model_y',
      name: 'Tesla Model Y',
      shortName: 'Model Y',
      tagline: 'Grille-less EV teardrop crossover with Kamm tail & flat floor',
      category: 'suvs',
      isTop10: true,
      salesRank: '#5 US \u2022 ~265k',
      powertrain: 'EV AWD',
      svgKey: 'ev_crossover',
      isElectric: true,
      cd: 0.230,
      area: 2.62,
      mass: 2050,
      crr: 0.0085,
      idleWatts: 450,
      drivetrainEta: 0.870,
      bodyColor: '#e11d48',
      bodyAccent: '#9f1239',
      polygon: [
        [0.200, 0.044], [0.202, 0.104], [0.216, 0.152], [0.288, 0.188],
        [0.366, 0.312], [0.418, 0.324], [0.474, 0.316], [0.556, 0.238],
        [0.594, 0.214], [0.597, 0.188], [0.595, 0.076], [0.578, 0.046],
        [0.532, 0.036], [0.232, 0.034],
      ],
      cabinWindow: [
        [0.300, 0.194], [0.372, 0.300], [0.420, 0.312], [0.472, 0.304],
        [0.542, 0.234], [0.470, 0.202], [0.316, 0.194],
      ],
      wheels: [{ x: 0.264, y: 0.058, r: 0.058 }, { x: 0.526, y: 0.058, r: 0.058 }],
      roofMount: { x0: 0.378, x1: 0.492, y: 0.325 },
      callouts: [
        { x: 0.204, y: 0.128, anchorX: 0.11, anchorY: 0.24, label: 'Sealed Grille-Less EV Nose', tone: 'good' },
        { x: 0.440, y: 0.324, anchorX: 0.44, anchorY: 0.46, label: 'Teardrop Dome (Cd 0.23)', tone: 'good' },
        { x: 0.612, y: 0.195, anchorX: 0.77, anchorY: 0.28, label: 'Flat Floor & Kamm Wake', tone: 'info' },
      ],
    },

    toyota_camry: {
      id: 'toyota_camry',
      name: 'Toyota Camry',
      shortName: 'Camry',
      tagline: '9th-gen hammerhead-nose hybrid midsize sedan',
      category: 'cars',
      isTop10: true,
      salesRank: '#6 US \u2022 260k+',
      powertrain: '2.5L Hybrid',
      svgKey: 'sedan',
      cd: 0.275,
      area: 2.24,
      mass: 1650,
      crr: 0.0090,
      idleWatts: 6200,
      drivetrainEta: 0.375,
      bodyColor: '#0d9488',
      bodyAccent: '#115e59',
      polygon: [
        [0.198, 0.046], [0.198, 0.098], [0.210, 0.146], [0.296, 0.184],
        [0.366, 0.278], [0.414, 0.289], [0.478, 0.284], [0.546, 0.226],
        [0.594, 0.206], [0.605, 0.186], [0.604, 0.086], [0.592, 0.050],
        [0.540, 0.038], [0.236, 0.036],
      ],
      cabinWindow: [
        [0.308, 0.190], [0.370, 0.266], [0.416, 0.276], [0.472, 0.272],
        [0.530, 0.222], [0.472, 0.194], [0.320, 0.190],
      ],
      wheels: [{ x: 0.260, y: 0.056, r: 0.056 }, { x: 0.532, y: 0.056, r: 0.056 }],
      roofMount: { x0: 0.368, x1: 0.495, y: 0.290 },
      callouts: [
        { x: 0.198, y: 0.125, anchorX: 0.11, anchorY: 0.24, label: 'Hammerhead Aero Nose', tone: 'good' },
        { x: 0.432, y: 0.292, anchorX: 0.43, anchorY: 0.44, label: 'Hybrid Sedan (Cd 0.275)', tone: 'good' },
        { x: 0.620, y: 0.165, anchorX: 0.77, anchorY: 0.26, label: '50.4 MPG @ 65 mph', tone: 'info' },
      ],
    },

    gmc_sierra: {
      id: 'gmc_sierra',
      name: 'GMC Sierra 1500',
      shortName: 'Sierra',
      tagline: 'Tall upright bluff grille & MultiPro square tailgate',
      category: 'trucks',
      isTop10: true,
      salesRank: '#7 US \u2022 257k+',
      powertrain: '5.3L V8',
      svgKey: 'truck',
      cd: 0.420,
      area: 3.36,
      mass: 2380,
      crr: 0.0114,
      idleWatts: 16000,
      drivetrainEta: 0.292,
      bodyColor: '#b91c1c',
      bodyAccent: '#7f1d1d',
      polygon: [
        [0.180, 0.068], [0.180, 0.242], [0.190, 0.262], [0.298, 0.270],
        [0.336, 0.382], [0.362, 0.388], [0.474, 0.388], [0.480, 0.376],
        [0.480, 0.214], [0.648, 0.214], [0.650, 0.288], [0.671, 0.288],
        [0.671, 0.095], [0.654, 0.068], [0.578, 0.062], [0.216, 0.062],
      ],
      polygonCovered: [
        [0.180, 0.068], [0.180, 0.242], [0.190, 0.262], [0.298, 0.270],
        [0.336, 0.382], [0.362, 0.388], [0.474, 0.388], [0.480, 0.376],
        [0.480, 0.288], [0.671, 0.288], [0.671, 0.095], [0.654, 0.068],
        [0.578, 0.062], [0.216, 0.062],
      ],
      cabinWindow: [[0.310, 0.278], [0.342, 0.374], [0.466, 0.374], [0.466, 0.278]],
      wheels: [{ x: 0.250, y: 0.072, r: 0.072 }, { x: 0.568, y: 0.072, r: 0.072 }],
      roofMount: { x0: 0.348, x1: 0.470, y: 0.389 },
      callouts: [
        { x: 0.178, y: 0.195, anchorX: 0.11, anchorY: 0.32, label: 'Tall Bluff Grille (3.36 m\u00b2)', tone: 'warn' },
        { x: 0.560, y: 0.245, anchorX: 0.56, anchorY: 0.47, label: 'Open Bed Vortex', tone: 'warn', coveredLabel: 'Tonneau Smoothed Bed' },
        { x: 0.684, y: 0.210, anchorX: 0.80, anchorY: 0.32, label: 'Heavy Wake (Cd 0.42)', tone: 'info' },
      ],
    },

    toyota_rav4: {
      id: 'toyota_rav4',
      name: 'Toyota RAV4',
      shortName: 'RAV4',
      tagline: 'XA50 angular crossover with 2.5L Hybrid powertrain',
      category: 'suvs',
      isTop10: true,
      salesRank: '#8 US \u2022 253k+',
      powertrain: '2.5L Hybrid',
      svgKey: 'compact_suv',
      cd: 0.320,
      area: 2.65,
      mass: 1790,
      crr: 0.0098,
      idleWatts: 7200,
      drivetrainEta: 0.355,
      bodyColor: '#4f46e5',
      bodyAccent: '#3730a3',
      polygon: [
        [0.205, 0.064], [0.205, 0.172], [0.218, 0.194], [0.312, 0.208],
        [0.372, 0.336], [0.392, 0.340], [0.548, 0.340], [0.556, 0.332],
        [0.585, 0.205], [0.588, 0.188], [0.588, 0.074], [0.574, 0.052],
        [0.530, 0.046], [0.236, 0.046],
      ],
      cabinWindow: [[0.324, 0.214], [0.378, 0.326], [0.536, 0.326], [0.568, 0.218]],
      wheels: [{ x: 0.268, y: 0.064, r: 0.064 }, { x: 0.520, y: 0.064, r: 0.064 }],
      roofMount: { x0: 0.395, x1: 0.525, y: 0.341 },
      callouts: [
        { x: 0.202, y: 0.145, anchorX: 0.11, anchorY: 0.26, label: 'Trapezoidal RAV4 Nose', tone: 'warn' },
        { x: 0.460, y: 0.344, anchorX: 0.46, anchorY: 0.48, label: 'Hybrid Efficiency (37.2 MPG @ 65)', tone: 'good' },
        { x: 0.605, y: 0.200, anchorX: 0.76, anchorY: 0.30, label: 'Rear Spoiler Wake (Cd 0.32)', tone: 'info' },
      ],
    },

    toyota_tacoma: {
      id: 'toyota_tacoma',
      name: 'Toyota Tacoma',
      shortName: 'Tacoma',
      tagline: 'Midsize Double Cab with smaller 2.78 m\u00b2 frontal area',
      category: 'trucks',
      isTop10: true,
      salesRank: '#9 US \u2022 214k+',
      powertrain: '2.4L i-FORCE',
      svgKey: 'midsize_truck',
      cd: 0.385,
      area: 2.78,
      mass: 2060,
      crr: 0.0110,
      idleWatts: 11800,
      drivetrainEta: 0.298,
      bodyColor: '#d97706',
      bodyAccent: '#92400e',
      polygon: [
        [0.195, 0.072], [0.195, 0.220], [0.206, 0.244], [0.308, 0.256],
        [0.344, 0.370], [0.368, 0.376], [0.470, 0.376], [0.476, 0.364],
        [0.476, 0.208], [0.626, 0.208], [0.628, 0.274], [0.646, 0.274],
        [0.646, 0.092], [0.630, 0.068], [0.562, 0.062], [0.228, 0.062],
      ],
      polygonCovered: [
        [0.195, 0.072], [0.195, 0.220], [0.206, 0.244], [0.308, 0.256],
        [0.344, 0.370], [0.368, 0.376], [0.470, 0.376], [0.476, 0.364],
        [0.476, 0.274], [0.646, 0.274], [0.646, 0.092], [0.630, 0.068],
        [0.562, 0.062], [0.228, 0.062],
      ],
      cabinWindow: [[0.318, 0.264], [0.350, 0.360], [0.462, 0.360], [0.462, 0.264]],
      wheels: [{ x: 0.260, y: 0.070, r: 0.070 }, { x: 0.550, y: 0.070, r: 0.070 }],
      roofMount: { x0: 0.356, x1: 0.464, y: 0.377 },
      callouts: [
        { x: 0.194, y: 0.175, anchorX: 0.11, anchorY: 0.30, label: 'Midsize Area (2.78 m\u00b2)', tone: 'good' },
        { x: 0.548, y: 0.236, anchorX: 0.55, anchorY: 0.46, label: 'Open Midsize Bed Vortex', tone: 'warn', coveredLabel: 'Tonneau Smoothed Bed' },
        { x: 0.662, y: 0.200, anchorX: 0.79, anchorY: 0.30, label: 'Tailgate Wake (Cd 0.385)', tone: 'info' },
      ],
    },

    nissan_rogue: {
      id: 'nissan_rogue',
      name: 'Nissan Rogue',
      shortName: 'Rogue',
      tagline: 'T33 V-motion crossover with active grille shutters',
      category: 'suvs',
      isTop10: true,
      salesRank: '#10 US \u2022 201k+',
      powertrain: '1.5L VC-Turbo',
      svgKey: 'compact_suv',
      cd: 0.334,
      area: 2.62,
      mass: 1630,
      crr: 0.0096,
      idleWatts: 9600,
      drivetrainEta: 0.325,
      bodyColor: '#9333ea',
      bodyAccent: '#6b21a8',
      polygon: [
        [0.202, 0.060], [0.202, 0.168], [0.216, 0.192], [0.314, 0.206],
        [0.374, 0.334], [0.394, 0.338], [0.550, 0.338], [0.560, 0.328],
        [0.586, 0.204], [0.590, 0.184], [0.588, 0.072], [0.574, 0.050],
        [0.528, 0.044], [0.234, 0.044],
      ],
      cabinWindow: [[0.326, 0.212], [0.378, 0.324], [0.538, 0.324], [0.570, 0.214]],
      wheels: [{ x: 0.266, y: 0.064, r: 0.064 }, { x: 0.522, y: 0.064, r: 0.064 }],
      roofMount: { x0: 0.396, x1: 0.528, y: 0.339 },
      callouts: [
        { x: 0.202, y: 0.145, anchorX: 0.11, anchorY: 0.26, label: 'Blunt V-Motion Nose', tone: 'warn' },
        { x: 0.464, y: 0.342, anchorX: 0.46, anchorY: 0.47, label: 'Floating Roof (Cd 0.334)', tone: 'good' },
        { x: 0.606, y: 0.200, anchorX: 0.77, anchorY: 0.30, label: 'VC-Turbo 33.5 MPG @ 65', tone: 'info' },
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
    const tonneauActive = Boolean(opts.tonneauCover && base.polygonCovered);
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

  function getFilteredVehicles(categoryFilter) {
    const filter = categoryFilter || 'all';
    if (filter === 'all') return VEHICLE_ORDER.slice();
    if (filter === 'top10') return VEHICLE_ORDER.filter((id) => VEHICLES[id].isTop10);
    return VEHICLE_ORDER.filter((id) => VEHICLES[id].category === filter);
  }

  function getChartPeers(activeVehicleId, categoryFilter) {
    const pool = getFilteredVehicles(categoryFilter);
    const active = VEHICLES[activeVehicleId] ? activeVehicleId : 'sedan';
    if (pool.length <= 6) {
      return pool.includes(active) ? pool : [active, ...pool.slice(0, 5)];
    }
    const defaults = categoryFilter === 'top10'
      ? ['ford_f150', 'ram_1500', 'honda_crv', 'tesla_model_y', 'toyota_camry', 'toyota_tacoma']
      : ['coupe', 'sedan', 'tesla_model_y', 'toyota_rav4', 'ford_f150', 'truck'];
    const peers = defaults.filter((id) => pool.includes(id));
    if (!peers.includes(active)) {
      peers.pop();
      peers.unshift(active);
    }
    return peers.slice(0, 6);
  }

  const AeroPhysics = {
    CONSTANTS,
    VEHICLE_ORDER,
    SVG_SHAPES,
    VEHICLES,
    getVehicleConfig,
    computeMetrics,
    computeCurve,
    getFilteredVehicles,
    getChartPeers,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AeroPhysics;
  } else {
    root.AeroPhysics = AeroPhysics;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
