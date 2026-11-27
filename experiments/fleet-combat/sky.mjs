import { randomGenerator } from '../3d-flocking/swarm.mjs';

const random = randomGenerator(18731);
const lattice = Float32Array.from({ length: 256 * 256 }, () => random());
const ease = (t) => t * t * (3 - 2 * t);
function noise(x, y) {
  const i = Math.floor(x),
    j = Math.floor(y),
    u = ease(x - i),
    v = ease(y - j);
  const row = (j & 255) * 256,
    next = ((j + 1) & 255) * 256,
    left = i & 255,
    right = (i + 1) & 255;
  return (
    (lattice[row + left] * (1 - u) + lattice[row + right] * u) * (1 - v) +
    (lattice[next + left] * (1 - u) + lattice[next + right] * u) * v
  );
}
function cloud(x, y) {
  return (
    noise(x, y) * 0.54 +
    noise(x * 2.1 + 8, y * 2.1) * 0.27 +
    noise(x * 4.6, y * 4.6 + 5) * 0.13 +
    noise(x * 9.3, y * 9.3) * 0.06
  );
}
function plate(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d'),
    image = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) paint(image.data, 4 * (y * w + x), x / w, y / h);
  ctx.putImageData(image, 0, 0);
  return c;
}
function nebula() {
  return plate(660, 300, (out, i, u, v) => {
    const warp = cloud(u * 5 + 31, v * 4 + 3);
    const ridge = v - (0.62 - 0.32 * u + 0.1 * Math.sin(u * 8) + 0.37 * (warp - 0.5));
    const grain = cloud(u * 14 + warp * 7, v * 9 + warp * 4);
    const broad = Math.exp(-ridge * ridge * 12) * (0.28 + grain * 0.8);
    const thread = Math.exp(-Math.abs(ridge) * 10) * Math.pow(grain, 2.2);
    const veins = cloud(u * 24 + warp * 11, v * 22) * thread;
    const purple = ease(Math.max(0, Math.min(1, (u - 0.18) * 1.42)));
    out[i] = 6 + broad * (7 + purple * 16) + thread * (16 + purple * 35) + veins * 22;
    out[i + 1] = 10 + broad * (15 - purple * 5) + thread * (26 - purple * 8) + veins * 30;
    out[i + 2] = 23 + broad * (22 + purple * 9) + thread * (34 + purple * 18) + veins * 42;
    out[i + 3] = 255;
  });
}
function planet() {
  return plate(300, 300, (out, i, u, v) => {
    const x = (u - 0.5) * 2.12,
      y = (v - 0.5) * 2.12,
      r = Math.hypot(x, y);
    if (r > 1.045) return;
    if (r > 1) {
      const lit = Math.max(0, -x * 0.76 - y * 0.65);
      out[i] = 133;
      out[i + 1] = 186;
      out[i + 2] = 219;
      out[i + 3] = 160 * lit * Math.exp(-(r - 1) * 105);
      return;
    }
    const z = Math.sqrt(1 - r * r),
      lat = y + 0.14 * x;
    const eddy = cloud(x * 6 + 3, z * 5 + lat * 3),
      swirls = cloud(11 * x + 5 * eddy, 27 * lat + 5 * eddy);
    const band =
      0.52 +
      0.28 * Math.sin(33 * lat + eddy * 5) +
      0.11 * Math.sin(lat * 102 + swirls * 5) +
      0.12 * swirls;
    const light = Math.max(0, -x * 0.7 - y * 0.55 + z * 0.18),
      rim = (1 - z) ** 4 * Math.max(0, -x * 0.78 - y * 0.62);
    const shade = 0.09 + light * 0.9;
    out[i] = 8 + (62 + band * 75) * shade + rim * 80;
    out[i + 1] = 14 + (79 + band * 86) * shade + rim * 115;
    out[i + 2] = 28 + (92 + band * 91) * shade + rim * 125;
    out[i + 3] = 255;
  });
}

export class Sky {
  constructor(yaw, pitch) {
    this.cloud = nebula();
    this.planet = planet();
    const rnd = randomGenerator(11753);
    this.stars = Array.from({ length: 4300 }, () => {
      const angle = rnd() * Math.PI * 2,
        y = rnd() * 2 - 1,
        flat = Math.sqrt(1 - y * y);
      return {
        x: Math.cos(angle) * flat,
        y,
        z: Math.sin(angle) * flat,
        power: rnd(),
        warm: rnd() > 0.79,
      };
    });
    // Place the moon in the sky relative to the home camera, then let it move naturally out of view.
    const sx = 0.34,
      sy = 0.17;
    this.homeYaw = yaw;
    this.homePitch = pitch;
    this.moon = {
      x: -Math.sin(yaw) * Math.cos(pitch) + sx * Math.cos(yaw) - sy * Math.sin(yaw) * Math.sin(pitch),
      y: -Math.sin(pitch) + sy * Math.cos(pitch),
      z: -Math.cos(yaw) * Math.cos(pitch) - sx * Math.sin(yaw) - sy * Math.cos(yaw) * Math.sin(pitch),
    };
  }
  project(c, v, focal) {
    const along = v.x * c.sy + v.z * c.cy;
    const depth = -along * c.cp - v.y * c.sp;
    if (depth < 0.25) return null;
    return {
      x: c.width * 0.5 + ((v.x * c.cy - v.z * c.sy) * focal) / depth,
      y: c.height * 0.5 - ((v.y * c.cp - along * c.sp) * focal) / depth,
      depth,
    };
  }
  draw(c) {
    const ctx = c.ctx,
      w = c.width,
      h = c.height,
      focal = Math.min(w * 0.89, h * 1.43);
    const offsetX = Math.sin(c.yaw - this.homeYaw) * w * 0.09,
      offsetY = Math.sin(c.pitch - this.homePitch) * h * 0.11;
    ctx.drawImage(this.cloud, -w * 0.14 + offsetX, -h * 0.16 + offsetY, w * 1.28, h * 1.32);
    for (const star of this.stars) {
      const p = this.project(c, star, focal);
      if (!p || p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
      const r = 0.44 + star.power ** 4 * 1.18;
      ctx.fillStyle = star.warm
        ? `rgba(255,214,174,${0.2 + star.power * 0.56})`
        : `rgba(194,219,253,${0.24 + star.power * 0.59})`;
      ctx.fillRect(p.x, p.y, r, r);
      if (star.power > 0.985) {
        ctx.fillStyle = '#cdeaff4d';
        ctx.fillRect(p.x - r, p.y + 0.3, r * 3, 0.6);
        ctx.fillRect(p.x + 0.5, p.y - r, 0.6, r * 3);
      }
    }
    const moon = this.project(c, this.moon, focal);
    if (!moon) return;
    const r = (Math.min(w, h) * 0.099) / moon.depth;
    if (moon.x + 2 * r < 0 || moon.x - 2 * r > w || moon.y + 2 * r < 0 || moon.y - 2 * r > h) return;
    ctx.save();
    ctx.translate(moon.x, moon.y);
    ctx.rotate(-0.23);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (1.44 + i * 0.062), r * (0.21 + i * 0.007), 0, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = ['#73889665', '#8197ac55', '#4d617646', '#b3b8ba48'][i];
      ctx.lineWidth = Math.max(0.8, r * 0.026);
      ctx.stroke();
    }
    ctx.drawImage(this.planet, -r, -r, 2 * r, 2 * r);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (1.44 + i * 0.062), r * (0.21 + i * 0.007), 0, 0, Math.PI);
      ctx.strokeStyle = ['#8b99a47c', '#88949f70', '#65738365', '#a8abae63'][i];
      ctx.lineWidth = Math.max(0.8, r * 0.026);
      ctx.stroke();
    }
    ctx.restore();
  }
}
