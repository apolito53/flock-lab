// The observer never writes to the flock. Distances are simulation units and time is seconds.
export const STEP = 1 / 60;
export const BOUNDS = { x: 68, y: 37, z: 52 };
export const DEFAULTS = Object.freeze({
  population: 224,
  alignment: 0.68,
  cohesion: 0.58,
  separation: 0.82,
  leader: true,
  gravity: 0.72,
  radius: 92,
  momentum: true,
});
export const TRAIL_SAMPLES = 18;
const HISTORY_INTERVAL = 0.11;
const NEIGHBOR_RADIUS = 10;
const PERSONAL_SPACE = 6.4;
const ROUTE_RATE = 0.235;
const START_PHASE = 0.68;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function route(t) {
  return {
    x: 49 * Math.sin(t),
    y: 18 * Math.sin(2 * t + 0.56),
    z: 31 * Math.sin(2 * t - 0.37),
    vx: 49 * Math.cos(t) * ROUTE_RATE,
    vy: 36 * Math.cos(2 * t + 0.56) * ROUTE_RATE,
    vz: 62 * Math.cos(2 * t - 0.37) * ROUTE_RATE,
  };
}

export function recordTrail(bird) {
  bird.trailHead = (bird.trailHead + 1) % TRAIL_SAMPLES;
  const offset = bird.trailHead * 3;
  bird.trail[offset] = bird.x;
  bird.trail[offset + 1] = bird.y;
  bird.trail[offset + 2] = bird.z;
  bird.trailCount = Math.min(bird.trailCount + 1, TRAIL_SAMPLES);
}

function wallForce(position, extent) {
  const inset = extent - 9;
  return -Math.sign(position) * Math.max(0, Math.abs(position) - inset) * 1.65;
}

export function gravityGain(distance, radius) {
  if (distance <= 0 || distance >= radius) return 0;
  const t = distance / radius;
  return (1 - t * t * (3 - 2 * t)) * Math.min(1, distance / 15);
}

// Accumulate each pair from the same position and velocity snapshot.
export function collectNeighbors(birds) {
  for (const b of birds) {
    b.neighbors = 0;
    b.dx = b.dy = b.dz = b.dvx = b.dvy = b.dvz = b.sx = b.sy = b.sz = 0;
  }
  for (let i = 1; i < birds.length; i++) {
    const a = birds[i];
    for (let j = 0; j < i; j++) {
      const b = birds[j];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= NEIGHBOR_RADIUS * NEIGHBOR_RADIUS) continue;
      a.neighbors++;
      b.neighbors++;
      a.dx += dx;
      a.dy += dy;
      a.dz += dz;
      b.dx -= dx;
      b.dy -= dy;
      b.dz -= dz;
      const vx = b.vx - a.vx,
        vy = b.vy - a.vy,
        vz = b.vz - a.vz;
      a.dvx += vx;
      a.dvy += vy;
      a.dvz += vz;
      b.dvx -= vx;
      b.dvy -= vy;
      b.dvz -= vz;
      if (d2 >= PERSONAL_SPACE * PERSONAL_SPACE || d2 < 1e-8) continue;
      const distance = Math.sqrt(d2);
      const weight = (1 - distance / PERSONAL_SPACE) / distance;
      const sx = dx * weight,
        sy = dy * weight,
        sz = dz * weight;
      a.sx -= sx;
      a.sy -= sy;
      a.sz -= sz;
      b.sx += sx;
      b.sy += sy;
      b.sz += sz;
    }
  }
}

export function localSteering(b, cfg) {
  const neighbors = b.neighbors || 1;
  const align = (cfg.alignment * 1.15) / neighbors;
  const cohere = (cfg.cohesion * 0.7) / neighbors;
  const separate = cfg.separation * 16;
  const ax = b.dvx * align + b.dx * cohere + b.sx * separate + wallForce(b.x, BOUNDS.x);
  const ay = b.dvy * align + b.dy * cohere + b.sy * separate + wallForce(b.y, BOUNDS.y);
  const az = b.dvz * align + b.dz * cohere + b.sz * separate + wallForce(b.z, BOUNDS.z);
  return { ax, ay, az };
}

export class Swarm {
  constructor(settings = {}, seed = 5317) {
    this.settings = { ...DEFAULTS, ...settings };
    this.seed = seed;
    this.reset();
  }

  reset() {
    this.random = randomGenerator(this.seed);
    this.birds = [];
    this.time = 0;
    this.trailClock = 0;
    this.setPopulation(this.settings.population, true);
  }

  setPopulation(count, initial = false) {
    count = clamp(Math.round(count), 1, 480);
    this.settings.population = count;
    if (this.birds.length > count) this.birds.length = count;
    const rnd = this.random;
    const jitter = () => rnd() + rnd() + rnd() - 1.5;
    while (this.birds.length < count) {
      const seedAlongWake = initial || this.birds.length === 0;
      const anchor = seedAlongWake
        ? route(START_PHASE - (this.birds.length ? rnd() * 1.98 : 0))
        : this.birds[Math.floor(rnd() * this.birds.length)];
      const spread = this.birds.length === 0 ? 0 : seedAlongWake ? 12 : 5;
      // Smaller agents turn sooner; this variation lets a bend propagate through the flock.
      const agility = rnd();
      const size = 1.3 - agility * 0.48;
      const bird = {
        x: anchor.x + jitter() * spread,
        y: anchor.y + jitter() * spread * 0.7,
        z: anchor.z + jitter() * spread,
        vx: anchor.vx + jitter() * 2,
        vy: anchor.vy + jitter() * 2,
        vz: anchor.vz + jitter() * 2,
        cruise: 11 + rnd() * 3.5,
        size,
        phase: rnd() * Math.PI * 2,
        response: 0.5 + 0.95 * agility,
        trail: new Float32Array(TRAIL_SAMPLES * 3),
        trailHead: -1,
        trailCount: 0,
        nx: 0,
        ny: 0,
        nz: 0,
        neighbors: 0,
        dx: 0,
        dy: 0,
        dz: 0,
        dvx: 0,
        dvy: 0,
        dvz: 0,
        sx: 0,
        sy: 0,
        sz: 0,
      };
      recordTrail(bird);
      this.birds.push(bird);
    }
  }

  scatter() {
    const { x, y, z } = this.measure();
    for (const bird of this.birds) {
      const dx = bird.x - x + (this.random() - 0.5) * 7;
      const dy = bird.y - y + (this.random() - 0.5) * 7;
      const dz = bird.z - z + (this.random() - 0.5) * 7;
      const impulse = (15 + this.random() * 11) / (Math.hypot(dx, dy, dz) || 1);
      bird.vx += dx * impulse;
      bird.vy += dy * impulse;
      bird.vz += dz * impulse;
      const limit = Math.min(1, 36 / (Math.hypot(bird.vx, bird.vy, bird.vz) || 1));
      bird.vx *= limit;
      bird.vy *= limit;
      bird.vz *= limit;
    }
  }

  collectNeighbors() {
    collectNeighbors(this.birds);
  }

  step(dt = STEP) {
    this.collectNeighbors();
    const cfg = this.settings;
    const leader = cfg.leader ? this.birds[0] : null;
    const target = leader && route(START_PHASE + (this.time + dt) * ROUTE_RATE);
    const blend = cfg.momentum ? 1 - Math.exp(-1.65 * dt) : 1;
    for (const b of this.birds) {
      if (b === leader) {
        // Only the leader knows the route. Direct steering changes this one velocity only.
        const vx = target.vx + (target.x - b.x) * 1.28;
        const vy = target.vy + (target.y - b.y) * 1.28;
        const vz = target.vz + (target.z - b.z) * 1.28;
        const limit = Math.min(1, 24 / (Math.hypot(vx, vy, vz) || 1));
        b.nx = b.vx + (vx * limit - b.vx) * blend;
        b.ny = b.vy + (vy * limit - b.vy) * blend;
        b.nz = b.vz + (vz * limit - b.vz) * blend;
        continue;
      }
      let { ax, ay, az } = localSteering(b, cfg);
      if (leader && cfg.gravity > 0) {
        const dx = leader.x - b.x,
          dy = leader.y - b.y,
          dz = leader.z - b.z;
        const distance = Math.hypot(dx, dy, dz);
        const pull = (cfg.gravity * 26 * b.response * gravityGain(distance, cfg.radius)) / (distance || 1);
        ax += dx * pull;
        ay += dy * pull;
        az += dz * pull;
      }
      const speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
      const cruise = ((b.cruise - speed) * 0.78) / speed;
      const phase = this.time * 0.76 + b.phase;
      ax += b.vx * cruise + 0.52 * Math.sin(phase);
      ay += b.vy * cruise + 0.54 * Math.sin(phase * 1.3);
      az += b.vz * cruise + 0.54 * Math.cos(phase * 0.87);
      const accel = Math.min(1, (13 + 10 * b.response) / (Math.hypot(ax, ay, az) || 1));
      b.nx = b.vx + ax * accel * dt;
      b.ny = b.vy + ay * accel * dt;
      b.nz = b.vz + az * accel * dt;
    }
    this.time += dt;
    this.trailClock += dt;
    const sample = this.trailClock >= HISTORY_INTERVAL;
    if (sample) this.trailClock -= HISTORY_INTERVAL;
    for (const b of this.birds) {
      b.vx = b.nx;
      b.vy = b.ny;
      b.vz = b.nz;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (sample) recordTrail(b);
    }
  }

  measure() {
    let x = 0,
      y = 0,
      z = 0,
      speed = 0,
      hx = 0,
      hy = 0,
      hz = 0;
    for (const b of this.birds) {
      x += b.x;
      y += b.y;
      z += b.z;
      const v = Math.hypot(b.vx, b.vy, b.vz);
      speed += v;
      if (v > 0) {
        hx += b.vx / v;
        hy += b.vy / v;
        hz += b.vz / v;
      }
    }
    const n = this.birds.length;
    x /= n;
    y /= n;
    z /= n;
    let variance = 0;
    for (const b of this.birds) variance += (b.x - x) ** 2 + (b.y - y) ** 2 + (b.z - z) ** 2;
    return {
      x,
      y,
      z,
      speed: speed / n,
      agreement: Math.hypot(hx, hy, hz) / n,
      radius: Math.sqrt(variance / n),
    };
  }
}
