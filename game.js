'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Constantes de juego ───────────────────────────────────────────────────────
const SHIP_THRUST = 260;  // px/s²
const SHIP_DRAG   = 0.987; // por frame a 60 Hz
const BOOST_TIME  = 5;     // segundos de duración del boost
const BOOST_MULT  = 2;     // multiplicador de empuje y velocidad
const BOOST_COLOR = '#4de1ff';
const TRIPLE_TIME   = 5;     // segundos de duración del triple shot
const TRIPLE_COUNT  = 3;     // balas por disparo
const TRIPLE_SPREAD = 0.14;  // radianes entre cada bala del abanico
const TRIPLE_COLOR  = '#ff6ad5';
const PICKUP_CHANCE   = 0.12; // probabilidad de soltar un power-up
const PICKUP_COOLDOWN = 8;    // segundos mínimos entre power-ups
const PICKUP_TTL      = 14;   // segundos de vida del power-up
const PICKUP_RADIUS   = 11;
const STAR_SIZE       = 3;      // tamaño del asteroide (radio RADII[3])
const STAR_SPEED      = 190;    // px/s, muy por encima de un grande normal
const STAR_TTL        = 12;     // segundos en pantalla antes de desaparecer
const STAR_POINTS     = 200;
const STAR_COLOR      = '#ffd75e';
const STAR_TRAIL_LEN  = 18;     // posiciones guardadas para la estela
const STAR_SPAWN_EVERY = 14;    // segundos entre apariciones
const STAR_MAX_ACTIVE = 2;      // estrellas simultáneas
const STAR_SAFE_DIST  = 130;    // distancia mínima al centro al aparecer

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle, color = '#fff') {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.color = color;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  get points() {
    return POINTS[this.size];
  }

  get explosionCount() {
    return this.size * 5;
  }

  // Los asteroides normales no caducan; la estrella fugaz sí
  isExpired() {
    return false;
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz ────────────────────────────────────────────────────────────
// Asteroide rápido y temporal: aparece periódicamente y caduca solo
class ShootingStar extends Asteroid {
  constructor(x, y) {
    super(x, y, STAR_SIZE);

    const angle = rand(0, Math.PI * 2);
    const speed = STAR_SPEED + rand(-20, 20);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.ttl    = STAR_TTL;
    this.trail  = [];
    this.expired = false;
  }

  get points() {
    return STAR_POINTS;
  }

  get explosionCount() {
    return 24;
  }

  isExpired() {
    return this.expired;
  }

  // No se parte: al destruirla simplemente desaparece
  split() {
    return [];
  }

  update(dt) {
    super.update(dt);

    this.ttl -= dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > STAR_TRAIL_LEN) this.trail.shift();

    if (this.ttl <= 0) {
      this.ttl = 0;
      this.dead = true;
      this.expired = true;
    }
  }

  draw() {
    // Parpadea al expirar para avisar de que está a punto de desaparecer
    if (this.ttl < 3 && Math.floor(this.ttl * 6) % 2 === 0) return;

    this.drawTrail();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.shadowColor = STAR_COLOR;
    ctx.shadowBlur  = 15;
    ctx.strokeStyle  = STAR_COLOR;
    ctx.lineWidth    = 1.8;
    ctx.lineJoin     = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Estela: se desvanece hacia la cola
  drawTrail() {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const from = this.trail[i - 1];
      const to   = this.trail[i];
      // Descarta el salto del wrap toroidal
      if (Math.hypot(to.x - from.x, to.y - from.y) > 200) continue;

      const t = i / this.trail.length;
      ctx.strokeStyle = `rgba(255, 215, 94, ${(t * 0.6).toFixed(2)})`;
      ctx.lineWidth   = t * 3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.boostTimer    = 0;
    this.tripleTimer   = 0;
    this.dead          = false;
  }

  get boosting() {
    return this.boostTimer > 0;
  }

  get tripleShot() {
    return this.tripleTimer > 0;
  }

  // Color de la nave: el boost tiene prioridad sobre el triple shot
  get hullColor() {
    if (this.boosting)   return BOOST_COLOR;
    if (this.tripleShot) return TRIPLE_COLOR;
    return '#fff';
  }

  activateBoost(seconds) {
    this.boostTimer = Math.max(this.boostTimer, seconds);
  }

  activateTriple(seconds) {
    this.tripleTimer = Math.max(this.tripleTimer, seconds);
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.boostTimer    > 0) this.boostTimer    -= dt;
    if (this.tripleTimer   > 0) this.tripleTimer   -= dt;

    const ROT = 3.5;   // rad/s
    const thrust = SHIP_THRUST * (this.boosting ? BOOST_MULT : 1);
    // Drag en base al tiempo: a 60 Hz equivale a multiplicar por SHIP_DRAG
    const drag = Math.pow(SHIP_DRAG, dt * 60);

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * thrust * dt;
      this.vy += Math.sin(this.angle) * thrust * dt;
    }

    this.vx *= drag;
    this.vy *= drag;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;

    const count = this.tripleShot ? TRIPLE_COUNT : 1;
    const step  = this.tripleShot ? TRIPLE_SPREAD : 0;
    const color = this.tripleShot ? TRIPLE_COLOR : '#fff';

    const bullets = [];
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * step;
      bullets.push(new Bullet(ox, oy, this.angle + offset, color));
    }
    return bullets;
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.hullColor;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14) * (this.boosting ? 1.8 : 1), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = this.boosting ? BOOST_COLOR : 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────
// Clase base: el tipo concreto decide color, efecto e icono
class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(10, 25);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = PICKUP_RADIUS;
    this.ttl  = PICKUP_TTL;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  get color() {
    return '#fff';
  }

  // Efecto al recogerlo
  apply(ship) {}

  // Galón hacia adelante
  drawChevron(x, scale = 1) {
    ctx.beginPath();
    ctx.moveTo(x - 4 * scale, -5 * scale);
    ctx.lineTo(x + 3 * scale,  0);
    ctx.lineTo(x - 4 * scale,  5 * scale);
    ctx.stroke();
  }

  drawIcon() {}

  draw() {
    // Parpadea al expirar para avisar de que está a punto de desaparecer
    if (this.ttl < 3 && Math.floor(this.ttl * 6) % 2 === 0) return;

    const pulse = 1 + Math.sin(performance.now() / 150) * 0.12;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = this.color;
    ctx.fillStyle   = this.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();

    this.drawIcon();
    ctx.restore();
  }
}

// Power-up de velocidad: empuje y velocidad máxima x2
class SpeedPowerUp extends PowerUp {
  get color() {
    return BOOST_COLOR;
  }

  apply(ship) {
    ship.activateBoost(BOOST_TIME);
  }

  drawIcon() {
    this.drawChevron(0);
  }
}

// Power-up de triple shot: 3 balas en abanico durante 5 segundos
class TriplePowerUp extends PowerUp {
  get color() {
    return TRIPLE_COLOR;
  }

  apply(ship) {
    ship.activateTriple(TRIPLE_TIME);
  }

  drawIcon() {
    this.drawChevron(-5, 0.7);
    this.drawChevron(0, 0.7);
    this.drawChevron(5, 0.7);
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, pickups;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let pickupCooldown;
let starTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

// Coloca una estrella fugaz lejos del centro para no matar en el spawn
function spawnShootingStar() {
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - W / 2, y - H / 2) < STAR_SAFE_DIST);
  asteroids.push(new ShootingStar(x, y));
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  pickups   = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  pickupCooldown = 0;
  starTimer = STAR_SPAWN_EVERY;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  pickups   = [];
  pickupCooldown = 0;
  starTimer = STAR_SPAWN_EVERY;
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

// Suelta un power-up con probabilidad, respetando un cooldown global
function maybeDropPickup(asteroid) {
  if (pickupCooldown > 0) return;
  if (Math.random() >= PICKUP_CHANCE) return;
  const type = Math.random() < 0.5 ? new SpeedPowerUp(asteroid.x, asteroid.y)
                                   : new TriplePowerUp(asteroid.x, asteroid.y);
  pickups.push(type);
  pickupCooldown = PICKUP_COOLDOWN;
}

// Las estrellas fugaces que caducan se desvanecen en una nube de partículas
function explodeExpiredStars() {
  for (const a of asteroids) {
    if (a.isExpired()) explode(a.x, a.y, 6);
  }
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    asteroids.forEach(a => a.update(dt));
    explodeExpiredStars();

    particles = particles.filter(p => !p.dead);
    asteroids = asteroids.filter(a => !a.dead);

    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));

  // Las estrellas fugaces que caducan se desvanecen en una nube de partículas
  explodeExpiredStars();

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += a.points;
        explode(a.x, a.y, a.explosionCount);
        newAsteroids.push(...a.split());
        maybeDropPickup(a);
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Power-ups: movimiento, caducidad y recogida
  pickupCooldown = Math.max(0, pickupCooldown - dt);
  pickups.forEach(p => p.update(dt));
  for (const p of pickups) {
    if (p.dead) continue;
    if (dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      p.apply(ship);
      explode(p.x, p.y, 12);
    }
  }
  pickups = pickups.filter(p => !p.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();

  // Aparición periódica de estrellas fugaces
  starTimer -= dt;
  if (starTimer <= 0) {
    const activeStars = asteroids.filter(a => a instanceof ShootingStar).length;
    if (activeStars < STAR_MAX_ACTIVE) {
      spawnShootingStar();
      starTimer = STAR_SPAWN_EVERY;
    } else {
      starTimer = 2; // reintenta en cuanto baje del límite
    }
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  drawBoostIndicator();
  drawTripleIndicator();
  drawStarIndicator();
}

// Cuenta atrás de la estrella fugaz que está a punto de expirar
function drawStarIndicator() {
  const star = asteroids
    .filter(a => a instanceof ShootingStar)
    .sort((a, b) => a.ttl - b.ttl)[0];
  if (!star) return;

  const x = 14;
  const y = 48;
  const w = 130;

  ctx.textAlign = 'left';
  ctx.fillStyle = STAR_COLOR;
  ctx.font = '13px monospace';
  ctx.fillText(`ESTRELLA FUGAZ  ${star.ttl.toFixed(1)}s`, x, y);

  ctx.strokeStyle = STAR_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y + 6, w, 6);
  ctx.fillRect(x + 1, y + 7, (w - 2) * (star.ttl / STAR_TTL), 4);
}

// Indicador de velocidad con cuenta atrás y barra de progreso
function drawBoostIndicator() {
  if (!ship.boosting || ship.dead) return;

  const w = 150;
  const x = W / 2 - w / 2;
  const y = 38;

  ctx.textAlign = 'center';
  ctx.fillStyle = BOOST_COLOR;
  ctx.font = '13px monospace';
  ctx.fillText(`VELOCIDAD  ${ship.boostTimer.toFixed(1)}s`, W / 2, y);

  ctx.strokeStyle = BOOST_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y + 6, w, 6);
  ctx.fillRect(x + 1, y + 7, (w - 2) * (ship.boostTimer / BOOST_TIME), 4);
}

// Indicador de triple shot con cuenta atrás y barra de progreso
function drawTripleIndicator() {
  if (!ship.tripleShot || ship.dead) return;

  const w = 150;
  const x = W / 2 - w / 2;
  const y = 64;

  ctx.textAlign = 'center';
  ctx.fillStyle = TRIPLE_COLOR;
  ctx.font = '13px monospace';
  ctx.fillText(`TRIPLE  ${ship.tripleTimer.toFixed(1)}s`, W / 2, y);

  ctx.strokeStyle = TRIPLE_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y + 6, w, 6);
  ctx.fillRect(x + 1, y + 7, (w - 2) * (ship.tripleTimer / TRIPLE_TIME), 4);
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  pickups.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
