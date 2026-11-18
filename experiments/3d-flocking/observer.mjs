import { BOUNDS, TRAIL_SAMPLES } from './swarm.mjs';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const TAU = 2 * Math.PI;
const HOME_YAW = -0.49;
const HOME_PITCH = 0.28;
const DISTANCE = 208;

export class Observer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.setView('orbit');
    // Reference specks are stationary in world space. Parallax makes small camera movements legible.
    let seed = 7283;
    const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
    this.specks = Array.from({ length: 440 }, () => ({
      x: (random() - 0.5) * 270,
      y: (random() - 0.5) * 122,
      z: (random() - 0.5) * 195,
      brightness: random(),
    }));
  }

  setView(mode) {
    this.mode = mode;
    this.yaw = mode === 'orbit' ? HOME_YAW : 0;
    this.pitch = mode === 'top' ? Math.PI / 2 : mode === 'side' ? 0 : HOME_PITCH;
    this.zoom = 1;
    this.target = { x: 0, y: 0, z: 0 };
  }

  rotate(dx, dy) {
    this.mode = 'orbit';
    this.yaw -= dx * 0.007;
    this.pitch = clamp(this.pitch + dy * 0.007, -1.52, 1.52);
  }

  magnify(ratio) {
    this.zoom = clamp(this.zoom * ratio, 0.49, 2.9);
  }

  pan(dx, dy) {
    const units = DISTANCE / this.lens;
    const x = this.target.x + (-dx * this.cy - dy * this.sy * this.sp) * units;
    const y = this.target.y + dy * this.cp * units;
    const z = this.target.z + (dx * this.sy - dy * this.cy * this.sp) * units;
    this.target = { x: clamp(x, -85, 85), y: clamp(y, -55, 55), z: clamp(z, -85, 85) };
  }

  resize(width, height, pixelRatio) {
    this.width = width;
    this.height = height;
    this.ratio = Math.min(2, pixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(width * this.ratio));
    this.canvas.height = Math.max(1, Math.round(height * this.ratio));
  }

  prepare() {
    this.sy = Math.sin(this.yaw);
    this.cy = Math.cos(this.yaw);
    this.sp = Math.sin(this.pitch);
    this.cp = Math.cos(this.pitch);
    this.lens = Math.min(this.height * 1.7, this.width * 1.11) * this.zoom;
    this.cx = this.width * 0.5;
    this.cyScreen = this.height * (this.mode === 'orbit' ? 0.42 : 0.5);
  }

  project(x, y, z) {
    x -= this.target.x;
    y -= this.target.y;
    z -= this.target.z;
    const longitudinal = x * this.sy + z * this.cy;
    const depth = DISTANCE - longitudinal * this.cp - y * this.sp;
    const scale = this.lens / (this.mode === 'orbit' ? Math.max(6, depth) : DISTANCE);
    return {
      x: this.cx + (x * this.cy - z * this.sy) * scale,
      y: this.cyScreen - (y * this.cp - longitudinal * this.sp) * scale,
      depth,
      scale,
    };
  }

  // Call inside an open canvas path. Splitting at the near plane avoids drawing through the camera.
  segment(x1, y1, z1, x2, y2, z2) {
    const a = this.project(x1, y1, z1),
      b = this.project(x2, y2, z2);
    if (a.depth <= 6 || b.depth <= 6) return;
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
  }

  environment() {
    const ctx = this.ctx;
    for (const s of this.specks) {
      const p = this.project(s.x, s.y, s.z);
      if (p.depth < 15 || p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) continue;
      ctx.fillStyle = s.brightness > 0.9 ? '#a1c9bd55' : '#b0c9bd27';
      const size = s.brightness > 0.9 ? 1.2 : 0.8;
      ctx.fillRect(p.x, p.y, size, size);
    }
    const { x, y, z } = BOUNDS;
    const corners = [
      [-x, -z],
      [x, -z],
      [x, z],
      [-x, z],
    ];
    ctx.beginPath();
    for (let i = 0; i < corners.length; i++) {
      const p = this.project(corners[i][0], -y, corners[i][1]);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(58,102,91,.055)';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = -60; i <= 60; i += 10) this.segment(i, -y, -z, i, -y, z);
    for (let i = -50; i <= 50; i += 10) this.segment(-x, -y, i, x, -y, i);
    ctx.strokeStyle = 'rgba(132,177,163,.145)';
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < corners.length; i++) {
      const [a, b] = corners[i],
        [c, d] = corners[(i + 1) % corners.length];
      this.segment(a, -y, b, c, -y, d);
      this.segment(a, -y, b, a, y, b);
      this.segment(a, y, b, a - Math.sign(a) * 5, y, b);
      this.segment(a, y, b, a, y, b - Math.sign(b) * 5);
    }
    ctx.strokeStyle = 'rgba(132,177,163,.20)';
    ctx.stroke();
    // Mid-height ticks on the four posts distinguish altitude from a flat grid.
    ctx.beginPath();
    for (const [a, b] of corners)
      for (let h = -20; h <= 20; h += 10) this.segment(a, h, b, a - Math.sign(a) * 1.4, h, b);
    ctx.strokeStyle = 'rgba(151,193,178,.31)';
    ctx.stroke();
  }

  fieldSphere(b, radius) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(243,193,125,.33)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    for (let plane = 0; plane < 3; plane++) {
      ctx.beginPath();
      let pending = true;
      for (let i = 0; i <= 144; i++) {
        const angle = (TAU * i) / 144,
          a = Math.cos(angle) * radius,
          c = Math.sin(angle) * radius;
        const p = this.project(
          b.x + (plane === 2 ? 0 : a),
          b.y + (plane === 0 ? 0 : plane === 1 ? c : a),
          b.z + (plane === 1 ? 0 : c),
        );
        if (p.depth <= 6) {
          pending = true;
          continue;
        }
        if (pending) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        pending = false;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  trailPath(b, from, to) {
    const ctx = this.ctx;
    const last = Math.min(to, b.trailCount);
    if (from >= last) return;
    for (let age = from; age <= last; age++) {
      let p;
      if (age === 0) p = this.project(b.x, b.y, b.z);
      else {
        const offset = ((b.trailHead + TRAIL_SAMPLES - age + 1) % TRAIL_SAMPLES) * 3;
        p = this.project(b.trail[offset], b.trail[offset + 1], b.trail[offset + 2]);
      }
      if (age === from) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
  }

  trails(swarm) {
    const ctx = this.ctx,
      leader = swarm.settings.leader ? swarm.birds[0] : null;
    const bands = [
      [10, TRAIL_SAMPLES, 0.07],
      [4, 10, 0.14],
      [0, 4, 0.27],
    ];
    for (const [from, to, alpha] of bands) {
      ctx.beginPath();
      for (const b of swarm.birds) if (b !== leader) this.trailPath(b, from, to);
      ctx.lineWidth = 0.85;
      ctx.strokeStyle = `rgba(111,205,198,${alpha})`;
      ctx.stroke();
      if (leader) {
        ctx.beginPath();
        this.trailPath(leader, from, to);
        ctx.lineWidth = 1.45;
        ctx.strokeStyle = `rgba(255,193,112,${Math.min(1, alpha * 2.65)})`;
        ctx.stroke();
      }
    }
  }

  glider(b, center, leader) {
    const ctx = this.ctx;
    const speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
    const fx = b.vx / speed,
      fy = b.vy / speed,
      fz = b.vz / speed;
    const flat = Math.hypot(fx, fz);
    const rx = flat > 0.001 ? fz / flat : 1,
      rz = flat > 0.001 ? -fx / flat : 0;
    const ux = fy * rz,
      uy = fz * rx - fx * rz,
      uz = -fy * rx;
    const size = b.size * (leader ? 1.42 : 1);
    const vertex = (forward, side, up) =>
      this.project(
        b.x + size * (fx * forward + rx * side + ux * up),
        b.y + size * (fy * forward + uy * up),
        b.z + size * (fz * forward + rz * side + uz * up),
      );
    const tip = vertex(1.42, 0, 0),
      left = vertex(-0.9, -0.75, 0),
      right = vertex(-0.9, 0.75, 0),
      keel = vertex(-0.45, 0, 0.38);
    const light = clamp(1.18 - (center.depth - (DISTANCE - 72)) / 310, 0.53, 1.14);
    const hue = 178 + Math.sin(b.phase) * 8;
    const face = (a, c, d, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    };
    face(tip, left, keel, leader ? '#ffdf9c' : `hsl(${hue} 53% ${Math.round(74 * light)}%)`);
    face(tip, keel, right, leader ? '#d69855' : `hsl(${hue + 7} 39% ${Math.round(51 * light)}%)`);
    ctx.beginPath();
    ctx.moveTo(keel.x, keel.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineWidth = leader ? 1.2 : 0.67;
    ctx.strokeStyle = leader ? '#fff0bc' : `rgba(214,255,232,${light * 0.76})`;
    ctx.stroke();
  }

  leaderMarker(b, point) {
    if (point.x < 0 || point.y < 0 || point.x > this.width || point.y > this.height) return;
    const ctx = this.ctx,
      x = point.x,
      y = point.y;
    const r = clamp(point.scale * 2.45, 8, 17);
    ctx.beginPath();
    ctx.arc(x, y, r, -0.23, 1.06);
    ctx.strokeStyle = '#e6b879bb';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI - 0.23, Math.PI + 1.06);
    ctx.stroke();
    const dir = x > this.width - 83 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x + dir * r * 0.7, y - r * 0.7);
    ctx.lineTo(x + dir * (r + 5), y - r - 5);
    ctx.lineTo(x + dir * (r + 12), y - r - 5);
    ctx.stroke();
    ctx.font = '9px "IBM Plex Mono",Consolas,monospace';
    ctx.textAlign = dir > 0 ? 'left' : 'right';
    ctx.fillStyle = '#f0c78f';
    ctx.fillText('LEADER', x + dir * (r + 15), y - r - 2);
    ctx.textAlign = 'left';
  }

  triad() {
    const ctx = this.ctx,
      x = this.width - 42,
      y = 42;
    const axes = [
      ['X', this.cy, -this.sy * this.sp, '#dca68d'],
      ['Y', 0, this.cp, '#a7dabb'],
      ['Z', -this.sy, -this.cy * this.sp, '#8ebbdc'],
    ];
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.font = '9px "IBM Plex Mono",Consolas,monospace';
    for (const [name, dx, dy, color] of axes) {
      if (Math.hypot(dx, dy) < 0.16) continue;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 16, y - dy * 16);
      ctx.stroke();
      ctx.fillText(name, x + dx * 24, y - dy * 24 + 3);
    }
    ctx.fillStyle = '#c3d8cc';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, TAU);
    ctx.fill();
    ctx.textAlign = 'left';
  }

  draw(swarm, options) {
    this.prepare();
    const ctx = this.ctx;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.environment();
    const leader = swarm.settings.leader ? swarm.birds[0] : null;
    if (leader) {
      if (options.sphere) this.fieldSphere(leader, swarm.settings.radius);
      ctx.beginPath();
      ctx.setLineDash([2.2, 5]);
      this.segment(leader.x, -BOUNDS.y, leader.z, leader.x, leader.y, leader.z);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#ecc58b48';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (options.trails) this.trails(swarm);
    const visible = swarm.birds.map((b) => ({ bird: b, point: this.project(b.x, b.y, b.z) }));
    visible.sort((a, b) => b.point.depth - a.point.depth);
    for (const { bird, point } of visible) {
      if (
        point.depth > 6 &&
        point.x > -14 &&
        point.y > -14 &&
        point.x < this.width + 14 &&
        point.y < this.height + 14
      )
        this.glider(bird, point, bird === leader);
    }
    if (leader) this.leaderMarker(leader, this.project(leader.x, leader.y, leader.z));
    this.triad();
  }
}
