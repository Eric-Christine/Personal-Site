import sys

TARGETS = [
    "/Users/ericchristine/Desktop/code_projects/Personal-Site/games/skyline-sprint.js",
    "/Users/ericchristine/Desktop/code_projects/mario-side-scroller/game.js"
]

R1 = """const state = {
  mode: "start",
  score: 0,
  coinsCollected: 0,
  totalCoins: 0,
  worldWidth: 3200,
  cameraX: 0,
  lastTimestamp: performance.now(),
  input: {"""
N1 = """const state = {
  mode: "start",
  score: 0,
  coinsCollected: 0,
  totalCoins: 0,
  worldWidth: 3200,
  cameraX: 0,
  lastTimestamp: performance.now(),
  level: 1,
  maxLevel: 4,
  lives: 3,
  input: {"""

R2 = """function createWorld() {"""
N2 = """function killPlayer() {
  state.lives -= 1;
  if (state.lives > 0) {
    state.mode = "died";
  } else {
    state.mode = "lost";
  }
}

function createWorld() {"""

R3 = """function createWorld() {
  state.solids = [
    { x: 0, y: FLOOR_Y, w: 3210, h: 100 },
    { x: 430, y: 365, w: 140, h: 18 },
    { x: 860, y: 330, w: 140, h: 18 },
    { x: 1480, y: 340, w: 130, h: 18 },
    { x: 2050, y: 360, w: 130, h: 18 },
    { x: 2620, y: 320, w: 170, h: 18 },
  ];

  state.coins = [
    { x: 300, y: 400, r: 10, collected: false },
    { x: 500, y: 335, r: 10, collected: false },
    { x: 915, y: 300, r: 10, collected: false },
    { x: 1120, y: 410, r: 10, collected: false },
    { x: 1520, y: 305, r: 10, collected: false },
    { x: 2120, y: 325, r: 10, collected: false },
    { x: 2460, y: 400, r: 10, collected: false },
    { x: 2740, y: 280, r: 10, collected: false },
    { x: 2960, y: 400, r: 10, collected: false },
  ];

  state.enemies = [
    {
      x: 1300,
      y: FLOOR_Y - 34,
      w: 34,
      h: 34,
      vx: 0,
      minX: 1300,
      maxX: 1334,
      alive: true,
      shotCooldown: 0.8,
    },
    {
      x: 2320,
      y: FLOOR_Y - 34,
      w: 34,
      h: 34,
      vx: 0,
      minX: 2320,
      maxX: 2354,
      alive: true,
      shotCooldown: 1.3,
    },
  ];

  state.weaponPickups = [
    {
      x: 640,
      y: FLOOR_Y - 34,
      w: 26,
      h: 20,
      collected: false,
    },
  ];

  state.totalCoins = state.coins.length;
}"""
N3 = """function createWorld() {
  if (state.level === 1) {
    state.worldWidth = 3200;
    state.goal.x = 3050;
    state.solids = [
      { x: 0, y: FLOOR_Y, w: 3210, h: 100 },
      { x: 430, y: 365, w: 140, h: 18 },
      { x: 860, y: 330, w: 140, h: 18 },
      { x: 1480, y: 340, w: 130, h: 18 },
      { x: 2050, y: 360, w: 130, h: 18 },
      { x: 2620, y: 320, w: 170, h: 18 },
    ];
    state.coins = [
      { x: 300, y: 400, r: 10, collected: false },
      { x: 500, y: 335, r: 10, collected: false },
      { x: 915, y: 300, r: 10, collected: false },
      { x: 1120, y: 410, r: 10, collected: false },
      { x: 1520, y: 305, r: 10, collected: false },
      { x: 2120, y: 325, r: 10, collected: false },
      { x: 2460, y: 400, r: 10, collected: false },
      { x: 2740, y: 280, r: 10, collected: false },
      { x: 2960, y: 400, r: 10, collected: false },
    ];
    state.enemies = [
      { x: 1300, y: FLOOR_Y - 34, w: 34, h: 34, vx: 0, minX: 1300, maxX: 1334, alive: true, shotCooldown: 0.8 },
      { x: 2320, y: FLOOR_Y - 34, w: 34, h: 34, vx: 0, minX: 2320, maxX: 2354, alive: true, shotCooldown: 1.3 },
    ];
    state.weaponPickups = [
      { x: 640, y: FLOOR_Y - 34, w: 26, h: 20, collected: false },
    ];
  } else if (state.level === 2) {
    state.worldWidth = 3600;
    state.goal.x = 3450;
    state.solids = [
      { x: 0, y: FLOOR_Y, w: 1200, h: 100 },
      { x: 1350, y: FLOOR_Y, w: 600, h: 100 },
      { x: 2100, y: FLOOR_Y, w: 1600, h: 100 },
      { x: 300, y: 380, w: 120, h: 18 },
      { x: 600, y: 290, w: 120, h: 18 },
      { x: 950, y: 350, w: 120, h: 18 },
      { x: 1600, y: 330, w: 120, h: 18 },
      { x: 2400, y: 350, w: 120, h: 18 },
      { x: 2800, y: 280, w: 120, h: 18 },
    ];
    state.coins = [
      { x: 360, y: 340, r: 10, collected: false },
      { x: 660, y: 250, r: 10, collected: false },
      { x: 1000, y: 310, r: 10, collected: false },
      { x: 1275, y: 390, r: 10, collected: false },
      { x: 1660, y: 290, r: 10, collected: false },
      { x: 2025, y: 390, r: 10, collected: false },
      { x: 2460, y: 310, r: 10, collected: false },
      { x: 2860, y: 240, r: 10, collected: false },
    ];
    state.enemies = [
      { x: 800, y: FLOOR_Y - 34, w: 34, h: 34, vx: 50, minX: 700, maxX: 900, alive: true, shotCooldown: 1.2 },
      { x: 1700, y: FLOOR_Y - 34, w: 34, h: 34, vx: -60, minX: 1600, maxX: 1900, alive: true, shotCooldown: 1.0 },
      { x: 2600, y: FLOOR_Y - 34, w: 34, h: 34, vx: 40, minX: 2500, maxX: 2700, alive: true, shotCooldown: 0.8 },
    ];
    state.weaponPickups = [
      { x: 660, y: 200, w: 26, h: 20, collected: false },
    ];
  } else if (state.level === 3) {
    state.worldWidth = 4000;
    state.goal.x = 3850;
    state.solids = [
      { x: 0, y: FLOOR_Y, w: 800, h: 100 },
      { x: 950, y: FLOOR_Y, w: 400, h: 100 },
      { x: 1550, y: FLOOR_Y, w: 300, h: 100 },
      { x: 2050, y: FLOOR_Y, w: 500, h: 100 },
      { x: 2750, y: FLOOR_Y, w: 1300, h: 100 },
      { x: 300, y: 360, w: 100, h: 18 },
      { x: 550, y: 280, w: 100, h: 18 },
      { x: 1100, y: 340, w: 100, h: 18 },
      { x: 1400, y: 260, w: 100, h: 18 },
      { x: 1880, y: 380, w: 100, h: 18 },
      { x: 2300, y: 320, w: 100, h: 18 },
      { x: 2900, y: 250, w: 100, h: 18 },
      { x: 3300, y: 350, w: 100, h: 18 },
    ];
    state.coins = [
      { x: 350, y: 320, r: 10, collected: false },
      { x: 600, y: 240, r: 10, collected: false },
      { x: 875, y: 390, r: 10, collected: false },
      { x: 1150, y: 300, r: 10, collected: false },
      { x: 1450, y: 220, r: 10, collected: false },
      { x: 1930, y: 340, r: 10, collected: false },
      { x: 2350, y: 280, r: 10, collected: false },
      { x: 2950, y: 210, r: 10, collected: false },
      { x: 3350, y: 310, r: 10, collected: false },
      { x: 3600, y: FLOOR_Y - 40, r: 10, collected: false },
    ];
    state.enemies = [
      { x: 600, y: FLOOR_Y - 34, w: 34, h: 34, vx: -80, minX: 400, maxX: 750, alive: true, shotCooldown: 0.9 },
      { x: 1200, y: FLOOR_Y - 34, w: 34, h: 34, vx: 0, minX: 1200, maxX: 1234, alive: true, shotCooldown: 0.6 },
      { x: 2200, y: FLOOR_Y - 34, w: 34, h: 34, vx: 70, minX: 2100, maxX: 2400, alive: true, shotCooldown: 0.8 },
      { x: 3000, y: FLOOR_Y - 34, w: 34, h: 34, vx: -90, minX: 2800, maxX: 3200, alive: true, shotCooldown: 0.7 },
    ];
    state.weaponPickups = [
      { x: 550, y: 220, w: 26, h: 20, collected: false },
    ];
  } else if (state.level === 4) {
    state.worldWidth = 4800;
    state.goal.x = 4650;
    state.solids = [
      { x: 0, y: FLOOR_Y, w: 600, h: 100 },
      { x: 800, y: FLOOR_Y, w: 300, h: 100 },
      { x: 1300, y: FLOOR_Y, w: 200, h: 100 },
      { x: 1700, y: FLOOR_Y, w: 600, h: 100 },
      { x: 2500, y: FLOOR_Y, w: 400, h: 100 },
      { x: 3100, y: FLOOR_Y, w: 300, h: 100 },
      { x: 3600, y: FLOOR_Y, w: 1300, h: 100 },
      { x: 300, y: 380, w: 80, h: 18 },
      { x: 650, y: 280, w: 80, h: 18 },
      { x: 1150, y: 320, w: 80, h: 18 },
      { x: 1550, y: 220, w: 80, h: 18 },
      { x: 1900, y: 360, w: 80, h: 18 },
      { x: 2350, y: 280, w: 80, h: 18 },
      { x: 2950, y: 340, w: 80, h: 18 },
      { x: 3450, y: 260, w: 80, h: 18 },
      { x: 3900, y: 320, w: 80, h: 18 },
      { x: 4200, y: 240, w: 80, h: 18 },
    ];
    state.coins = [
      { x: 340, y: 340, r: 10, collected: false },
      { x: 690, y: 240, r: 10, collected: false },
      { x: 950, y: FLOOR_Y - 40, r: 10, collected: false },
      { x: 1190, y: 280, r: 10, collected: false },
      { x: 1400, y: FLOOR_Y - 40, r: 10, collected: false },
      { x: 1590, y: 180, r: 10, collected: false },
      { x: 1940, y: 320, r: 10, collected: false },
      { x: 2390, y: 240, r: 10, collected: false },
      { x: 2700, y: FLOOR_Y - 40, r: 10, collected: false },
      { x: 2990, y: 300, r: 10, collected: false },
      { x: 3250, y: FLOOR_Y - 40, r: 10, collected: false },
      { x: 3490, y: 220, r: 10, collected: false },
      { x: 3940, y: 280, r: 10, collected: false },
      { x: 4240, y: 200, r: 10, collected: false },
    ];
    state.enemies = [
      { x: 400, y: FLOOR_Y - 34, w: 34, h: 34, vx: 0, minX: 400, maxX: 434, alive: true, shotCooldown: 0.5 },
      { x: 900, y: FLOOR_Y - 34, w: 34, h: 34, vx: -100, minX: 800, maxX: 1050, alive: true, shotCooldown: 0.6 },
      { x: 1800, y: FLOOR_Y - 34, w: 34, h: 34, vx: 80, minX: 1700, maxX: 2200, alive: true, shotCooldown: 0.5 },
      { x: 2000, y: FLOOR_Y - 34, w: 34, h: 34, vx: -80, minX: 1700, maxX: 2200, alive: true, shotCooldown: 0.5 },
      { x: 2600, y: FLOOR_Y - 34, w: 34, h: 34, vx: 120, minX: 2500, maxX: 2800, alive: true, shotCooldown: 0.4 },
      { x: 3800, y: FLOOR_Y - 34, w: 34, h: 34, vx: -110, minX: 3600, maxX: 4400, alive: true, shotCooldown: 0.4 },
      { x: 4100, y: FLOOR_Y - 34, w: 34, h: 34, vx: 110, minX: 3700, maxX: 4500, alive: true, shotCooldown: 0.4 },
    ];
    state.weaponPickups = [
      { x: 340, y: 320, w: 26, h: 20, collected: false },
      { x: 2390, y: 200, w: 26, h: 20, collected: false },
    ];
  }

  state.totalCoins = state.coins.length;
}"""

R4 = """function resetGame() {
  state.mode = "playing";
  state.score = 0;
  state.coinsCollected = 0;
  state.player.x = 80;
  state.player.y = FLOOR_Y - state.player.h;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = false;
  state.player.coyoteTime = 0;
  state.player.facing = 1;
  state.hasLaser = false;
  state.shotCooldown = 0;
  createWorld();
  state.playerProjectiles = [];
  state.enemyProjectiles = [];
  updateCamera();
}"""
N4 = """function resetGame(fullReset = false) {
  if (fullReset) {
    state.score = 0;
    state.level = 1;
    state.lives = 3;
    state.hasLaser = false;
  }
  state.mode = "playing";
  state.coinsCollected = 0;
  state.player.x = 80;
  state.player.y = FLOOR_Y - state.player.h;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = false;
  state.player.coyoteTime = 0;
  state.player.facing = 1;
  state.shotCooldown = 0;
  createWorld();
  state.playerProjectiles = [];
  state.enemyProjectiles = [];
  updateCamera();
}"""

R5 = """      state.score += 150;
    } else {
      state.mode = "lost";
    }
  }
}"""
N5 = """      state.score += 150;
    } else {
      killPlayer();
    }
  }
}"""

R6 = """  if (state.player.y > VIEW_HEIGHT + 180) {
    state.mode = "lost";
  }"""
N6 = """  if (state.player.y > VIEW_HEIGHT + 180) {
    killPlayer();
  }"""

R7 = """function updateGoal() {
  const goalHitbox = {
    x: state.goal.x - 24,
    y: state.goal.y,
    w: state.goal.w + 48,
    h: state.goal.h,
  };
  if (intersectAabb(state.player, goalHitbox)) {
    state.mode = "won";
    state.score += 500;
  }
}"""
N7 = """function updateGoal() {
  const goalHitbox = {
    x: state.goal.x - 24,
    y: state.goal.y,
    w: state.goal.w + 48,
    h: state.goal.h,
  };
  if (intersectAabb(state.player, goalHitbox)) {
    if (state.level < state.maxLevel) {
      state.mode = "level_complete";
      state.score += 500 * state.level;
    } else {
      state.mode = "won";
      state.score += 5000;
    }
  }
}"""

R8 = """    if (intersectAabb(projectile, state.player)) {
      state.mode = "lost";
      continue;
    }"""
N8 = """    if (intersectAabb(projectile, state.player)) {
      killPlayer();
      continue;
    }"""

R9 = """function drawHud() {
  ctx.fillStyle = "rgba(10, 6, 26, 0.7)";
  ctx.beginPath();
  ctx.roundRect(16, 14, 230, 80, 8);
  ctx.fill();

  ctx.fillStyle = "#00d4ff";
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.fillText(`SCORE: ${String(state.score).padStart(6, '0')}`, 32, 44);

  const weaponLabel = state.hasLaser ? "-- LASER ACTIVE --" : "FIND WEAPON";
  ctx.fillStyle = state.hasLaser ? "#ff00ff" : "#888";
  ctx.font = "bold 16px 'Courier New', monospace";
  ctx.fillText(weaponLabel, 32, 74);

  ctx.fillStyle = "rgba(10, 6, 26, 0.7)";
  ctx.beginPath();
  ctx.roundRect(VIEW_WIDTH - 210, 14, 190, 48, 8);
  ctx.fill();

  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.fillText(`COINS: ${state.coinsCollected}/${state.totalCoins}`, VIEW_WIDTH - 194, 44);
}"""
N9 = """function drawHud() {
  ctx.fillStyle = "rgba(10, 6, 26, 0.7)";
  ctx.beginPath();
  ctx.roundRect(16, 14, 280, 120, 8);
  ctx.fill();

  ctx.fillStyle = "#00d4ff";
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.fillText(`SCORE: ${String(state.score).padStart(6, '0')}`, 32, 44);
  
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`LEVEL: ${state.level}/${state.maxLevel}`, 32, 74);

  ctx.fillStyle = "#ff003c";
  ctx.fillText(`LIVES: ${state.lives}`, 170, 74);

  const weaponLabel = state.hasLaser ? "-- LASER ACTIVE --" : "FIND WEAPON";
  ctx.fillStyle = state.hasLaser ? "#ff00ff" : "#888";
  ctx.font = "bold 16px 'Courier New', monospace";
  ctx.fillText(weaponLabel, 32, 110);

  ctx.fillStyle = "rgba(10, 6, 26, 0.7)";
  ctx.beginPath();
  ctx.roundRect(VIEW_WIDTH - 210, 14, 190, 48, 8);
  ctx.fill();

  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.fillText(`COINS: ${state.coinsCollected}/${state.totalCoins}`, VIEW_WIDTH - 194, 44);
}"""

R10 = """function render() {
  drawSky();
  drawWorld();
  drawHud();

  if (state.mode === "start") {
    drawOverlay(
      "CYBER SPRINT",
      "Arrow keys = RUN | Space = JUMP",
      "PRESS ENTER TO INITIALIZE"
    );
  } else if (state.mode === "won") {
    drawOverlay("SYSTEM HACKED", `FINAL SCORE: ${String(state.score).padStart(6, '0')}`, "PRESS ENTER TO DEPLOY AGAIN");
  } else if (state.mode === "lost") {
    drawOverlay("CRITICAL FAILURE", `FINAL SCORE: ${String(state.score).padStart(6, '0')}`, "PRESS ENTER TO REBOOT INCIDENT");
  }
}"""
N10 = """function render() {
  drawSky();
  drawWorld();
  drawHud();

  if (state.mode === "start") {
    drawOverlay(
      "CYBER SPRINT",
      "Arrow keys = RUN | Space = JUMP",
      "PRESS ENTER TO INITIALIZE"
    );
  } else if (state.mode === "won") {
    drawOverlay("SYSTEM HACKED", `FINAL SCORE: ${String(state.score).padStart(6, '0')}`, "PRESS ENTER TO DEPLOY AGAIN");
  } else if (state.mode === "lost") {
    drawOverlay("CRITICAL FAILURE", `FINAL SCORE: ${String(state.score).padStart(6, '0')}`, "PRESS ENTER TO REBOOT INCIDENT");
  } else if (state.mode === "died") {
    drawOverlay("LIVES LOST", `LIVES REMAINING: ${state.lives}`, "PRESS ENTER TO RETRY LEVEL");
  } else if (state.mode === "level_complete") {
    drawOverlay(`LEVEL ${state.level} COMPLETE`, `SCORE: ${String(state.score).padStart(6, '0')}`, "PRESS ENTER TO CONTINUE");
  }
}"""

R11 = """function onJumpPressed() {
  if (state.mode === "start" || state.mode === "won" || state.mode === "lost") {
    return;
  }"""
N11 = """function onJumpPressed() {
  if (state.mode === "start" || state.mode === "won" || state.mode === "lost" || state.mode === "died" || state.mode === "level_complete") {
    return;
  }"""

R12 = """  if (event.code === "Enter" && state.mode !== "playing") {
    resetGame();
  }"""
N12 = """  if (event.code === "Enter" && state.mode !== "playing") {
    if (state.mode === "start" || state.mode === "lost" || state.mode === "won") {
      resetGame(true);
    } else if (state.mode === "died") {
      resetGame(false);
    } else if (state.mode === "level_complete") {
      state.level++;
      resetGame(false);
    }
  }"""

R13 = """    score: state.score,
    coinsCollected: state.coinsCollected,
    totalCoins: state.totalCoins,
  };"""
N13 = """    score: state.score,
    level: state.level,
    lives: state.lives,
    coinsCollected: state.coinsCollected,
    totalCoins: state.totalCoins,
  };"""

R14 = """const _originalOnJumpPressed = onJumpPressed;
onJumpPressed = function () {
  const wasOnGround = state.player.onGround || state.player.coyoteTime > 0;
  _originalOnJumpPressed();
  if (wasOnGround && (state.mode !== "start" && state.mode !== "won" && state.mode !== "lost")) {
    sfxJump();
  }
}"""
N14 = """const _originalOnJumpPressed = onJumpPressed;
onJumpPressed = function () {
  const wasOnGround = state.player.onGround || state.player.coyoteTime > 0;
  _originalOnJumpPressed();
  if (wasOnGround && state.mode === "playing") {
    sfxJump();
  }
}"""

for target in TARGETS:
    with open(target, 'r') as f:
        content = f.read()

    replacements = [
        (R1, N1), (R2, N2), (R3, N3), (R4, N4), 
        (R5, N5), (R6, N6), (R7, N7), (R8, N8), 
        (R9, N9), (R10, N10), (R11, N11), (R12, N12), 
        (R13, N13), (R14, N14)
    ]

    for i, (r, n) in enumerate(replacements):
        if r not in content:
            print(f"Warning: R{i+1} not found in {target}")
        content = content.replace(r, n)

    with open(target, 'w') as f:
        f.write(content)

print("Patching complete.")
