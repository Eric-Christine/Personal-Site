const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreSpan = document.getElementById('score');
const finalScoreSpan = document.getElementById('final-score');
const mobileControls = document.getElementById('mobile-controls');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// Logical game resolution
const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 600;

// --- Sound Engine (Web Audio API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    switch (type) {
        case 'jump':
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'stomp':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
        case 'shoot':
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'explosion':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 0.2);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        case 'pickup':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.1);
            osc.frequency.setValueAtTime(800, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
        case 'death':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
    }
}

// Physics constants
const GRAVITY = 1200;
const INITIAL_JUMP_SPEED = 700;
const PLAYER_SPEED = 300;
const TILT_SENSITIVITY = 15; // Speed multiplier for deviceOrientation gamma

// Game State
const state = {
    mode: 'start', // start, playing, gameover
    score: 0,
    maxAltitude: 0, // Used for score tracking and camera logic
    cameraY: 0,     // The bottom of the camera logic maps to the player moving UP
    lastTimestamp: 0,
    player: {
        x: VIEW_WIDTH / 2 - 18,
        y: VIEW_HEIGHT - 100, // Starts near the bottom of the screen
        w: 36,
        h: 48,
        vx: 0,
        vy: 0,
        facing: 1, // 1 for right, -1 for left
    },
    platforms: [],
    enemies: [],
    projectiles: [],
    weaponPickup: null, // Only one active pickup on screen at a time
    hasWeapon: false,
    lastFireTime: 0,
    enemySpeedScale: 1,
    input: {
        left: false,
        right: false,
        tilt: 0 // -1 to 1 based on tilt
    }
};

function resize() {
    // Always set canvas logical size to our view constants
    canvas.width = VIEW_WIDTH;
    canvas.height = VIEW_HEIGHT;
}
window.addEventListener('resize', resize);
resize();

// Platform Generator Helper
function createPlatform(x, y, type = "normal") {
    return {
        x: x,
        y: y,
        w: 60,
        h: 12,
        type: type // can add moving/breaking platforms later
    };
}

function initGame() {
    initAudio(); // Prompt users browser to allow audio
    state.mode = 'playing';
    state.score = 0;
    state.maxAltitude = 0;
    state.cameraY = 0;
    state.platforms = [];
    state.enemies = [];
    state.projectiles = [];
    state.weaponPickup = null;
    state.hasWeapon = false;
    state.lastFireTime = 0;
    state.enemySpeedScale = 1;

    // Reset Player
    state.player.x = VIEW_WIDTH / 2 - state.player.w / 2;
    state.player.y = VIEW_HEIGHT - 100;
    state.player.vx = 0;
    state.player.vy = -INITIAL_JUMP_SPEED;
    state.player.facing = 1;

    // Add initial base platform just under the player
    state.platforms.push(createPlatform(state.player.x - 10, state.player.y + state.player.h + 10));

    // Generate initial chunk of platforms
    let currentY = VIEW_HEIGHT - 100;
    for (let i = 0; i < 15; i++) {
        currentY -= (Math.random() * 60 + 40); // Gap between 40-100
        const x = Math.random() * (VIEW_WIDTH - 60);
        state.platforms.push(createPlatform(x, currentY));
    }

    // UI Updates
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    hud.classList.remove('hidden');
    mobileControls.classList.remove('hidden');
    updateScoreUI();

    state.lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    if (state.mode !== 'gameover') playSound('death');
    state.mode = 'gameover';
    hud.classList.add('hidden');
    mobileControls.classList.add('hidden');
    finalScoreSpan.innerText = Math.floor(state.maxAltitude / 10);
    gameOverScreen.classList.add('active');
}

function updateScoreUI() {
    scoreSpan.innerText = Math.floor(state.maxAltitude / 10);
}

// Input Event Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') state.input.left = true;
    if (e.code === 'ArrowRight') state.input.right = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') state.input.left = false;
    if (e.code === 'ArrowRight') state.input.right = false;
});

// Explicit Button Touch & Mouse Controls
const addTouchHandlers = (btn, isLeft) => {
    const startInput = (e) => {
        e.preventDefault();
        if (state.mode !== 'playing') return;
        if (isLeft) state.input.left = true;
        else state.input.right = true;
    };

    const endInput = (e) => {
        e.preventDefault();
        if (isLeft) state.input.left = false;
        else state.input.right = false;
    };

    // Touch events
    btn.addEventListener('touchstart', startInput, { passive: false });
    btn.addEventListener('touchend', endInput, { passive: false });
    btn.addEventListener('touchcancel', endInput, { passive: false });

    // Mouse events for desktop testing or devices with mouse
    btn.addEventListener('mousedown', startInput);
    btn.addEventListener('mouseup', endInput);
    btn.addEventListener('mouseleave', endInput);
};

addTouchHandlers(btnLeft, true);
addTouchHandlers(btnRight, false);

// Tilt Controls
window.addEventListener('deviceorientation', (e) => {
    // gamma is left-to-right tilt in degrees, where right is positive
    if (e.gamma !== null) {
        // clamp between -30 and 30
        let tilt = Math.max(-30, Math.min(30, e.gamma));
        // normalize to -1 to 1
        state.input.tilt = tilt / 30;
    }
});

// Button handlers
startBtn.addEventListener('click', () => {
    // Request Device Orientation permission if on iOS 13+
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response == 'granted') {
                    console.log('Tilt controls access granted');
                }
            })
            .catch(console.error);
    }
    initGame();
});

restartBtn.addEventListener('click', initGame);

function update(dt) {
    if (state.mode !== 'playing') return;

    // 1. Update horizontal velocity based on input (Keyboard overrides tilt)
    if (state.input.left) {
        state.player.vx = -PLAYER_SPEED;
        state.player.facing = -1;
    } else if (state.input.right) {
        state.player.vx = PLAYER_SPEED;
        state.player.facing = 1;
    } else if (state.input.tilt !== 0) {
        state.player.vx = state.input.tilt * PLAYER_SPEED;
        if (Math.abs(state.input.tilt) > 0.1) {
            state.player.facing = Math.sign(state.input.tilt);
        }
    } else {
        state.player.vx = 0; // Frictionless stop!
    }

    // 2. Physics & Position updating
    state.player.x += state.player.vx * dt;
    state.player.vy += GRAVITY * dt;
    state.player.y += state.player.vy * dt;

    // 3. Screen Wrap (Horizontal)
    if (state.player.x > VIEW_WIDTH) {
        state.player.x = -state.player.w;
    } else if (state.player.x + state.player.w < 0) {
        state.player.x = VIEW_WIDTH;
    }

    // 4. Camera & Score adjustments
    // Virtual altitude logic (y goes down, so smaller y = higher altitude)
    // If player goes above the middle of screen, move camera up!
    const screenMiddle = VIEW_HEIGHT / 2;
    if (state.player.y < state.cameraY + screenMiddle) {
        const diff = (state.cameraY + screenMiddle) - state.player.y;
        state.cameraY -= diff;
        // Update Score mapping 1px to ~0.1 score units
        if (-state.cameraY > state.maxAltitude) {
            state.maxAltitude = -state.cameraY;
            updateScoreUI();
        }
    }

    // 5. Collision Detection (Jumping on platforms)
    // Only collide if falling downwards
    if (state.player.vy > 0) {
        const pBottom = state.player.y + state.player.h;
        const pLeft = state.player.x;
        const pRight = state.player.x + state.player.w;

        for (const plat of state.platforms) {
            if (
                pBottom >= plat.y &&
                pBottom <= plat.y + 15 &&          // Tolerance for falling through
                pRight > plat.x &&                 // Overlap left edge
                pLeft < plat.x + plat.w            // Overlap right edge
            ) {
                // Bounce! Snap exactly on top.
                state.player.y = plat.y - state.player.h;
                state.player.vy = -INITIAL_JUMP_SPEED;
                playSound('jump');
                break;
            }
        }
    }

    // 5b. Update Enemies & Check Enemy Collision
    const pBox = { x: state.player.x, y: state.player.y, w: state.player.w, h: state.player.h };
    state.enemySpeedScale = 1 + (state.maxAltitude / 5000); // Speed scales up loosely based on altitude

    state.enemies.forEach(enemy => {
        // Move enemy along platform
        enemy.x += enemy.vx * state.enemySpeedScale * dt;
        if (enemy.x <= enemy.minX) {
            enemy.x = enemy.minX;
            enemy.vx *= -1;
        } else if (enemy.x + enemy.w >= enemy.maxX) {
            enemy.x = enemy.maxX - enemy.w;
            enemy.vx *= -1;
        }

        // Checking collision
        if (
            pBox.x < enemy.x + enemy.w &&
            pBox.x + pBox.w > enemy.x &&
            pBox.y < enemy.y + enemy.h &&
            pBox.y + pBox.h > enemy.y
        ) {
            const pBottom = pBox.y + pBox.h;

            // Hit from above: Stomp
            if (state.player.vy > 0 && pBottom - enemy.y < 20) {
                state.enemies.splice(state.enemies.indexOf(enemy), 1);
                state.player.vy = -INITIAL_JUMP_SPEED; // Bounce
                playSound('stomp');
            } else {
                // Hit from sides/bottom: Death
                gameOver();
            }
        }
    });

    // 5c. Update Weapon & Projectiles
    if (state.weaponPickup) {
        if (
            pBox.x < state.weaponPickup.x + state.weaponPickup.w &&
            pBox.x + pBox.w > state.weaponPickup.x &&
            pBox.y < state.weaponPickup.y + state.weaponPickup.h &&
            pBox.y + pBox.h > state.weaponPickup.y
        ) {
            state.hasWeapon = true;
            state.weaponPickup = null;
            playSound('pickup');
        }
    }

    if (state.hasWeapon && performance.now() - state.lastFireTime > 300) { // Auto-fire every 300ms
        state.lastFireTime = performance.now();
        state.projectiles.push({
            x: state.player.x + state.player.w / 2 - 4,
            y: state.player.y - 10,
            w: 8,
            h: 20,
            vy: -1000 // shoot straight up very fast
        });
    }

    state.projectiles.forEach((proj, pIndex) => {
        proj.y += proj.vy * dt;
        // Check enemy collisions
        let hitEnemy = false;
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            const e = state.enemies[i];
            if (
                proj.x < e.x + e.w &&
                proj.x + proj.w > e.x &&
                proj.y < e.y + e.h &&
                proj.y + proj.h > e.y
            ) {
                state.enemies.splice(i, 1);
                hitEnemy = true;
                break;
            }
        }
        if (hitEnemy) {
            proj.dead = true;
            playSound('explosion');
        }
    });

    // Clean up dead or offscreen projectiles
    state.projectiles = state.projectiles.filter(p => !p.dead && p.y > state.cameraY - VIEW_HEIGHT);

    // 6. World Generation & Cleanup
    // Remove platforms that fall out of the bottom of view
    state.platforms = state.platforms.filter(p => p.y < state.cameraY + VIEW_HEIGHT + 50);
    state.enemies = state.enemies.filter(e => e.y < state.cameraY + VIEW_HEIGHT + 50);
    if (state.weaponPickup && state.weaponPickup.y > state.cameraY + VIEW_HEIGHT + 50) {
        state.weaponPickup = null;
    }

    // Generate new platforms at the top
    const highestPlatform = state.platforms.reduce((highest, p) => p.y < highest.y ? p : highest, { y: Infinity });

    if (highestPlatform.y > state.cameraY - 100) {
        // Need to generate more platforms
        const nextY = highestPlatform.y - (Math.random() * 60 + 40); // Standard gap
        const nextX = Math.random() * (VIEW_WIDTH - 60);
        const plat = createPlatform(nextX, nextY);
        state.platforms.push(plat);

        // 15% chance to spawn an enemy on a platform
        if (Math.random() < 0.15) {
            state.enemies.push({
                x: nextX,
                y: nextY - 30, // Stand on top of platform
                w: 30,
                h: 30,
                minX: nextX,
                maxX: nextX + plat.w,
                vx: 80 * (Math.random() > 0.5 ? 1 : -1) // Base speed
            });
        }

        // 5% chance to spawn a weapon pickup if we don't have a weapon, and one isn't already spawned
        if (!state.hasWeapon && !state.weaponPickup && Math.random() < 0.05) {
            state.weaponPickup = {
                x: nextX + 15,
                y: nextY - 25,
                w: 20,
                h: 20
            };
        }
    }

    // 7. Death Check
    if (state.player.y > state.cameraY + VIEW_HEIGHT) {
        gameOver();
    }
}

function drawBackground() {
    const time = performance.now() / 1000;

    // Parallax stars
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let i = 0; i < 40; i++) {
        const x = (i * 137) % VIEW_WIDTH;
        const y = ((i * 93) - state.cameraY * 0.2) % (VIEW_HEIGHT + 20);
        // wrap around if y is negative
        const finalY = (y < 0) ? VIEW_HEIGHT + y : y;
        const size = (i % 3) + 1;
        const flicker = Math.sin(time * 3 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + flicker * 0.7;
        ctx.fillRect(x, finalY, size, size);
    }
    ctx.globalAlpha = 1.0;

    // Background mountains (scrolling slowly)
    ctx.fillStyle = "#160d2e";
    ctx.beginPath();
    const scaleY = 0.5;
    const loopWidthThreshold = 800;
    for (let x = 0; x <= VIEW_WIDTH + 200; x += 100) {
        const px = x;
        const height = 150 + Math.sin(x * 0.01) * 80;
        // Map mountain height based on camera scroll, moving them down as you go up
        const mappedBase = VIEW_HEIGHT + (state.cameraY * scaleY) % VIEW_HEIGHT;
        // To ensure they never fully disappear we duplicate
        ctx.lineTo(px, mappedBase - height);
    }
    ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
    ctx.lineTo(0, VIEW_HEIGHT);
    ctx.fill();
}

function drawWorld() {
    ctx.save();
    // Translate camera view
    ctx.translate(0, -state.cameraY);

    // Draw Platforms
    for (const plat of state.platforms) {
        // Base block
        ctx.fillStyle = "#231846";
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        // Sci-fi ridge
        ctx.fillStyle = "#432a76";
        for (let i = 4; i < plat.w - 4; i += 12) {
            ctx.fillRect(plat.x + i, plat.y + 2, 6, plat.h - 4);
        }
        // Top glow
        ctx.shadowColor = "#00d4ff";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#00d4ff";
        ctx.fillRect(plat.x, plat.y, plat.w, 3);
        ctx.shadowBlur = 0;
    }

    // Draw Enemies
    const time = performance.now() / 1000;
    for (const enemy of state.enemies) {
        const hoverY = enemy.y + Math.sin(time * 5 + enemy.x) * 4;
        ctx.fillStyle = "#1a1525";
        ctx.beginPath();
        ctx.roundRect(enemy.x, hoverY, enemy.w, enemy.h, 4);
        ctx.fill();

        // Red glowing eye
        ctx.shadowColor = "#ff003c";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#ff003c";
        const eyeOffsetX = enemy.vx > 0 ? 18 : 6;
        ctx.fillRect(enemy.x + eyeOffsetX, hoverY + 8, 8, 6);
        ctx.shadowBlur = 0;
    }

    // Draw Weapon Pickup
    if (state.weaponPickup) {
        const w = state.weaponPickup;
        const hoverY = w.y + Math.sin(time * 3) * 5;
        ctx.shadowColor = "#ff00ff";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#ff00ff";
        ctx.beginPath();
        ctx.arc(w.x + w.w / 2, hoverY + w.h / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(w.x + w.w / 2 - 2, hoverY + w.h / 2 - 4, 4, 8); // simple crosshair symbol
        ctx.fillRect(w.x + w.w / 2 - 4, hoverY + w.h / 2 - 2, 8, 4);
        ctx.shadowBlur = 0;
    }

    // Draw Projectiles
    for (const proj of state.projectiles) {
        ctx.shadowColor = "#00d4ff";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(proj.x, proj.y, proj.w, proj.h);
        ctx.shadowBlur = 0;
    }

    // Draw Player
    const p = state.player;
    const pSqueeze = p.vy < -100 ? 2 : (p.vy > 100 ? -2 : 0);

    // Body
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(p.x + pSqueeze / 2, p.y - pSqueeze, p.w - pSqueeze, p.h + pSqueeze, 8);
    ctx.fill();

    // Visor
    ctx.shadowColor = "#00d4ff";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#00d4ff";
    ctx.fillRect(p.x + (p.facing > 0 ? 18 : 6), p.y + 8 - pSqueeze / 2, 14, 8);
    ctx.shadowBlur = 0;

    // Backpack
    ctx.fillStyle = "#444";
    ctx.fillRect(p.x + (p.facing > 0 ? -6 : p.w), p.y + 12 - pSqueeze / 2, 6, 20);

    // Boost Flame (when going up)
    if (p.vy < 0) {
        ctx.shadowColor = "#00d4ff";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#00d4ff";
        ctx.beginPath();
        ctx.moveTo(p.x + 8, p.y + p.h);
        ctx.lineTo(p.x + p.w - 8, p.y + p.h);
        ctx.lineTo(p.x + p.w / 2, p.y + p.h + 12 + Math.random() * 8);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function render() {
    // Clear canvas using background gradients from CSS is possible, 
    // but let's clear it explicitly here to prevent ghosting
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    drawBackground();

    if (state.mode === 'playing') {
        drawWorld();
    }
}

function gameLoop(timestamp) {
    if (state.mode !== 'playing') return;

    // Max dt cap to avoid huge physics jumps if lagging
    let dt = (timestamp - state.lastTimestamp) / 1000;
    if (dt > 0.1) dt = 0.1;
    state.lastTimestamp = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

// Initial draw just for background effect while sitting on main menu
function idleDrawLoop() {
    if (state.mode === 'start') {
        ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        drawBackground();
        requestAnimationFrame(idleDrawLoop);
    }
}
idleDrawLoop();
