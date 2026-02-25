const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// Game state
let gameState = 'menu';
let score = 0;
let lives = 3;
let level = 1;

// Constants
const COLS = 11;
const ROWS = 5;
const ALIEN_W = 40;
const ALIEN_H = 30;
const ALIEN_GAP_X = 10;
const ALIEN_GAP_Y = 10;
const PLAYER_W = 50;
const PLAYER_H = 30;
const BULLET_W = 4;
const BULLET_H = 12;
const BULLET_SPEED = 8;
const ALIEN_BULLET_SPEED = 4;
const BASE_ALIEN_SPEED = 0.5;
const ALIEN_FIRE_INTERVAL = 1200;

// Points per row (top = most)
const ROW_POINTS = [30, 20, 20, 10, 10];

// Entities
let player = { x: 0, y: 0, w: PLAYER_W, h: PLAYER_H, speed: 6 };
let aliens = [];
let bullets = [];
let alienBullets = [];

// Input
const keys = {};
let touchLeft = false;
let touchRight = false;

// Alien movement
let alienDir = 1;
let alienStepDown = false;
let lastAlienFire = 0;

// Death effect - classic Space Invaders style (flash frames, no particles)
const DEATH_EFFECT_DURATION = 800;
let playerDeathEffect = null;

// Alien explosion effects (match animal row colors)
const ALIEN_COLORS = [
  { suit: '#e8c4a0', accent: '#c49a6c' },   // rabbit
  { suit: '#e85c2e', accent: '#8b4513' },   // fox
  { suit: '#8b7355', accent: '#5c4033' },   // deer
  { suit: '#4a3728', accent: '#2d1f14' },   // bear
  { suit: '#87ceeb', accent: '#5c9eb8' }    // bird
];
const EXPLOSION_BASE_DURATION = 400;
let explosions = [];

function initPlayer() {
  player.x = (W - PLAYER_W) / 2;
  player.y = H - PLAYER_H - 20;
}

function playDeathSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Classic Space Invaders: short punchy descending buzz
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(55, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.18);
  } catch (_) {}
}

function playGameOverSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Longer, more dramatic descending tone to emphasize game over
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(330, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.25);
    osc.frequency.linearRampToValueAtTime(55, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.55);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.55);
  } catch (_) {}
}

function triggerAlienExplosion(alien) {
  const cx = alien.x + alien.w / 2;
  const cy = alien.y + alien.h / 2;
  const c = ALIEN_COLORS[alien.row];
  // Intensity scales with level (dialed down ~50% from original)
  const intensity = Math.min(3, Math.floor(level / 2) + 1);
  const particleCount = 6 + intensity * 4;
  const speedMult = 1 + intensity * 0.25;
  const sizeMult = 1 + intensity * 0.15;
  const duration = EXPLOSION_BASE_DURATION + intensity * 100;

  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 1.2;
    const speed = (1.5 + Math.random() * 3) * speedMult;
    const useAccent = Math.random() < 0.3;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: (1.5 + Math.random() * 2.5) * sizeMult,
      color: useAccent ? c.accent : c.suit,
      decay: 0.7 + Math.random() * 0.5
    });
  }
  // Add secondary sparks only at highest intensity
  if (intensity >= 3) {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * (4 + Math.random() * 2),
        vy: Math.sin(angle) * (4 + Math.random() * 2),
        life: 1,
        size: 1.5,
        color: '#ffffff',
        decay: 1.2
      });
    }
  }
  explosions.push({ x: cx, y: cy, startTime: Date.now(), particles, duration });
}

function triggerPlayerDeath() {
  if (gameState === 'dying') return;
  gameState = 'dying';
  if (lives <= 1) {
    playGameOverSound();
  } else {
    playDeathSound();
  }
  playerDeathEffect = { x: player.x, y: player.y, startTime: Date.now() };
}

function initAliens() {
  aliens = [];
  const startX = 80;
  const startY = 60;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      aliens.push({
        x: startX + c * (ALIEN_W + ALIEN_GAP_X),
        y: startY + r * (ALIEN_H + ALIEN_GAP_Y),
        w: ALIEN_W,
        h: ALIEN_H,
        row: r,
        col: c,
        alive: true
      });
    }
  }
}

function resetGame() {
  score = 0;
  lives = 3;
  level = 1;
  bullets = [];
  alienBullets = [];
  explosions = [];
  alienDir = 1;
  alienStepDown = false;
  playerDeathEffect = null;
  initPlayer();
  initAliens();
  updateUI();
}

function startGame() {
  gameState = 'playing';
  resetGame();
  document.getElementById('messageWrapper').classList.add('hidden');
}

function gameOver() {
  gameState = 'gameOver';
  const restartHint = isTouchDevice() ? 'TAP FIRE TO RESTART' : 'PRESS SPACE TO RESTART';
  document.getElementById('message').textContent = `GAME OVER\n${restartHint}`;
  document.getElementById('messageWrapper').classList.remove('hidden');
}

function winLevel() {
  level++;
  bullets = [];
  alienBullets = [];
  explosions = [];
  alienDir = 1;
  alienStepDown = false;
  initAliens();
  initPlayer();
}

function winGame() {
  gameState = 'win';
  const playHint = isTouchDevice() ? 'TAP FIRE TO PLAY AGAIN' : 'PRESS SPACE TO PLAY AGAIN';
  document.getElementById('message').textContent = `YOU WIN!\n${playHint}`;
  document.getElementById('messageWrapper').classList.remove('hidden');
}

function updateUI() {
  document.getElementById('score').textContent = score;
  document.getElementById('level').textContent = level;
  document.getElementById('lives').textContent = lives;
}

function collides(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getAlienSpeed() {
  const aliveCount = aliens.filter(a => a.alive).length;
  return BASE_ALIEN_SPEED + (55 - aliveCount) * 0.02 + level * 0.2;
}

function getBottomRowAliens() {
  const byCol = {};
  aliens.forEach(a => {
    if (!a.alive) return;
    if (!byCol[a.col] || a.y > byCol[a.col].y) byCol[a.col] = a;
  });
  return Object.values(byCol);
}

function update(dt) {
  // Update explosions (always, so they animate during death too)
  const now = Date.now();
  explosions = explosions.filter(exp => {
    const elapsed = now - exp.startTime;
    if (elapsed >= exp.duration) return false;
    exp.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life = Math.max(0, 1 - elapsed / exp.duration * p.decay);
    });
    return true;
  });

  // Handle death effect
  if (gameState === 'dying' && playerDeathEffect) {
    const elapsed = Date.now() - playerDeathEffect.startTime;
    if (elapsed >= DEATH_EFFECT_DURATION) {
      lives--;
      updateUI();
      playerDeathEffect = null;
      if (lives <= 0) {
        gameOver();
      } else {
        alienBullets = [];
        initPlayer();
        gameState = 'playing';
      }
    }
    return;
  }
  if (gameState !== 'playing') return;

  // Player movement (keyboard + touch)
  if (keys['ArrowLeft'] || keys['a'] || keys['A'] || touchLeft) player.x -= player.speed;
  if (keys['ArrowRight'] || keys['d'] || keys['D'] || touchRight) player.x += player.speed;
  player.x = Math.max(0, Math.min(W - PLAYER_W, player.x));

  // Player bullets
  bullets = bullets.filter(b => {
    b.y -= BULLET_SPEED;
    if (b.y + b.h < 0) return false;

    for (const alien of aliens) {
      if (!alien.alive) continue;
      if (collides(b, alien)) {
        triggerAlienExplosion(alien);
        alien.alive = false;
        score += ROW_POINTS[alien.row];
        return false;
      }
    }
    return true;
  });

  // Alien movement
  const speed = getAlienSpeed();
  let hitEdge = false;
  let lowestY = 0;

  aliens.forEach(a => {
    if (!a.alive) return;
    a.x += alienDir * speed;
    if (a.x <= 0 || a.x + a.w >= W) hitEdge = true;
    if (a.y + a.h > lowestY) lowestY = a.y + a.h;
  });

  if (hitEdge) {
    alienDir *= -1;
    aliens.forEach(a => {
      if (a.alive) a.y += ALIEN_H;
    });
  }

  // Alien bullets
  if (now - lastAlienFire > ALIEN_FIRE_INTERVAL / level) {
    lastAlienFire = now;
    const bottomAliens = getBottomRowAliens();
    if (bottomAliens.length > 0) {
      const shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)];
      alienBullets.push({
        x: shooter.x + shooter.w / 2 - BULLET_W / 2,
        y: shooter.y + shooter.h,
        w: BULLET_W,
        h: BULLET_H,
        dy: ALIEN_BULLET_SPEED
      });
    }
  }

  alienBullets = alienBullets.filter(b => {
    b.y += b.dy;
    if (b.y > H) return false;
    if (collides(b, player)) {
      triggerPlayerDeath();
      return false;
    }
    return true;
  });

  // Lose if aliens reach bottom
  if (lowestY >= player.y) {
    triggerPlayerDeath();
  }

  // Check win
  const aliveCount = aliens.filter(a => a.alive).length;
  if (aliveCount === 0) {
    winLevel();
  }

  updateUI();
}

// Classic pixel-art animal types (row 0–4: rabbit, fox, deer, bear, bird)
const ANIMAL_COLORS = [
  { main: '#e8c4a0', accent: '#c49a6c', eye: '#1a1a1a' },   // rabbit - tan
  { main: '#e85c2e', accent: '#8b4513', eye: '#1a1a1a' },   // fox - orange
  { main: '#8b7355', accent: '#5c4033', eye: '#1a1a1a' },    // deer - brown
  { main: '#4a3728', accent: '#2d1f14', eye: '#1a1a1a' },   // bear - dark brown
  { main: '#87ceeb', accent: '#5c9eb8', eye: '#1a1a1a' }    // bird - sky blue
];

function drawSpaceGuy(a) {
  const c = ANIMAL_COLORS[a.row];
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const r = a.row;

  // Shared: body blob (classic chunky pixel style)
  ctx.fillStyle = c.main;
  ctx.beginPath();
  const bodyW = a.w * 0.65;
  const bodyH = a.h * 0.5;
  roundRect(ctx, a.x + (a.w - bodyW) / 2, a.y + a.h - bodyH - 2, bodyW, bodyH, 3);
  ctx.fill();

  // Row 0: Rabbit - long ears, round head
  if (r === 0) {
    ctx.fillStyle = c.main;
    ctx.fillRect(cx - a.w * 0.12, a.y + 2, a.w * 0.1, a.h * 0.5);
    ctx.fillRect(cx + a.w * 0.02, a.y + 2, a.w * 0.1, a.h * 0.5);
    ctx.beginPath();
    ctx.arc(cx, a.y + a.h * 0.45, a.w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.fillRect(cx - a.w * 0.06, a.y + a.h * 0.38, 3, 3);
    ctx.fillRect(cx + a.w * 0.03, a.y + a.h * 0.38, 3, 3);
    ctx.fillStyle = c.eye;
    ctx.fillRect(cx - a.w * 0.06, a.y + a.h * 0.38, 2, 2);
    ctx.fillRect(cx + a.w * 0.04, a.y + a.h * 0.38, 2, 2);
  }
  // Row 1: Fox - pointed ears, snout
  else if (r === 1) {
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.moveTo(cx - a.w * 0.2, a.y + a.h * 0.35);
    ctx.lineTo(cx - a.w * 0.08, a.y + 4);
    ctx.lineTo(cx, a.y + a.h * 0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + a.w * 0.2, a.y + a.h * 0.35);
    ctx.lineTo(cx + a.w * 0.08, a.y + 4);
    ctx.lineTo(cx, a.y + a.h * 0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, a.y + a.h * 0.42, a.w * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.fillRect(cx - a.w * 0.05, a.y + a.h * 0.5, a.w * 0.12, 4);
    ctx.fillStyle = c.eye;
    ctx.fillRect(cx - a.w * 0.08, a.y + a.h * 0.35, 2, 2);
    ctx.fillRect(cx + a.w * 0.05, a.y + a.h * 0.35, 2, 2);
  }
  // Row 2: Deer - antlers, elongated face
  else if (r === 2) {
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - a.w * 0.15, a.y + a.h * 0.3);
    ctx.lineTo(cx - a.w * 0.25, a.y + 4);
    ctx.moveTo(cx - a.w * 0.12, a.y + a.h * 0.25);
    ctx.lineTo(cx - a.w * 0.2, a.y + 8);
    ctx.moveTo(cx + a.w * 0.15, a.y + a.h * 0.3);
    ctx.lineTo(cx + a.w * 0.25, a.y + 4);
    ctx.moveTo(cx + a.w * 0.12, a.y + a.h * 0.25);
    ctx.lineTo(cx + a.w * 0.2, a.y + 8);
    ctx.stroke();
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.arc(cx, a.y + a.h * 0.45, a.w * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - a.w * 0.04, a.y + a.h * 0.48, a.w * 0.08, 5);
    ctx.fillStyle = c.eye;
    ctx.fillRect(cx - a.w * 0.07, a.y + a.h * 0.38, 2, 2);
    ctx.fillRect(cx + a.w * 0.04, a.y + a.h * 0.38, 2, 2);
  }
  // Row 3: Bear - round ears, broad head
  else if (r === 3) {
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.arc(cx - a.w * 0.2, a.y + a.h * 0.3, a.w * 0.12, 0, Math.PI * 2);
    ctx.arc(cx + a.w * 0.2, a.y + a.h * 0.3, a.w * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, a.y + a.h * 0.48, a.w * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(cx, a.y + a.h * 0.52, a.w * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.eye;
    ctx.fillRect(cx - a.w * 0.08, a.y + a.h * 0.42, 2, 2);
    ctx.fillRect(cx + a.w * 0.05, a.y + a.h * 0.42, 2, 2);
  }
  // Row 4: Bird - beak, wing bumps
  else {
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.arc(cx, a.y + a.h * 0.45, a.w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(cx + a.w * 0.2, a.y + a.h * 0.45);
    ctx.lineTo(cx + a.w * 0.35, a.y + a.h * 0.42);
    ctx.lineTo(cx + a.w * 0.2, a.y + a.h * 0.48);
    ctx.fill();
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.ellipse(cx - a.w * 0.15, a.y + a.h * 0.35, a.w * 0.08, a.h * 0.15, 0.3, 0, Math.PI * 2);
    ctx.ellipse(cx + a.w * 0.1, a.y + a.h * 0.35, a.w * 0.08, a.h * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.eye;
    ctx.fillRect(cx - a.w * 0.06, a.y + a.h * 0.4, 2, 2);
    ctx.fillRect(cx + a.w * 0.02, a.y + a.h * 0.4, 2, 2);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawPlayerShip() {
  const x = player.x;
  const y = player.y;
  const w = player.w;
  const h = player.h;
  const cx = x + w / 2;

  // Main hull - sleek triangular body (classic Space Invaders style)
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.moveTo(cx, y + 4);                    // nose
  ctx.lineTo(x + w - 2, y + h - 4);         // bottom-right
  ctx.lineTo(x + w * 0.65, y + h);          // right wing notch
  ctx.lineTo(cx, y + h - 8);                // center notch (engine)
  ctx.lineTo(x + w * 0.35, y + h);          // left wing notch
  ctx.lineTo(x + 2, y + h - 4);             // bottom-left
  ctx.closePath();
  ctx.fill();

  // Cockpit / canopy - cyan accent
  ctx.fillStyle = '#00ddff';
  ctx.beginPath();
  ctx.moveTo(cx, y + 10);
  ctx.lineTo(cx - 6, y + h - 12);
  ctx.lineTo(cx + 6, y + h - 12);
  ctx.closePath();
  ctx.fill();

  // Engine glow
  ctx.fillStyle = '#33ff33';
  ctx.shadowColor = '#00ff00';
  ctx.shadowBlur = 6;
  ctx.fillRect(cx - 3, y + h - 6, 6, 4);
  ctx.shadowBlur = 0;
}

function shoot() {
  if (gameState !== 'playing') return;
  bullets.push({
    x: player.x + (PLAYER_W - BULLET_W) / 2,
    y: player.y,
    w: BULLET_W,
    h: BULLET_H
  });
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (gameState === 'menu') {
    initPlayer();
    initAliens();
    updateUI();
  }

  // Draw player (not when dying)
  if (gameState === 'playing' || gameState === 'menu') {
    drawPlayerShip();
  }

  // Draw death effect - classic Space Invaders: blocky flash frames
  if (gameState === 'dying' && playerDeathEffect) {
    const elapsed = Date.now() - playerDeathEffect.startTime;
    const progress = Math.min(1, elapsed / DEATH_EFFECT_DURATION);
    const cx = playerDeathEffect.x + PLAYER_W / 2;
    const cy = playerDeathEffect.y + PLAYER_H / 2;
    // Rapid white/green flicker (like original CRT phosphor sprite swap)
    const frameRate = 50;
    const frame = Math.floor((elapsed / 1000) * frameRate) % 4;
    const flashWhite = frame < 2;
    const fade = 1 - progress * progress;
    if (fade > 0.05) {
      ctx.fillStyle = flashWhite
        ? `rgba(255, 255, 255, ${fade})`
        : `rgba(0, 255, 0, ${fade * 0.7})`;
      // Blocky explosion - chunky expanding rect + cross (arcade sprite style)
      const size = 10 + progress * 28;
      const w = Math.floor(size);
      const h = Math.floor(size * 0.9);
      ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
      const bar = Math.max(4, Math.floor(size * 0.35));
      ctx.fillRect(cx - bar, cy - size, bar * 2, size * 2);
      ctx.fillRect(cx - size, cy - bar, size * 2, bar * 2);
    }
  }

  // Draw aliens (cool little space guys)
  aliens.forEach(a => {
    if (!a.alive) return;
    drawSpaceGuy(a);
  });

  // Draw alien explosions
  explosions.forEach(exp => {
    const elapsed = Date.now() - exp.startTime;
    const progress = Math.min(1, elapsed / exp.duration);
    // Bright flash at center (fades quickly, dialed down)
    const flashAlpha = Math.max(0, 1 - progress * 4) * 0.6;
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 200, ${flashAlpha})`;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, 8 + progress * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particle burst
    exp.particles.forEach(p => {
      ctx.fillStyle = hexToRgba(p.color, p.life);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.life * 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  });

  // Draw bullets
  ctx.fillStyle = '#00ff00';
  bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  ctx.fillStyle = '#ff4444';
  alienBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
}

function gameLoop() {
  if (gameState === 'playing' || gameState === 'dying') update();
  render();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  // Start from intro screen with Space or Enter
  const introEl = document.getElementById('introScreen');
  if (!introEl.classList.contains('hidden') && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    introEl.classList.add('hidden');
    startGame();
    return;
  }
  if (e.key === ' ') {
    e.preventDefault();
    if (gameState === 'menu' || gameState === 'gameOver' || gameState === 'win') {
      startGame();
    } else if (gameState === 'playing' && !e.repeat) {
      shoot();
    }
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Intro screen - start game when button clicked
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('introScreen').classList.add('hidden');
  startGame();
});

// Touch controls (iOS / mobile)
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function setupTouchControls() {
  if (!isTouchDevice()) return;

  const touchControls = document.getElementById('touchControls');
  const touchLeftBtn = document.getElementById('touchLeft');
  const touchRightBtn = document.getElementById('touchRight');
  const touchShootBtn = document.getElementById('touchShoot');
  const introHint = document.getElementById('introHint');

  if (touchControls) touchControls.classList.add('visible');
  if (introHint) introHint.textContent = 'TAP arrows to move • TAP FIRE to shoot';

  const setLeft = (v) => { touchLeft = v; };
  const setRight = (v) => { touchRight = v; };

  if (touchLeftBtn) {
    touchLeftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setLeft(true); }, { passive: false });
    touchLeftBtn.addEventListener('touchend', (e) => { e.preventDefault(); setLeft(false); }, { passive: false });
    touchLeftBtn.addEventListener('mousedown', () => setLeft(true));
    touchLeftBtn.addEventListener('mouseup', () => setLeft(false));
    touchLeftBtn.addEventListener('mouseleave', () => setLeft(false));
  }
  if (touchRightBtn) {
    touchRightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setRight(true); }, { passive: false });
    touchRightBtn.addEventListener('touchend', (e) => { e.preventDefault(); setRight(false); }, { passive: false });
    touchRightBtn.addEventListener('mousedown', () => setRight(true));
    touchRightBtn.addEventListener('mouseup', () => setRight(false));
    touchRightBtn.addEventListener('mouseleave', () => setRight(false));
  }
  if (touchShootBtn) {
    touchShootBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gameState === 'menu' || gameState === 'gameOver' || gameState === 'win') startGame();
      else shoot();
    }, { passive: false });
    touchShootBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (gameState === 'menu' || gameState === 'gameOver' || gameState === 'win') startGame();
      else shoot();
    });
  }
}

setupTouchControls();

initPlayer();
initAliens();
updateUI();
gameLoop();
