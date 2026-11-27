import { Observer } from '../3d-flocking/observer.mjs';
import { TRAIL_SAMPLES } from '../3d-flocking/swarm.mjs';
import { FLEETS } from './battle.mjs';
import { carrierMesh } from './wreck.mjs';
import { Sky } from './sky.mjs';

const TAU = Math.PI * 2;
const HOME_YAW = 0.08;
const HOME_PITCH = 0.69;
// Local vertices are right, up, nose. Meridian has twin engines; Vesper has forward-swept forks.
const MODELS = [
  {
    vertices: [
      [0, 0, 2.15],
      [0, 0.46, 0.25],
      [0, -0.31, 0.02],
      [-0.53, 0, -1.05],
      [0.53, 0, -1.05],
      [-1.66, -0.09, -1.24],
      [1.66, -0.09, -1.24],
      [-0.72, 0.12, -0.4],
      [0.72, 0.12, -0.4],
      [-0.66, 0.2, -1.48],
      [0.66, 0.2, -1.48],
      [0, 0.51, 0.66],
    ],
    panels: [
      [0, 1, 3, 0],
      [0, 4, 1, 1],
      [0, 3, 2, 3],
      [0, 2, 4, 2],
      [1, 5, 3, 1],
      [1, 4, 6, 0],
      [5, 7, 9, 2],
      [6, 10, 8, 1],
      [0, 11, 1, 4],
    ],
    colors: ['#7cb5bd', '#d0ebe7', '#477b8b', '#345368', '#80ffff'],
    engines: [9, 10],
  },
  {
    vertices: [
      [0, 0.06, 1.2],
      [0, 0.49, 0.16],
      [0, -0.29, 0.1],
      [-0.54, 0, -0.77],
      [0.54, 0, -0.77],
      [-1.64, -0.03, 0.27],
      [1.64, -0.03, 0.27],
      [-1.36, 0.11, 1.65],
      [1.36, 0.11, 1.65],
      [-0.94, 0.1, -1.16],
      [0.94, 0.1, -1.16],
      [0, 0.05, -1.54],
      [0, 0.52, 0.49],
    ],
    panels: [
      [0, 1, 3, 0],
      [0, 4, 1, 1],
      [0, 3, 2, 3],
      [0, 2, 4, 2],
      [1, 5, 9, 0],
      [1, 10, 6, 1],
      [5, 7, 3, 1],
      [6, 4, 8, 0],
      [9, 11, 1, 2],
      [1, 11, 10, 1],
      [0, 12, 1, 4],
    ],
    colors: ['#a58bcf', '#f0cefa', '#735991', '#4d406c', '#f5bfff'],
    engines: [11],
  },
];
function polygon(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

export class BattleScene extends Observer {
  constructor(canvas) {
    super(canvas);
    this.sky = new Sky(HOME_YAW, HOME_PITCH);
    this.mesh = carrierMesh();
    this.background = document.createElement('canvas');
    this.wreck = [];
    this.cacheKey = '';
  }
  setView(mode) {
    super.setView(mode);
    if (mode === 'orbit') {
      this.yaw = HOME_YAW;
      this.pitch = HOME_PITCH;
    }
  }
  prepare() {
    super.prepare();
    if (this.width < this.height) this.lens *= 1.26;
    this.cyScreen = this.height * 0.53;
  }
  cache() {
    const key = [
      this.width,
      this.height,
      this.ratio,
      this.mode,
      this.yaw,
      this.pitch,
      this.zoom,
      this.target.x,
      this.target.y,
      this.target.z,
    ].join('/');
    if (key === this.cacheKey) return;
    this.cacheKey = key;
    const ratio = Math.min(1.45, this.ratio);
    this.background.width = Math.max(1, Math.round(this.width * ratio));
    this.background.height = Math.max(1, Math.round(this.height * ratio));
    const ctx = this.background.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.sky.draw({
      width: this.width,
      height: this.height,
      sy: this.sy,
      cy: this.cy,
      sp: this.sp,
      cp: this.cp,
      yaw: this.yaw,
      pitch: this.pitch,
      ctx,
    });
    // Bake nearby hull plates together so moving fighters can pass between depth layers.
    const layers = new Map();
    for (const face of this.mesh) {
      const points = face.vertices.map((v) => this.project(...v));
      if (points.some((point) => point.depth < 6)) continue;
      const depth = this.project(...face.center).depth;
      const index = Math.floor(depth / 5);
      if (!layers.has(index)) layers.set(index, []);
      layers.get(index).push({ points, depth, fill: face.fill });
    }
    const previous = this.wreck;
    this.wreck = [];
    for (const [index, plates] of layers) {
      const points = plates.flatMap((plate) => plate.points);
      const left = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x)) - 1));
      const top = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y)) - 1));
      const right = Math.min(this.width, Math.ceil(Math.max(...points.map((p) => p.x)) + 1));
      const bottom = Math.min(this.height, Math.ceil(Math.max(...points.map((p) => p.y)) + 1));
      const width = right - left,
        height = bottom - top;
      if (width <= 0 || height <= 0) continue;
      const image = previous[this.wreck.length]?.image ?? document.createElement('canvas');
      image.width = Math.ceil(width * ratio);
      image.height = Math.ceil(height * ratio);
      const layer = image.getContext('2d');
      layer.setTransform(ratio, 0, 0, ratio, -left * ratio, -top * ratio);
      layer.lineWidth = 0.55;
      layer.strokeStyle = '#12203560';
      for (const plate of plates.sort((a, b) => b.depth - a.depth)) {
        polygon(layer, plate.points);
        layer.fillStyle = plate.fill;
        layer.fill();
        layer.stroke();
      }
      this.wreck.push({
        kind: 'hull',
        depth: (index + 0.5) * 5,
        image,
        left,
        top,
        width: image.width / ratio,
        height: image.height / ratio,
      });
    }
  }
  fighter(s, p) {
    const ctx = this.ctx,
      faction = FLEETS[s.side],
      shape = MODELS[s.side];
    const flat = Math.hypot(s.hx, s.hz),
      rx = flat > 0.001 ? s.hz / flat : 1,
      rz = flat > 0.001 ? -s.hx / flat : 0;
    const ux = s.hy * rz,
      uy = s.hz * rx - s.hx * rz,
      uz = -s.hy * rx;
    const cos = Math.cos(s.bank),
      sin = Math.sin(s.bank);
    const size = (s.slot === 0 ? 1.25 : 1.03) * Math.max(1, 1.9 / p.scale);
    const verts = shape.vertices.map(([r, u, f]) => {
      const right = (r * cos - u * sin) * size,
        up = (r * sin + u * cos) * size;
      return this.project(
        s.x + rx * right + ux * up + s.hx * f * size,
        s.y + uy * up + s.hy * f * size,
        s.z + rz * right + uz * up + s.hz * f * size,
      );
    });
    const after = this.project(s.x - s.hx * size * 3.4, s.y - s.hy * size * 3.4, s.z - s.hz * size * 3.4);
    for (const index of shape.engines) {
      const e = verts[index];
      ctx.strokeStyle = `rgba(${faction.rgb},.23)`;
      ctx.lineWidth = Math.max(1.6, p.scale * 0.48);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(after.x, after.y);
      ctx.stroke();
    }
    const panels = shape.panels.map(([a, b, c, color]) => ({
      points: [verts[a], verts[b], verts[c]],
      depth: verts[a].depth + verts[b].depth + verts[c].depth,
      color,
    }));
    panels.sort((a, b) => b.depth - a.depth);
    for (const face of panels) {
      polygon(ctx, face.points);
      ctx.fillStyle = s.lit > 0.18 ? '#f1f6ff' : shape.colors[face.color];
      ctx.fill();
    }
    for (const index of shape.engines) {
      const e = verts[index],
        r = Math.max(0.8, p.scale * 0.18);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 2.2, 0, TAU);
      ctx.fillStyle = `rgba(${faction.rgb},.30)`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.fillStyle = faction.color;
      ctx.fill();
    }
  }
  pulse(b, p) {
    const ctx = this.ctx,
      back = Math.max(0, b.age / b.duration - 0.22);
    const a = this.project(...b.start.map((v, i) => v + (b.end[i] - v) * back));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(p.x, p.y);
    ctx.lineWidth = Math.min(5, Math.max(2.4, p.scale * 0.82));
    ctx.strokeStyle = `rgba(${FLEETS[b.side].rgb},.28)`;
    ctx.stroke();
    ctx.lineWidth = Math.max(1.2, p.scale * 0.3);
    ctx.strokeStyle = FLEETS[b.side].color;
    ctx.stroke();
    ctx.fillStyle = '#f3f8ff';
    ctx.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
    ctx.lineCap = 'butt';
  }
  flash(e, p) {
    const ctx = this.ctx,
      t = e.age / e.life,
      alpha = 1 - t;
    if (!e.dead) {
      const r = Math.max(3, p.scale * (1.4 + t * 1.7));
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.86, -0.4, 0, TAU);
      ctx.fillStyle = `rgba(${FLEETS[e.side].rgb},${alpha * 0.15})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${FLEETS[e.side].rgb},${alpha * 0.83})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      return;
    }
    const glow = Math.max(2, p.scale * (2.0 + 3.9 * Math.sin(t * Math.PI)));
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
    g.addColorStop(0, `rgba(255,244,202,${alpha})`);
    g.addColorStop(0.24, `rgba(255,164,89,${alpha * 0.82})`);
    g.addColorStop(1, 'rgba(250,94,62,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - glow, p.y - glow, 2 * glow, 2 * glow);
    for (let k = 0; k < 10; k++) {
      const a = e.phase + k * 2.39996,
        dy = -0.9 + k * 0.2,
        flat = Math.sqrt(Math.max(0, 1 - dy * dy));
      const v = [Math.cos(a) * flat, dy, Math.sin(a) * flat],
        reach = (3.4 + (k % 4) * 1.3) * Math.sqrt(t);
      const end = this.project(e.x + v[0] * reach, e.y + v[1] * reach, e.z + v[2] * reach),
        tail = this.project(
          e.x + v[0] * reach * 0.77,
          e.y + v[1] * reach * 0.77,
          e.z + v[2] * reach * 0.77,
        );
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(end.x, end.y);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = `rgba(255,${182 + k * 4},134,${alpha})`;
      ctx.stroke();
    }
  }
  drawBattle(battle, trails) {
    this.prepare();
    this.cache();
    const ctx = this.ctx;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.drawImage(this.background, 0, 0, this.width, this.height);
    const items = this.wreck.slice();
    for (const s of battle.ships) {
      if (!s.alive) continue;
      const p = this.project(s.x, s.y, s.z);
      if (p.depth <= 6) continue;
      if (trails)
        for (const [from, to, alpha] of [
          [8, 16, 0.14],
          [3, 8, 0.32],
          [0, 3, 0.6],
        ]) {
          if (s.trailCount <= from) continue;
          const age = Math.min(s.trailCount, Math.ceil((from + to) / 2));
          const i = ((s.trailHead + TRAIL_SAMPLES - age + 1) % TRAIL_SAMPLES) * 3;
          const depth = this.project(s.trail[i], s.trail[i + 1], s.trail[i + 2]).depth;
          items.push({ kind: 'trail', depth: depth + 0.12, ship: s, from, to, alpha });
        }
      items.push({ kind: 'fighter', depth: p.depth, ship: s, p });
    }
    for (const [kind, objects] of [
      ['pulse', battle.shots],
      ['flash', battle.flashes],
    ])
      for (const obj of objects) {
        const p = this.project(obj.x, obj.y, obj.z);
        if (p.depth > 6) items.push({ kind, depth: p.depth - 0.08, obj, p });
      }
    items.sort((a, b) => b.depth - a.depth);
    for (const item of items) {
      if (item.kind === 'hull') {
        ctx.drawImage(item.image, item.left, item.top, item.width, item.height);
      } else if (item.kind === 'trail') {
        ctx.beginPath();
        this.trailPath(item.ship, item.from, item.to);
        ctx.strokeStyle = `rgba(${FLEETS[item.ship.side].rgb},${item.alpha})`;
        ctx.lineWidth = item.from === 0 ? 1.35 : 1;
        ctx.stroke();
      } else if (item.kind === 'fighter') this.fighter(item.ship, item.p);
      else if (item.kind === 'pulse') this.pulse(item.obj, item.p);
      else this.flash(item.obj, item.p);
    }
  }
}
