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

// Alien movement
let alienDir = 1;
let alienStepDown = false;
let lastAlienFire = 0;

// Death effect
const DEATH_EFFECT_DURATION = 1200;
let playerDeathEffect = null;

function initPlayer() {
  player.x = (W - PLAYER_W) / 2;
  player.y = H - PLAYER_H - 20;
}

function playDeathSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (_) {}
}

function triggerPlayerDeath() {
  if (gameState === 'dying') return;
  gameState = 'dying';
  playDeathSound();
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const particles = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.5;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * (4 + Math.random() * 6),
      vy: Math.sin(angle) * (4 + Math.random() * 6),
      life: 1,
      size: 4 + Math.random() * 6
    });
  }
  playerDeathEffect = { x: player.x, y: player.y, startTime: Date.now(), particles };
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
  document.getElementById('message').classList.add('hidden');
}

function gameOver() {
  gameState = 'gameOver';
  document.getElementById('message').textContent = 'GAME OVER\nPRESS SPACE TO RESTART';
  document.getElementById('message').classList.remove('hidden');
}

function winLevel() {
  level++;
  bullets = [];
  alienBullets = [];
  alienDir = 1;
  alienStepDown = false;
  initAliens();
  initPlayer();
}

function winGame() {
  gameState = 'win';
  document.getElementById('message').textContent = 'YOU WIN!\nPRESS SPACE TO PLAY AGAIN';
  document.getElementById('message').classList.remove('hidden');
}

function updateUI() {
  document.getElementById('score').textContent = score;
  document.getElementById('level').textContent = level;
  document.getElementById('lives').textContent = lives;
}

function collides(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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
  // Handle death effect
  if (gameState === 'dying' && playerDeathEffect) {
    const elapsed = Date.now() - playerDeathEffect.startTime;
    // Update particles
    playerDeathEffect.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life = Math.max(0, 1 - elapsed / DEATH_EFFECT_DURATION);
    });
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

  // Player movement
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x -= player.speed;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x += player.speed;
  player.x = Math.max(0, Math.min(W - PLAYER_W, player.x));

  // Player bullets
  bullets = bullets.filter(b => {
    b.y -= BULLET_SPEED;
    if (b.y + b.h < 0) return false;

    for (const alien of aliens) {
      if (!alien.alive) continue;
      if (collides(b, alien)) {
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
  const now = Date.now();
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

function drawSpaceGuy(a) {
  const colors = [
    { suit: '#ff4444', visor: '#1a1a2e', eye: '#00ff88', accent: '#ffaa44' },  // red row
    { suit: '#ff8844', visor: '#1a1a2e', eye: '#00ff88', accent: '#ffdd44' },  // orange
    { suit: '#ffcc44', visor: '#1a1a2e', eye: '#00ff88', accent: '#ff6644' },  // yellow
    { suit: '#44ff44', visor: '#1a1a2e', eye: '#ff4488', accent: '#88ff88' },  // green
    { suit: '#4488ff', visor: '#1a1a2e', eye: '#ffcc00', accent: '#88ccff' }   // blue
  ];
  const c = colors[a.row];
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;

  // Body (rounded rectangle - little space suit)
  ctx.fillStyle = c.suit;
  ctx.beginPath();
  const bodyW = a.w * 0.7;
  const bodyH = a.h * 0.35;
  roundRect(ctx, a.x + (a.w - bodyW) / 2, a.y + a.h - bodyH - 2, bodyW, bodyH, 4);
  ctx.fill();

  // Helmet/head (big round dome)
  ctx.fillStyle = c.suit;
  ctx.beginPath();
  ctx.arc(cx, a.y + a.h * 0.42, a.w * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // Visor (dark face window)
  ctx.fillStyle = c.visor;
  ctx.beginPath();
  ctx.arc(cx, a.y + a.h * 0.42, a.w * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (cute glowing dots)
  const eyeY = a.y + a.h * 0.38;
  const eyeOff = a.w * 0.08;
  ctx.fillStyle = c.eye;
  ctx.shadowColor = c.eye;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(cx - eyeOff, eyeY, 3, 0, Math.PI * 2);
  ctx.arc(cx + eyeOff, eyeY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Antennae
  ctx.strokeStyle = c.suit;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - a.w * 0.15, a.y + a.h * 0.2);
  ctx.lineTo(cx - a.w * 0.22, a.y + 2);
  ctx.moveTo(cx + a.w * 0.15, a.y + a.h * 0.2);
  ctx.lineTo(cx + a.w * 0.22, a.y + 2);
  ctx.stroke();
  ctx.fillStyle = c.accent;
  ctx.beginPath();
  ctx.arc(cx - a.w * 0.22, a.y + 2, 3, 0, Math.PI * 2);
  ctx.arc(cx + a.w * 0.22, a.y + 2, 3, 0, Math.PI * 2);
  ctx.fill();
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
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  // Draw death effect
  if (gameState === 'dying' && playerDeathEffect) {
    const elapsed = Date.now() - playerDeathEffect.startTime;
    const progress = Math.min(1, elapsed / DEATH_EFFECT_DURATION);
    // Flash at impact point
    ctx.fillStyle = `rgba(255, 100, 100, ${1 - progress})`;
    ctx.beginPath();
    ctx.arc(playerDeathEffect.x + PLAYER_W / 2, playerDeathEffect.y + PLAYER_H / 2, 20 + progress * 15, 0, Math.PI * 2);
    ctx.fill();
    // Particles
    playerDeathEffect.particles.forEach(p => {
      ctx.fillStyle = `rgba(0, 255, 100, ${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Draw aliens (cool little space guys)
  aliens.forEach(a => {
    if (!a.alive) return;
    drawSpaceGuy(a);
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

initPlayer();
initAliens();
updateUI();
gameLoop();
