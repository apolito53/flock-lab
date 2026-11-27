import {
  STEP,
  TRAIL_SAMPLES,
  collectNeighbors,
  gravityGain,
  localSteering,
  randomGenerator,
  recordTrail,
} from '../3d-flocking/swarm.mjs';
import { avoidWreck, slidePastWreck, wreckBlocks } from './wreck.mjs';

export const FLEETS = [
  { name: 'Meridian', color: '#64e4e1', rgb: '90,221,225' },
  { name: 'Vesper', color: '#cc94ff', rgb: '197,128,255' },
];
export const WING_SIZE = 6;
export const FLEET_SIZE = WING_SIZE * 3;
export const ROUND_LIMIT = 105;
const RULES = { alignment: 0.58, cohesion: 0.49, separation: 0.85 };
const SPLIT_RULES = { alignment: 0.37, cohesion: 0.27, separation: 1.1 };
const MAX_SHIELD = 2,
  MAX_HULL = 2;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function unit(x, y, z) {
  const d = Math.hypot(x, y, z) || 1;
  return [x / d, y / d, z / d];
}

export class Battle {
  constructor(seed = 5317) {
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed >>> 0;
    this.random = randomGenerator(this.seed);
    this.time = 0;
    this.ticks = 0;
    this.order = 'engage';
    this.outcome = null;
    this.shots = [];
    this.flashes = [];
    this.events = [];
    this.hitCount = [0, 0];
    this.wings = [];
    this.ships = [];
    this.fleets = [[], []];
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1;
      for (let index = 0; index < 3; index++) {
        const wing = { side, index, members: [], leg: 0, breakaway: false, goal: null };
        this.wings.push(wing);
        for (let slot = 0; slot < WING_SIZE; slot++) {
          const row = Math.ceil(slot / 2),
            flank = slot % 2 ? 1 : -1;
          const ship = {
            id: this.ships.length,
            side,
            wing,
            slot,
            alive: true,
            x: sign * (-43 - row * 3) + (this.random() - 0.5) * 2.4,
            y: (index - 1) * 9 * sign + flank * row * 0.8 + (this.random() - 0.5) * 1.5,
            z: (index - 1) * 20 + flank * row * 2.4 + (side ? 4 : -4) + (this.random() - 0.5) * 2,
            vx: sign * (10 + this.random() * 3),
            vy: (this.random() - 0.5) * 2,
            vz: (this.random() - 0.5) * 2,
            hx: sign,
            hy: 0,
            hz: 0,
            bank: 0,
            phase: this.random() * Math.PI * 2,
            agility: 0.84 + this.random() * 0.36,
            target: null,
            retarget: 0,
            cooldown: 0.3 + this.random() * 1.9,
            shield: MAX_SHIELD,
            hull: MAX_HULL,
            lastHit: -20,
            lit: 0,
            trail: new Float32Array(TRAIL_SAMPLES * 3),
            trailHead: -1,
            trailCount: 0,
          };
          recordTrail(ship);
          this.ships.push(ship);
          this.fleets[side].push(ship);
          wing.members.push(ship);
        }
      }
    }
  }

  issue(order) {
    if (this.outcome || !['engage', 'split', 'rally'].includes(order) || this.order === order)
      return false;
    this.order = order;
    for (const wing of this.wings)
      if (wing.side === 0) {
        wing.leg = 0;
        wing.breakaway = false;
        wing.goal = null;
      }
    return true;
  }

  chooseLeg(wing, lead, foes, order) {
    const rnd = this.random;
    const side = wing.side === 0 ? 1 : -1;
    if (order === 'rally') {
      const phase = this.time * 0.47 + wing.index * 2;
      wing.goal = {
        x: -side * 43 + Math.cos(phase) * 8,
        y: (wing.index - 1) * 8 + Math.sin(phase) * 5,
        z: (wing.index - 1) * 15 + Math.cos(phase) * 6,
      };
      wing.leg = 0.7;
      return;
    }
    const split = order === 'split';
    const lane = (wing.index - 1) * side;
    if (wing.goal) wing.breakaway = !wing.breakaway;
    if (wing.breakaway) {
      const [vx, vy, vz] = unit(lead.vx, lead.vy, lead.vz);
      const curve = lane || Math.sign(Math.sin(lead.phase + this.time)) || 1;
      wing.goal = {
        x: lead.x + vx * 27 - vz * curve * 11,
        y: lead.y + vy * 12 + curve * (split ? 21 : 12),
        z: lead.z + vz * 27 + vx * curve * 14,
      };
      wing.leg = 1.7 + rnd() * 1.0;
    } else {
      // Each wing aims to cross a different pack, then carries its velocity out of the pass.
      const matching = foes.filter((s) => s.wing.index === wing.index);
      const pack = matching.length ? matching : foes;
      const foe = pack[Math.floor(rnd() * pack.length)];
      const [dx, dy, dz] = unit(foe.x - lead.x, foe.y - lead.y, foe.z - lead.z);
      wing.goal = {
        x: foe.x + dx * 15,
        y: foe.y + dy * 8 + (split ? lane * 17 : Math.sin(lead.phase + this.time) * 5),
        z: foe.z + dz * 14 + (split ? lane * 9 : 0),
      };
      wing.leg = clamp(distance(lead, foe) / 16 + 0.9, 1.6, 5.3);
    }
    wing.goal.x = clamp(wing.goal.x, -53, 53);
    wing.goal.y = clamp(wing.goal.y, -25, 25);
    wing.goal.z = clamp(wing.goal.z, -40, 40);
  }

  steer(s, lead, order, foes, dt) {
    const rally = order === 'rally',
      split = order === 'split';
    let { ax, ay, az } = localSteering(s, split ? SPLIT_RULES : RULES);
    const goal = s.wing.goal;
    const [gx, gy, gz] = unit(goal.x - s.x, goal.y - s.y, goal.z - s.z);
    const speed = (rally ? 13 : split ? 21 : 18) * s.agility;
    let wx = gx * speed,
      wy = gy * speed,
      wz = gz * speed;
    if (s !== lead) {
      const dx = lead.x - s.x,
        dy = lead.y - s.y,
        dz = lead.z - s.z;
      const d = Math.hypot(dx, dy, dz);
      const pull = ((rally ? 22 : split ? 8 : 15) * gravityGain(d, 76)) / (d || 1);
      ax += dx * pull;
      ay += dy * pull;
      az += dz * pull;
      wx = wx * 0.58 + lead.vx * 0.42;
      wy = wy * 0.58 + lead.vy * 0.42;
      wz = wz * 0.58 + lead.vz * 0.42;
    }
    const [ox, oy, oz] = avoidWreck(s);
    ax += (wx - s.vx) * 1.35 + ox;
    ay += (wy - s.vy) * 1.35 + oy;
    az += (wz - s.vz) * 1.35 + oz;
    const limit = Math.min(1, (30 * s.agility) / (Math.hypot(ax, ay, az) || 1));
    s.nx = s.vx + ax * dt * limit;
    s.ny = s.vy + ay * dt * limit;
    s.nz = s.vz + az * dt * limit;
    s.nextBank = clamp((s.vx * az - s.vz * ax) * 0.0024, -0.83, 0.83);
    s.retarget -= dt;
    if (!s.target?.alive || s.retarget <= 0) {
      let best = Infinity;
      for (const enemy of foes) {
        const rank = distance(s, enemy) + this.random() * 17;
        if (rank < best) {
          best = rank;
          s.target = enemy;
        }
      }
      s.retarget = 0.9 + this.random() * 1.15;
    }
    const foe = s.target;
    const facing =
      foe && !rally && distance(s, foe) < 42
        ? unit(foe.x - s.x, foe.y - s.y, foe.z - s.z)
        : unit(s.nx, s.ny, s.nz);
    const ease = 1 - Math.exp(-dt * 3.8 * s.agility);
    [s.hx, s.hy, s.hz] = unit(
      s.hx + (facing[0] - s.hx) * ease,
      s.hy + (facing[1] - s.hy) * ease,
      s.hz + (facing[2] - s.hz) * ease,
    );
  }

  fire(s) {
    const foe = s.target;
    if (s.cooldown > 0 || !foe?.alive || (s.side === 0 && this.order === 'rally')) return;
    const dx = foe.x - s.x,
      dy = foe.y - s.y,
      dz = foe.z - s.z,
      range = Math.hypot(dx, dy, dz);
    if (
      range > 38 ||
      range < 0.01 ||
      (dx * s.hx + dy * s.hy + dz * s.hz) / range < 0.72 ||
      wreckBlocks(s, foe)
    )
      return;
    const rnd = this.random,
      hit = rnd() < 0.76;
    const miss = hit
      ? [0, 0, 0]
      : unit(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).map((v) => v * (2.4 + rnd() * 2.8));
    const x = s.x + s.hx * 1.55,
      y = s.y + s.hy * 1.55,
      z = s.z + s.hz * 1.55;
    this.shots.push({
      side: s.side,
      target: foe,
      hit,
      miss,
      x,
      y,
      z,
      start: [x, y, z],
      end: [foe.x + miss[0], foe.y + miss[1], foe.z + miss[2]],
      age: 0,
      duration: 0.1 + range * 0.009,
    });
    this.events.push({ type: 'shot', side: s.side });
    s.cooldown = 1.15 + rnd() * 1.45;
  }

  hit(s, side) {
    this.hitCount[side]++;
    s.lastHit = this.time;
    s.lit = 0.26;
    if (s.shield >= 1) s.shield -= 1;
    else {
      s.shield = 0;
      s.hull -= 1;
    }
    const dead = s.hull <= 0;
    if (dead) s.alive = false;
    this.flashes.push({
      x: s.x,
      y: s.y,
      z: s.z,
      vx: s.vx * 0.22,
      vy: s.vy * 0.22,
      vz: s.vz * 0.22,
      age: 0,
      life: dead ? 1.1 : 0.31,
      dead,
      side: s.side,
      phase: s.phase,
    });
    this.events.push({ type: dead ? 'loss' : 'hit', side: s.side });
  }

  finish() {
    const counts = this.fleets.map((f) => f.length);
    if (counts.every((n) => n > 0) && this.time + 1e-7 < ROUND_LIMIT) return;
    const health = this.fleets.map((f) => f.reduce((n, s) => n + s.hull + s.shield, 0));
    const difference = counts[0] - counts[1] || health[0] - health[1];
    const winner = Math.abs(difference) < 1e-6 ? null : difference > 0 ? 0 : 1;
    this.outcome = { winner, counts, reason: counts.includes(0) ? 'elimination' : 'time' };
    this.shots.length = 0;
  }

  step(dt = STEP) {
    if (this.outcome) return;
    this.time += dt;
    this.ticks++;
    this.events.length = 0;
    const alive = this.fleets;
    for (const f of alive) collectNeighbors(f);
    for (const wing of this.wings) {
      const lead = wing.members.find((s) => s.alive);
      if (!lead) continue;
      const order = wing.side === 0 ? this.order : 'engage';
      const foes = alive[1 - wing.side];
      wing.leg -= dt;
      if (wing.leg <= 0 || !wing.goal || (order !== 'rally' && distance(lead, wing.goal) < 6))
        this.chooseLeg(wing, lead, foes, order);
      for (const s of wing.members) if (s.alive) this.steer(s, lead, order, foes, dt);
    }
    const trailSample = this.ticks % 6 === 0;
    for (const s of this.ships)
      if (s.alive) {
        s.vx = s.nx;
        s.vy = s.ny;
        s.vz = s.nz;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        slidePastWreck(s);
        s.bank += (s.nextBank - s.bank) * (1 - Math.exp(-5 * dt));
        s.lit = Math.max(0, s.lit - dt);
        s.cooldown -= dt;
        if (s.side === 0 && this.order === 'rally' && this.time - s.lastHit > 1.4)
          s.shield = Math.min(MAX_SHIELD, s.shield + 0.58 * dt);
        if (trailSample) recordTrail(s);
      }
    for (const s of this.ships) if (s.alive) this.fire(s);
    for (const e of this.flashes) {
      e.age += dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.z += e.vz * dt;
    }
    this.flashes = this.flashes.filter((e) => e.age < e.life);
    // Resolve contacts together, after both fleets have had the same tick to fire.
    const contacts = [];
    this.shots = this.shots.filter((bolt) => {
      const target = bolt.target;
      if (target.alive)
        bolt.end = [target.x + bolt.miss[0], target.y + bolt.miss[1], target.z + bolt.miss[2]];
      bolt.age += dt;
      const t = Math.min(1, bolt.age / bolt.duration);
      const next = {
        x: bolt.start[0] + (bolt.end[0] - bolt.start[0]) * t,
        y: bolt.start[1] + (bolt.end[1] - bolt.start[1]) * t,
        z: bolt.start[2] + (bolt.end[2] - bolt.start[2]) * t,
      };
      if (wreckBlocks(bolt, next)) return false;
      Object.assign(bolt, next);
      if (t < 1) return true;
      if (bolt.hit && target.alive) contacts.push(bolt);
      return false;
    });
    for (const bolt of contacts) if (bolt.target.alive) this.hit(bolt.target, bolt.side);
    if (contacts.length) this.fleets = this.fleets.map((f) => f.filter((s) => s.alive));
    this.finish();
  }
}
