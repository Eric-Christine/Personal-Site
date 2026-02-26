(function () {
  "use strict";

  const VIEW_WIDTH = 960;
  const VIEW_HEIGHT = 540;
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

  const instanceRegistry = new WeakMap();

  function initMarioSideScroller(targetCanvas) {
    const canvas =
      typeof targetCanvas === "string"
        ? document.querySelector(targetCanvas)
        : targetCanvas;

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    if (instanceRegistry.has(canvas)) {
      return instanceRegistry.get(canvas);
    }

    canvas.width = VIEW_WIDTH;
    canvas.height = VIEW_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const state = {
      mode: "start",
      score: 0,
      coinsCollected: 0,
      totalCoins: 0,
      worldWidth: 3200,
      cameraX: 0,
      lastTimestamp: performance.now(),
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

    let rafId = null;
    let inputEnabled = true;

    function createWorld() {
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
    }

    function resetGame() {
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
    }

    function intersectAabb(a, b) {
      return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      );
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
        if (coin.collected) {
          continue;
        }
        const dx = state.player.x + state.player.w / 2 - coin.x;
        const dy = state.player.y + state.player.h / 2 - coin.y;
        if (dx * dx + dy * dy <= (coin.r + 16) * (coin.r + 16)) {
          coin.collected = true;
          state.coinsCollected += 1;
          state.score += 100;
        }
      }
    }

    function collectWeaponPickups() {
      for (const pickup of state.weaponPickups) {
        if (pickup.collected) {
          continue;
        }
        if (intersectAabb(state.player, pickup)) {
          pickup.collected = true;
          state.hasLaser = true;
          state.score += 200;
        }
      }
    }

    function resolveHorizontal() {
      for (const solid of state.solids) {
        if (!intersectAabb(state.player, solid)) {
          continue;
        }
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
        if (!intersectAabb(state.player, solid)) {
          continue;
        }
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
      if (axis !== 0) {
        state.player.facing = Math.sign(axis);
      }
      state.player.coyoteTime = state.player.onGround
        ? 0.12
        : Math.max(0, state.player.coyoteTime - dt);

      state.player.vy += GRAVITY * dt;

      state.player.x += state.player.vx * dt;
      state.player.x = Math.max(0, Math.min(state.worldWidth - state.player.w, state.player.x));
      resolveHorizontal();

      state.player.y += state.player.vy * dt;
      resolveVertical();

      if (state.player.y > VIEW_HEIGHT + 180) {
        state.mode = "lost";
      }

      collectCoins();
      collectWeaponPickups();
      state.shotCooldown = Math.max(0, state.shotCooldown - dt);
    }

    function updateEnemies(dt) {
      for (const enemy of state.enemies) {
        if (!enemy.alive) {
          continue;
        }

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

        if (
          enemy.shotCooldown <= 0 &&
          Math.abs(dx) < ENEMY_AGGRO_RANGE &&
          Math.abs(dy) < 120
        ) {
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

        if (!intersectAabb(state.player, enemy)) {
          continue;
        }

        const playerBottom = state.player.y + state.player.h;
        const overlapFromTop = playerBottom - enemy.y;
        const stomped =
          state.player.vy >= -40 &&
          overlapFromTop > 0 &&
          overlapFromTop < 26 &&
          state.player.y < enemy.y;

        if (stomped) {
          enemy.alive = false;
          state.player.vy = -430;
          state.score += 150;
        } else {
          state.mode = "lost";
        }
      }
    }

    function updateGoal() {
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
    }

    function firePlayerLaser() {
      if (state.mode !== "playing" || !state.hasLaser || state.shotCooldown > 0) {
        return;
      }
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
        if (projectile.ttl <= 0) {
          continue;
        }
        if (projectile.x + projectile.w < 0 || projectile.x > state.worldWidth) {
          continue;
        }
        if (projectileHitsSolid(projectile)) {
          continue;
        }

        let hitEnemy = false;
        for (const enemy of state.enemies) {
          if (!enemy.alive) {
            continue;
          }
          if (!intersectAabb(projectile, enemy)) {
            continue;
          }
          enemy.alive = false;
          state.score += 150;
          hitEnemy = true;
          break;
        }

        if (!hitEnemy) {
          nextPlayerProjectiles.push(projectile);
        }
      }
      state.playerProjectiles = nextPlayerProjectiles;

      const nextEnemyProjectiles = [];
      for (const projectile of state.enemyProjectiles) {
        projectile.x += projectile.vx * dt;
        projectile.ttl -= dt;
        if (projectile.ttl <= 0) {
          continue;
        }
        if (projectile.x + projectile.w < 0 || projectile.x > state.worldWidth) {
          continue;
        }
        if (projectileHitsSolid(projectile)) {
          continue;
        }
        if (intersectAabb(projectile, state.player)) {
          state.mode = "lost";
          continue;
        }
        nextEnemyProjectiles.push(projectile);
      }
      state.enemyProjectiles = nextEnemyProjectiles;
    }

    function updateCamera() {
      const target = state.player.x + state.player.w / 2 - VIEW_WIDTH / 2;
      state.cameraX = Math.max(0, Math.min(state.worldWidth - VIEW_WIDTH, target));
    }

    function update(dt) {
      if (state.mode !== "playing") {
        return;
      }
      updatePlayer(dt);
      updateEnemies(dt);
      updateProjectiles(dt);
      updateGoal();
      updateCamera();
    }

    function drawSky() {
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
      grad.addColorStop(0, "#79cfff");
      grad.addColorStop(1, "#f4fdff");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      for (let i = 0; i < 8; i += 1) {
        const x = ((i * 240 - state.cameraX * 0.2) % (VIEW_WIDTH + 260)) - 120;
        const y = 60 + (i % 3) * 45;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.arc(x + 20, y - 10, 24, 0, Math.PI * 2);
        ctx.arc(x + 44, y, 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawWorld() {
      ctx.save();
      ctx.translate(-state.cameraX, 0);

      ctx.fillStyle = "#67cf5f";
      for (const solid of state.solids) {
        if (solid.h > 40) {
          ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
          ctx.fillStyle = "#885e38";
          ctx.fillRect(solid.x, solid.y + 22, solid.w, solid.h - 22);
          ctx.fillStyle = "#67cf5f";
        } else {
          ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
          ctx.fillStyle = "#885e38";
          ctx.fillRect(solid.x + 6, solid.y + 6, solid.w - 12, solid.h - 6);
          ctx.fillStyle = "#67cf5f";
        }
      }

      for (const coin of state.coins) {
        if (coin.collected) {
          continue;
        }
        ctx.fillStyle = "#ffc930";
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e29a00";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      for (const enemy of state.enemies) {
        if (!enemy.alive) {
          continue;
        }
        ctx.fillStyle = "#ad3a2a";
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
        ctx.fillStyle = "#101010";
        ctx.fillRect(enemy.x + 8, enemy.y + 11, 6, 6);
        ctx.fillRect(enemy.x + 20, enemy.y + 11, 6, 6);
      }

      for (const pickup of state.weaponPickups) {
        if (pickup.collected) {
          continue;
        }
        ctx.fillStyle = "#66e6ff";
        ctx.fillRect(pickup.x, pickup.y, pickup.w, pickup.h);
        ctx.fillStyle = "#0a5472";
        ctx.fillRect(pickup.x + 4, pickup.y + 5, pickup.w - 8, 4);
        ctx.fillRect(pickup.x + pickup.w - 6, pickup.y + 8, 6, 4);
      }

      ctx.fillStyle = "#42f5ff";
      for (const projectile of state.playerProjectiles) {
        ctx.fillRect(projectile.x, projectile.y, projectile.w, projectile.h);
      }

      ctx.fillStyle = "#ff704a";
      for (const projectile of state.enemyProjectiles) {
        ctx.fillRect(projectile.x, projectile.y, projectile.w, projectile.h);
      }

      const p = state.player;
      ctx.fillStyle = "#d7321f";
      ctx.fillRect(p.x, p.y + 6, p.w, p.h - 6);
      ctx.fillStyle = "#f4d3b8";
      ctx.fillRect(p.x + (p.facing > 0 ? 20 : 8), p.y + 12, 10, 10);
      ctx.fillStyle = "#b51300";
      ctx.fillRect(p.x + 2, p.y, p.w - 4, 10);
      ctx.fillStyle = "#2250c9";
      ctx.fillRect(p.x + 5, p.y + 34, p.w - 10, 12);

      ctx.fillStyle = "#d8d8d8";
      ctx.fillRect(state.goal.x, state.goal.y, state.goal.w, state.goal.h);
      ctx.fillStyle = "#00b24f";
      ctx.beginPath();
      ctx.moveTo(state.goal.x + state.goal.w, state.goal.y + 6);
      ctx.lineTo(state.goal.x + state.goal.w + 58, state.goal.y + 30);
      ctx.lineTo(state.goal.x + state.goal.w, state.goal.y + 56);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawHud() {
      ctx.fillStyle = "rgba(18, 32, 60, 0.8)";
      ctx.fillRect(16, 14, 250, 48);
      ctx.fillStyle = "#f8fbff";
      ctx.font = "20px Trebuchet MS";
      ctx.fillText("Score: " + state.score, 28, 45);

      ctx.fillStyle = "rgba(18, 32, 60, 0.8)";
      ctx.fillRect(VIEW_WIDTH - 190, 14, 170, 48);
      ctx.fillStyle = "#f8fbff";
      ctx.fillText(
        "Coins: " + state.coinsCollected + "/" + state.totalCoins,
        VIEW_WIDTH - 178,
        45
      );

      ctx.fillStyle = "rgba(18, 32, 60, 0.8)";
      ctx.fillRect(16, 70, 300, 40);
      ctx.fillStyle = state.hasLaser ? "#8bffdf" : "#f8fbff";
      const weaponLabel = state.hasLaser ? "Fireball: Equipped (Z/X)" : "Fireball: Find pickup";
      ctx.fillText(weaponLabel, 28, 98);
    }

    function drawOverlay(title, subtitle, hint) {
      ctx.fillStyle = "rgba(10, 19, 38, 0.55)";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "bold 54px Trebuchet MS";
      ctx.fillText(title, VIEW_WIDTH / 2, 190);
      ctx.font = "26px Trebuchet MS";
      ctx.fillText(subtitle, VIEW_WIDTH / 2, 250);
      ctx.font = "22px Trebuchet MS";
      ctx.fillText(hint, VIEW_WIDTH / 2, 318);
      ctx.textAlign = "left";
    }

    function render() {
      drawSky();
      drawWorld();
      drawHud();

      if (state.mode === "start") {
        drawOverlay(
          "Mario Secret Stage",
          "Arrow keys to run, Space to jump, collect fireball pickup",
          "Press Enter to start"
        );
      } else if (state.mode === "won") {
        drawOverlay("Course Cleared", "Final score: " + state.score, "Press Enter to play again");
      } else if (state.mode === "lost") {
        drawOverlay("Try Again", "Final score: " + state.score, "Press Enter to restart");
      }
    }

    function onJumpPressed() {
      if (state.mode === "start" || state.mode === "won" || state.mode === "lost") {
        return;
      }
      if (state.player.onGround || state.player.coyoteTime > 0) {
        state.player.vy = -JUMP_SPEED;
        state.player.onGround = false;
        state.player.coyoteTime = 0;
      }
    }

    function onKeyDown(event) {
      if (!inputEnabled) {
        return;
      }

      if (event.code === "ArrowLeft") {
        state.input.left = true;
      }

      if (event.code === "ArrowRight") {
        state.input.right = true;
      }

      if (event.code === "Space") {
        event.preventDefault();
        onJumpPressed();
      }

      if (
        event.code === "KeyZ" ||
        event.code === "KeyX" ||
        event.code === "KeyA" ||
        event.code === "KeyB"
      ) {
        event.preventDefault();
        firePlayerLaser();
      }

      if (event.code === "Enter" && state.mode !== "playing") {
        resetGame();
      }
    }

    function onKeyUp(event) {
      if (event.code === "ArrowLeft") {
        state.input.left = false;
      }
      if (event.code === "ArrowRight") {
        state.input.right = false;
      }
    }

    function releaseDirectionalInput() {
      state.input.left = false;
      state.input.right = false;
    }

    function gameLoop(timestamp) {
      const dt = Math.min(0.033, (timestamp - state.lastTimestamp) / 1000);
      state.lastTimestamp = timestamp;
      update(dt);
      render();
      rafId = requestAnimationFrame(gameLoop);
    }

    function advanceTime(ms) {
      const steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (let i = 0; i < steps; i += 1) {
        update(FIXED_DT);
      }
      render();
    }

    function renderGameToText() {
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
        weaponPickups: state.weaponPickups
          .filter((pickup) => !pickup.collected)
          .map((pickup) => ({
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
          .map((coin) => ({
            x: coin.x,
            y: coin.y,
            r: coin.r,
          })),
        score: state.score,
        coinsCollected: state.coinsCollected,
        totalCoins: state.totalCoins,
      };

      return JSON.stringify(payload);
    }

    function setInputEnabled(nextState) {
      inputEnabled = Boolean(nextState);
      if (!inputEnabled) {
        releaseDirectionalInput();
      }
    }

    function destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseDirectionalInput);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    createWorld();
    render();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseDirectionalInput);

    rafId = requestAnimationFrame(gameLoop);

    const controller = {
      canvas,
      destroy,
      resetGame,
      setInputEnabled,
      advanceTime,
      renderGameToText,
    };

    if (!window.render_game_to_text) {
      window.render_game_to_text = renderGameToText;
    }

    if (!window.advanceTime) {
      window.advanceTime = advanceTime;
    }

    instanceRegistry.set(canvas, controller);
    return controller;
  }

  window.initMarioSideScroller = initMarioSideScroller;
})();
