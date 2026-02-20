const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const IS_AUTOMATED_RUN = typeof window.__vt_pending !== "undefined";

const VIEW_WIDTH = canvas.width;
const VIEW_HEIGHT = canvas.height;
const FLOOR_Y = 470;
const GRAVITY = 1900;
const PLAYER_SPEED = 300;
const JUMP_SPEED = 820;
const PLAYER_SHOT_SPEED = 760;
const PLAYER_SHOT_COOLDOWN = 0.18;
const PLAYER_SHOT_LIFETIME = 0.9;
const ENEMY_SHOT_SPEED = 320;
const ENEMY_SHOT_COOLDOWN = 1.25;
const ENEMY_SHOT_LIFETIME = 2.1;
const ENEMY_AGGRO_RANGE = 560;
const FIXED_DT = 1 / 60;

const state = {
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
  input: {
    left: false,
    right: false,
  },
  player: {
    x: 80,
    y: FLOOR_Y - 48,
    w: 36,
    h: 48,
    vx: 0,
    vy: 0,
    onGround: false,
    coyoteTime: 0,
    facing: 1,
  },
  hasLaser: false,
  shotCooldown: 0,
  goal: {
    x: 3050,
    y: FLOOR_Y - 160,
    w: 24,
    h: 160,
  },
  solids: [],
  coins: [],
  weaponPickups: [],
  enemies: [],
  playerProjectiles: [],
  enemyProjectiles: [],
};

function killPlayer() {
  state.lives -= 1;
  if (state.lives > 0) {
    state.mode = "died";
  } else {
    state.mode = "lost";
  }
}

function createWorld() {
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
}

function resetGame(fullReset = false) {
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
}

function intersectAabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function projectileHitsSolid(projectile) {
  for (const solid of state.solids) {
    if (intersectAabb(projectile, solid)) {
      return true;
    }
  }
  return false;
}

function collectCoins() {
  for (const coin of state.coins) {
    if (coin.collected) continue;
    const dx = state.player.x + state.player.w / 2 - coin.x;
    const dy = state.player.y + state.player.h / 2 - coin.y;
    if (dx * dx + dy * dy <= (coin.r + 16) * (coin.r + 16)) {
      coin.collected = true;
      state.coinsCollected += 1;
      state.score += 100;
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.vx * dt;
    if (enemy.x <= enemy.minX) {
      enemy.x = enemy.minX;
      enemy.vx = Math.abs(enemy.vx);
    } else if (enemy.x + enemy.w >= enemy.maxX) {
      enemy.x = enemy.maxX - enemy.w;
      enemy.vx = -Math.abs(enemy.vx);
    }

    enemy.shotCooldown = Math.max(0, enemy.shotCooldown - dt);
    const enemyCenterX = enemy.x + enemy.w / 2;
    const enemyCenterY = enemy.y + enemy.h / 2;
    const playerCenterX = state.player.x + state.player.w / 2;
    const playerCenterY = state.player.y + state.player.h / 2;
    const dx = playerCenterX - enemyCenterX;
    const dy = playerCenterY - enemyCenterY;
    if (enemy.shotCooldown <= 0 && Math.abs(dx) < ENEMY_AGGRO_RANGE && Math.abs(dy) < 120) {
      enemy.shotCooldown = ENEMY_SHOT_COOLDOWN;
      state.enemyProjectiles.push({
        x: enemyCenterX - 6,
        y: enemyCenterY - 3,
        w: 12,
        h: 6,
        vx: Math.sign(dx || 1) * ENEMY_SHOT_SPEED,
        ttl: ENEMY_SHOT_LIFETIME,
      });
    }

    if (!intersectAabb(state.player, enemy)) continue;
    const playerBottom = state.player.y + state.player.h;
    const overlapFromTop = playerBottom - enemy.y;
    const stomped = state.player.vy >= -40 && overlapFromTop > 0 && overlapFromTop < 26 && state.player.y < enemy.y;
    if (stomped) {
      enemy.alive = false;
      state.player.vy = -430;
      state.score += 150;
    } else {
      killPlayer();
    }
  }
}

function resolveHorizontal() {
  for (const solid of state.solids) {
    if (!intersectAabb(state.player, solid)) continue;
    if (state.player.vx > 0) {
      state.player.x = solid.x - state.player.w;
    } else if (state.player.vx < 0) {
      state.player.x = solid.x + solid.w;
    }
    state.player.vx = 0;
  }
}

function resolveVertical() {
  state.player.onGround = false;
  for (const solid of state.solids) {
    if (!intersectAabb(state.player, solid)) continue;
    if (state.player.vy > 0) {
      state.player.y = solid.y - state.player.h;
      state.player.vy = 0;
      state.player.onGround = true;
    } else if (state.player.vy < 0) {
      state.player.y = solid.y + solid.h;
      state.player.vy = 0;
    }
  }
}

function updatePlayer(dt) {
  const axis = (state.input.right ? 1 : 0) - (state.input.left ? 1 : 0);
  state.player.vx = axis * PLAYER_SPEED;
  if (axis !== 0) state.player.facing = Math.sign(axis);
  state.player.coyoteTime = state.player.onGround ? 0.12 : Math.max(0, state.player.coyoteTime - dt);

  state.player.vy += GRAVITY * dt;

  state.player.x += state.player.vx * dt;
  state.player.x = Math.max(0, Math.min(state.worldWidth - state.player.w, state.player.x));
  resolveHorizontal();

  state.player.y += state.player.vy * dt;
  resolveVertical();

  if (state.player.y > VIEW_HEIGHT + 180) {
    killPlayer();
  }

  collectCoins();
  collectWeaponPickups();
  state.shotCooldown = Math.max(0, state.shotCooldown - dt);
}

function collectWeaponPickups() {
  for (const pickup of state.weaponPickups) {
    if (pickup.collected) continue;
    if (intersectAabb(state.player, pickup)) {
      pickup.collected = true;
      state.hasLaser = true;
      state.score += 200;
    }
  }
}

function updateCamera() {
  const target = state.player.x + state.player.w / 2 - VIEW_WIDTH / 2;
  state.cameraX = Math.max(0, Math.min(state.worldWidth - VIEW_WIDTH, target));
}

function updateGoal() {
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
}

function firePlayerLaser() {
  if (state.mode !== "playing" || !state.hasLaser || state.shotCooldown > 0) return;
  const dir = state.player.facing || 1;
  state.shotCooldown = PLAYER_SHOT_COOLDOWN;
  state.playerProjectiles.push({
    x: state.player.x + (dir > 0 ? state.player.w - 2 : -14),
    y: state.player.y + 18,
    w: 14,
    h: 6,
    vx: dir * PLAYER_SHOT_SPEED,
    ttl: PLAYER_SHOT_LIFETIME,
  });
}

function updateProjectiles(dt) {
  const nextPlayerProjectiles = [];
  for (const projectile of state.playerProjectiles) {
    projectile.x += projectile.vx * dt;
    projectile.ttl -= dt;
    if (projectile.ttl <= 0) continue;
    if (projectile.x + projectile.w < 0 || projectile.x > state.worldWidth) continue;
    if (projectileHitsSolid(projectile)) continue;

    let hitEnemy = false;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      if (!intersectAabb(projectile, enemy)) continue;
      enemy.alive = false;
      state.score += 150;
      hitEnemy = true;
      break;
    }
    if (hitEnemy) continue;
    nextPlayerProjectiles.push(projectile);
  }
  state.playerProjectiles = nextPlayerProjectiles;

  const nextEnemyProjectiles = [];
  for (const projectile of state.enemyProjectiles) {
    projectile.x += projectile.vx * dt;
    projectile.ttl -= dt;
    if (projectile.ttl <= 0) continue;
    if (projectile.x + projectile.w < 0 || projectile.x > state.worldWidth) continue;
    if (projectileHitsSolid(projectile)) continue;
    if (intersectAabb(projectile, state.player)) {
      killPlayer();
      continue;
    }
    nextEnemyProjectiles.push(projectile);
  }
  state.enemyProjectiles = nextEnemyProjectiles;
}

function update(dt) {
  if (state.mode !== "playing") return;

  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateGoal();
  updateCamera();
}

function drawSky() {
  const time = performance.now() / 1000;
  // Parallax background
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  grad.addColorStop(0, "#0b0c2a");
  grad.addColorStop(0.4, "#20184a");
  grad.addColorStop(1, "#5b245e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  // Stars
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  for (let i = 0; i < 60; i++) {
    const x = ((i * 137) - state.cameraX * 0.05) % (VIEW_WIDTH + 20) - 10;
    const y = ((i * 93) % (VIEW_HEIGHT * 0.7));
    const size = (i % 3) + 1;
    const flicker = Math.sin(time * 3 + i) * 0.5 + 0.5;
    ctx.globalAlpha = 0.3 + flicker * 0.7;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1.0;

  // Background mountains
  ctx.fillStyle = "#160d2e";
  ctx.beginPath();
  for (let x = 0; x <= VIEW_WIDTH + 200; x += 100) {
    const px = x - (state.cameraX * 0.15) % 200;
    const height = 150 + Math.sin(x * 0.01) * 80;
    ctx.lineTo(px, VIEW_HEIGHT - height);
  }
  ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
  ctx.lineTo(0, VIEW_HEIGHT);
  ctx.fill();
}

function drawWorld() {
  const time = performance.now() / 1000;
  ctx.save();
  ctx.translate(-state.cameraX, 0);

  // Draw solids (Platforms)
  for (const solid of state.solids) {
    if (solid.h > 40) {
      // Ground
      ctx.fillStyle = "#140e29"; // Deep purple-black dirt
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
      ctx.fillStyle = "#2c1c4f"; // Dirt accent
      for (let i = 0; i < solid.w; i += 40) {
        ctx.fillRect(solid.x + i, solid.y + 10, 20, solid.h - 10);
      }
      ctx.fillStyle = "#00d4ff"; // Neon cyan grass/trim
      ctx.fillRect(solid.x, solid.y, solid.w, 8);
      ctx.fillStyle = "#ffffff"; // Outline highlight
      ctx.fillRect(solid.x, solid.y, solid.w, 2);
    } else {
      // Floating platforms
      ctx.fillStyle = "#231846";
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
      // Sci-fi ridges
      ctx.fillStyle = "#432a76";
      for (let i = 4; i < solid.w - 10; i += 16) {
        ctx.fillRect(solid.x + i, solid.y + 4, 8, solid.h - 8);
      }
      ctx.fillStyle = "#00d4ff"; // Platform top glow
      ctx.fillRect(solid.x, solid.y, solid.w, 4);
    }
  }

  // Draw Coins
  for (const coin of state.coins) {
    if (coin.collected) continue;
    const bounceY = coin.y + Math.sin(time * 4 + coin.x) * 6;
    ctx.shadowColor = "#ffeb3b";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(coin.x, bounceY, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(coin.x - 3, bounceY - 3, coin.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Draw Enemies
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;

    ctx.shadowColor = "#ff003c";
    ctx.shadowBlur = 15;

    // Core body (floating robot)
    const hoverY = enemy.y + Math.sin(time * 5 + enemy.x) * 4;
    ctx.fillStyle = "#1a1525";
    ctx.beginPath();
    ctx.roundRect(enemy.x, hoverY, enemy.w, enemy.h, 6);
    ctx.fill();

    // Red glowing eye
    ctx.fillStyle = "#ff003c";
    ctx.fillRect(enemy.x + (enemy.vx > 0 ? 18 : 6), hoverY + 10, 10, 6);
    ctx.fillStyle = "#ffb3c6";
    ctx.fillRect(enemy.x + (enemy.vx > 0 ? 20 : 8), hoverY + 11, 4, 4);

    // Jet flame
    ctx.fillStyle = "#ff8800";
    ctx.beginPath();
    ctx.moveTo(enemy.x + 10, hoverY + enemy.h);
    ctx.lineTo(enemy.x + 24, hoverY + enemy.h);
    ctx.lineTo(enemy.x + 17, hoverY + enemy.h + 8 + Math.random() * 6);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  // Draw Weapon Pickups
  for (const pickup of state.weaponPickups) {
    if (pickup.collected) continue;
    const hoverY = pickup.y + Math.sin(time * 3) * 5;
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#0055ff";
    ctx.beginPath();
    ctx.roundRect(pickup.x, hoverY, pickup.w, pickup.h, 4);
    ctx.fill();

    ctx.fillStyle = "#00ffff";
    ctx.fillRect(pickup.x + 4, hoverY + 4, pickup.w - 8, pickup.h - 8);
    ctx.shadowBlur = 0;
  }

  // Draw Projectiles
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 10;
  for (const projectile of state.playerProjectiles) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(projectile.x, projectile.y, projectile.w, projectile.h);
    ctx.fillStyle = "#00d4ff";
    ctx.fillRect(projectile.x + (projectile.vx > 0 ? -4 : 4), projectile.y - 2, projectile.w, projectile.h + 4);
  }

  ctx.shadowColor = "#ff003c";
  for (const projectile of state.enemyProjectiles) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(projectile.x, projectile.y, projectile.w, projectile.h);
    ctx.fillStyle = "#ff003c";
    ctx.fillRect(projectile.x + (projectile.vx > 0 ? -4 : 4), projectile.y - 1, projectile.w, projectile.h + 2);
  }
  ctx.shadowBlur = 0;

  // Draw Player
  const p = state.player;
  const pSqueeze = p.vy < -100 ? 4 : (p.vy > 100 ? -4 : 0);

  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = state.hasLaser ? 10 : 0;

  // Body
  ctx.fillStyle = "#ffffff"; // Cyber-suit
  ctx.beginPath();
  ctx.roundRect(p.x + pSqueeze / 2, p.y - pSqueeze, p.w - pSqueeze, p.h + pSqueeze, 8);
  ctx.fill();

  // Visor
  ctx.fillStyle = "#00d4ff"; // Glowing cyan visor
  ctx.fillRect(p.x + (p.facing > 0 ? 18 : 6), p.y + 8 - pSqueeze / 2, 14, 8);

  // Backpack/Jetpack
  ctx.fillStyle = "#444";
  ctx.fillRect(p.x + (p.facing > 0 ? -6 : p.w), p.y + 12 - pSqueeze / 2, 6, 20);

  // Boost flame when jumping
  if (!p.onGround && p.vy < 0) {
    ctx.fillStyle = "#00d4ff";
    ctx.beginPath();
    ctx.moveTo(p.x + 8, p.y + p.h);
    ctx.lineTo(p.x + p.w - 8, p.y + p.h);
    ctx.lineTo(p.x + p.w / 2, p.y + p.h + 12 + Math.random() * 8);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Draw Goal
  ctx.shadowColor = "#ff00ff";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "rgba(255, 0, 255, 0.3)";
  ctx.fillRect(state.goal.x, state.goal.y, state.goal.w, state.goal.h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(state.goal.x + 8, state.goal.y, 8, state.goal.h);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawHud() {
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
}

function drawOverlay(title, subtitle, hint) {
  ctx.fillStyle = "rgba(5, 2, 12, 0.85)";
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const time = performance.now() / 1000;
  const pulse = Math.sin(time * 3) * 0.5 + 0.5;

  ctx.textAlign = "center";

  ctx.shadowColor = "#00d4ff";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px 'Courier New', monospace";
  ctx.fillText(title, VIEW_WIDTH / 2, 220);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ff00ff";
  ctx.font = "bold 28px 'Courier New', monospace";
  ctx.fillText(subtitle, VIEW_WIDTH / 2, 280);

  ctx.globalAlpha = 0.5 + pulse * 0.5;
  ctx.fillStyle = "#00d4ff";
  ctx.font = "20px 'Courier New', monospace";
  ctx.fillText(hint, VIEW_WIDTH / 2, 360);
  ctx.globalAlpha = 1.0;

  ctx.textAlign = "left";
}

function render() {
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
}

function onJumpPressed() {
  if (state.mode === "start" || state.mode === "won" || state.mode === "lost" || state.mode === "died" || state.mode === "level_complete") {
    return;
  }
  if (state.player.onGround || state.player.coyoteTime > 0) {
    state.player.vy = -JUMP_SPEED;
    state.player.onGround = false;
    state.player.coyoteTime = 0;
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen().catch(() => { });
  } else {
    document.exitFullscreen().catch(() => { });
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft") state.input.left = true;
  if (event.code === "ArrowRight") state.input.right = true;
  if (event.code === "Space") {
    event.preventDefault();
    onJumpPressed();
  }
  if (event.code === "KeyZ" || event.code === "KeyX" || event.code === "KeyA" || event.code === "KeyB") {
    event.preventDefault();
    firePlayerLaser();
  }
  if (event.code === "Enter" && state.mode !== "playing") {
    if (state.mode === "start" || state.mode === "lost" || state.mode === "won") {
      resetGame(true);
    } else if (state.mode === "died") {
      resetGame(false);
    } else if (state.mode === "level_complete") {
      state.level++;
      resetGame(false);
    }
  }
  if (event.code === "KeyF") {
    toggleFullscreen();
  }
  if (event.code === "Escape" && document.fullscreenElement) {
    document.exitFullscreen().catch(() => { });
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft") state.input.left = false;
  if (event.code === "ArrowRight") state.input.right = false;
});

window.addEventListener("resize", () => {
  render();
});

function gameLoop(timestamp) {
  const dt = Math.min(0.033, (timestamp - state.lastTimestamp) / 1000);
  state.lastTimestamp = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    update(FIXED_DT);
  }
  render();
};

window.render_game_to_text = () => {
  const payload = {
    mode: state.mode,
    coordinateSystem: "origin at top-left, +x right, +y down; units in canvas pixels",
    cameraX: Number(state.cameraX.toFixed(1)),
    world: {
      width: state.worldWidth,
      height: VIEW_HEIGHT,
      floorY: FLOOR_Y,
    },
    player: {
      x: Number(state.player.x.toFixed(1)),
      y: Number(state.player.y.toFixed(1)),
      vx: Number(state.player.vx.toFixed(1)),
      vy: Number(state.player.vy.toFixed(1)),
      onGround: state.player.onGround,
      w: state.player.w,
      h: state.player.h,
    },
    goal: {
      x: state.goal.x,
      y: state.goal.y,
    },
    enemies: state.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => ({
        x: Number(enemy.x.toFixed(1)),
        y: Number(enemy.y.toFixed(1)),
        w: enemy.w,
        h: enemy.h,
        vx: Number(enemy.vx.toFixed(1)),
        shotCooldown: Number(enemy.shotCooldown.toFixed(2)),
      })),
    weapon: {
      hasLaser: state.hasLaser,
      shotCooldown: Number(state.shotCooldown.toFixed(2)),
    },
    weaponPickups: state.weaponPickups.filter((pickup) => !pickup.collected).map((pickup) => ({
      x: pickup.x,
      y: pickup.y,
      w: pickup.w,
      h: pickup.h,
    })),
    playerProjectiles: state.playerProjectiles.map((projectile) => ({
      x: Number(projectile.x.toFixed(1)),
      y: Number(projectile.y.toFixed(1)),
      vx: Number(projectile.vx.toFixed(1)),
    })),
    enemyProjectiles: state.enemyProjectiles.map((projectile) => ({
      x: Number(projectile.x.toFixed(1)),
      y: Number(projectile.y.toFixed(1)),
      vx: Number(projectile.vx.toFixed(1)),
    })),
    coins: state.coins
      .filter((coin) => !coin.collected)
      .map((coin) => ({ x: coin.x, y: coin.y, r: coin.r })),
    score: state.score,
    level: state.level,
    lives: state.lives,
    coinsCollected: state.coinsCollected,
    totalCoins: state.totalCoins,
  };
  return JSON.stringify(payload);
};

// Simple Audio Engine
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol = 0.1, slideFreq = null) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slideFreq) {
    osc.frequency.exponentialRampToValueAtTime(slideFreq, audioCtx.currentTime + duration);
  }
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function sfxJump() {
  playTone(300, 'sine', 0.2, 0.1, 600);
}

function sfxCoin() {
  playTone(880, 'sine', 0.1, 0.1);
  setTimeout(() => playTone(1100, 'sine', 0.2, 0.1), 100);
}

function sfxLaser() {
  playTone(800, 'square', 0.15, 0.05, 100);
}

function sfxEnemyHit() {
  playTone(150, 'sawtooth', 0.3, 0.1, 50);
}

function sfxPowerup() {
  playTone(400, 'square', 0.1, 0.1, 600);
  setTimeout(() => playTone(600, 'square', 0.1, 0.1, 800), 100);
  setTimeout(() => playTone(800, 'square', 0.2, 0.1, 1200), 200);
}

function sfxStomp() {
  playTone(200, 'square', 0.15, 0.1, 100);
}

function sfxWin() {
  playTone(440, 'triangle', 0.2, 0.1);
  setTimeout(() => playTone(554, 'triangle', 0.2, 0.1), 200);
  setTimeout(() => playTone(659, 'triangle', 0.2, 0.1), 400);
  setTimeout(() => playTone(880, 'triangle', 0.6, 0.1), 600);
}

function sfxLose() {
  playTone(300, 'sawtooth', 0.3, 0.1, 200);
  setTimeout(() => playTone(250, 'sawtooth', 0.3, 0.1, 150), 300);
  setTimeout(() => playTone(200, 'sawtooth', 0.6, 0.1, 100), 600);
}

// Override original audio triggers
const _originalCollectCoins = collectCoins;
collectCoins = function () {
  const coinsBefore = state.coinsCollected;
  _originalCollectCoins();
  if (state.coinsCollected > coinsBefore) sfxCoin();
}

const _originalOnJumpPressed = onJumpPressed;
onJumpPressed = function () {
  const wasOnGround = state.player.onGround || state.player.coyoteTime > 0;
  _originalOnJumpPressed();
  if (wasOnGround && state.mode === "playing") {
    sfxJump();
  }
}

const _originalFirePlayerLaser = firePlayerLaser;
firePlayerLaser = function () {
  if (state.mode === "playing" && state.hasLaser && state.shotCooldown <= 0) {
    sfxLaser();
  }
  _originalFirePlayerLaser();
}

const _originalCollectWeaponPickups = collectWeaponPickups;
collectWeaponPickups = function () {
  const hasLaserBefore = state.hasLaser;
  _originalCollectWeaponPickups();
  if (!hasLaserBefore && state.hasLaser) sfxPowerup();
}

const _originalUpdateEnemies = updateEnemies;
updateEnemies = function (dt) {
  const enemiesAliveBefore = state.enemies.filter(e => e.alive).length;
  _originalUpdateEnemies(dt);
  const enemiesAliveAfter = state.enemies.filter(e => e.alive).length;
  if (enemiesAliveAfter < enemiesAliveBefore) {
    sfxStomp(); // We assume it's a stomp here, could be laser but we'll trigger laser hits in updateProjectiles
  }
}

const _originalUpdateProjectiles = updateProjectiles;
updateProjectiles = function (dt) {
  const enemiesAliveBefore = state.enemies.filter(e => e.alive).length;
  _originalUpdateProjectiles(dt);
  const enemiesAliveAfter = state.enemies.filter(e => e.alive).length;
  if (enemiesAliveAfter < enemiesAliveBefore) {
    sfxEnemyHit();
  }
}

const _originalUpdateGoal = updateGoal;
updateGoal = function () {
  const modeBefore = state.mode;
  _originalUpdateGoal();
  if (modeBefore !== "won" && state.mode === "won") sfxWin();
}

const _originalUpdatePlayer = updatePlayer;
updatePlayer = function (dt) {
  const modeBefore = state.mode;
  _originalUpdatePlayer(dt);
  if (modeBefore !== "lost" && state.mode === "lost") sfxLose();
}

// Ensure audio context resumes on first click/keypress
window.addEventListener("keydown", () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
});

createWorld();
render();
if (!IS_AUTOMATED_RUN) {
  requestAnimationFrame(gameLoop);
}
