// The carrier mesh and its arcade collision volumes share this local frame.
const yaw = 0.78,
  pitch = 0.17,
  roll = -0.18;
const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
const up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)];
const forward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
const axes = [
  right.map((v, i) => v * Math.cos(roll) + up[i] * Math.sin(roll)),
  up.map((v, i) => v * Math.cos(roll) - right[i] * Math.sin(roll)),
  forward,
];
const origin = [0, -1, 0];
function world(x, y, z, vector = false) {
  return origin.map((v, i) => (vector ? 0 : v) + axes[0][i] * x + axes[1][i] * y + axes[2][i] * z);
}
function local(x, y, z) {
  return axes.map((a) => (x - origin[0]) * a[0] + (y - origin[1]) * a[1] + (z - origin[2]) * a[2]);
}
const volumes = [
  [0, 0, -13, 6.7, 3.9, 16],
  [0.9, 1.3, 15, 5.8, 3.5, 13],
  [-7.4, -0.5, -14, 2.5, 2.6, 12],
  [7.4, -0.5, -14, 2.5, 2.6, 12],
  [0, 0, 2.5, 1.6, 1.6, 6],
];

export function wreckBlocks(a, b) {
  const start = local(a.x, a.y, a.z),
    end = local(b.x, b.y, b.z);
  for (const [x, y, z, rx, ry, rz] of volumes) {
    const sx = (start[0] - x) / rx,
      sy = (start[1] - y) / ry,
      sz = (start[2] - z) / rz;
    const dx = (end[0] - start[0]) / rx,
      dy = (end[1] - start[1]) / ry,
      dz = (end[2] - start[2]) / rz;
    const t = Math.max(
      0,
      Math.min(1, -(sx * dx + sy * dy + sz * dz) / (dx * dx + dy * dy + dz * dz || 1)),
    );
    if ((sx + t * dx) ** 2 + (sy + t * dy) ** 2 + (sz + t * dz) ** 2 < 1) return true;
  }
  return false;
}

export function avoidWreck(ship) {
  const p = local(ship.x + ship.vx * 0.48, ship.y + ship.vy * 0.48, ship.z + ship.vz * 0.48);
  let fx = 0,
    fy = 0,
    fz = 0;
  for (const [x, y, z, rx, ry, rz] of volumes) {
    const dx = p[0] - x,
      dy = p[1] - y,
      dz = p[2] - z;
    const d = Math.hypot(dx / (rx + 6), dy / (ry + 5), dz / (rz + 6));
    if (d >= 1) continue;
    const nx = dx / (rx + 6) ** 2,
      ny = dy / (ry + 5) ** 2,
      nz = dz / (rz + 6) ** 2;
    const push = ((1 - d) * 76) / (Math.hypot(nx, ny, nz) || 1);
    fx += nx * push;
    fy += ny * push;
    fz += nz * push;
  }
  return world(fx, fy, fz, true);
}

export function slidePastWreck(ship) {
  const p = local(ship.x, ship.y, ship.z);
  for (const [x, y, z, rx, ry, rz] of volumes) {
    let dx = p[0] - x,
      dy = p[1] - y,
      dz = p[2] - z;
    if (dx === 0 && dy === 0 && dz === 0) dy = 0.001;
    const d = Math.hypot(dx / (rx + 1), dy / (ry + 1), dz / (rz + 1));
    if (d >= 1) continue;
    p[0] = x + dx / d;
    p[1] = y + dy / d;
    p[2] = z + dz / d;
    [ship.x, ship.y, ship.z] = world(...p);
    const n = world(dx / (rx + 1) ** 2, dy / (ry + 1) ** 2, dz / (rz + 1) ** 2, true);
    const loss =
      Math.min(0, ship.vx * n[0] + ship.vy * n[1] + ship.vz * n[2]) /
      (n[0] ** 2 + n[1] ** 2 + n[2] ** 2 || 1);
    ship.vx -= loss * n[0];
    ship.vy -= loss * n[1];
    ship.vz -= loss * n[2];
  }
}

export function carrierMesh() {
  const faces = [];
  const profile = [
    [-0.72, 1],
    [0.72, 1],
    [1, 0.45],
    [1, -0.45],
    [0.7, -1],
    [-0.7, -1],
    [-1, -0.45],
    [-1, 0.45],
  ];
  const steel = ['#53657b', '#8193a1', '#384352', '#28313e', '#182231', '#252e3c', '#384455', '#68798a'];
  const dark = ['#35404f', '#566272', '#2a3342', '#1b2634', '#141c2a', '#222937', '#333d4a', '#49566a'];
  const brass = ['#a57f56', '#d4a873', '#786044', '#4b3b33', '#423735', '#55483c', '#836b50', '#b99367'];
  function face(points, fill) {
    const vertices = points.map((p) => world(...p));
    const center = [0, 1, 2].map((i) => vertices.reduce((sum, v) => sum + v[i], 0) / vertices.length);
    faces.push({ vertices, center, fill });
  }
  function loft(sections, palette = steel) {
    const rings = sections.map(([z, x, y, w, h]) =>
      profile.map(([sx, sy]) => [x + w * sx, y + h * sy, z]),
    );
    for (let r = 1; r < rings.length; r++)
      for (let side = 0; side < 8; side++) {
        const next = (side + 1) % 8;
        face([rings[r - 1][side], rings[r - 1][next], rings[r][next], rings[r][side]], palette[side]);
      }
    face(rings[0], palette[3]);
    face(rings.at(-1), palette[6]);
  }
  function block(x, y, z, w, h, l, palette = steel) {
    loft(
      [
        [z - l, x, y, w, h],
        [z + l, x, y, w, h],
      ],
      palette,
    );
  }
  // Two separated hull sections, with a broken keel visible through the gap.
  loft([
    [-30, 0, 0, 3.5, 1.6],
    [-26, 0, 0, 6.2, 3.0],
    [-17, 0, 0, 6.4, 3.2],
    [-6, 0, 0.15, 5.9, 3.15],
    [-1.7, -0.45, 0.15, 4.9, 2.6],
  ]);
  loft([
    [4.8, 1.15, 1.0, 5.4, 2.7],
    [12, 1, 1.3, 5.7, 2.9],
    [22, 0.55, 1.5, 4.4, 2.3],
    [30, 0.2, 1.85, 1.6, 1.0],
  ]);
  for (const side of [-1, 1]) {
    block(side * 6.2, -0.25, -13, 2.6, 0.65, 3.2, dark);
    loft(
      [
        [-28, side * 7.6, -0.65, 1.3, 1.1],
        [-23, side * 7.6, -0.65, 2.3, 1.9],
        [-8, side * 7.6, -0.5, 2.0, 1.7],
        [-4, side * 7.4, -0.5, 1.0, 0.8],
      ],
      dark,
    );
    for (const z of [-22, -17, -12, -7]) block(side * 7.65, 1.25, z, 1.6, 0.25, 0.56);
    for (const z of [-24, -22, -20, -18, -16, -14, -12, -10, -8]) {
      face(
        [
          [side * 6.42, -0.1, z],
          [side * 6.42, 0.2, z],
          [side * 6.42, 0.2, z + 0.73],
          [side * 6.42, -0.1, z + 0.73],
        ],
        z % 4 === 0 ? '#e1ac70' : '#728890',
      );
    }
    block(side * 2.15, 0.15, 1.55, 0.3, 0.32, 3.7, brass);
    block(side * 3.8, 2.9, -4.7, 0.62, 0.38, 2.6, dark);
  }
  for (const z of [-23, -20, -17, -14, -11, -8]) block(0, 3.13, z, 2.7, 0.28, 0.75, dark);
  for (const z of [8, 12, 16, 20]) block(0.9, 4.0, z, 2.0, 0.18, 0.44, dark);
  block(-0.4, 4.1, -15.4, 1.9, 1.0, 3.7);
  block(-0.6, 5.5, -16.6, 1.6, 0.5, 2.4, dark);
  block(-0.9, 7.0, -17.6, 0.16, 1.15, 0.18, brass);
  block(1.8, 4.8, 10, 0.12, 1.1, 0.15, dark);
  for (const z of [-1, 0.7, 2.5, 4]) block(0.15, 0.2, z, 2.35, 0.21, 0.2, dark);
  face(
    [
      [-1.9, 5.75, -18.2],
      [0.8, 5.75, -18.2],
      [0.8, 5.75, -17.8],
      [-1.9, 5.75, -17.8],
    ],
    '#88c3c5',
  );
  // Salvage paint and missing armor reveal the diagonal break in the upper deck.
  for (const z of [-14.2, -12.7, -11.2]) {
    face(
      [
        [-4.0, 3.48, z],
        [-3.25, 3.48, z],
        [-2.62, 3.48, z + 0.82],
        [-3.36, 3.48, z + 0.82],
      ],
      '#b99b68',
    );
  }
  block(2.9, 4.23, 10.3, 0.72, 0.18, 2.6, dark);
  for (const z of [8.4, 9.35, 10.3, 11.25, 12.2]) {
    face(
      [
        [2.36, 4.44, z],
        [3.48, 4.44, z],
        [3.48, 4.44, z + 0.24],
        [2.36, 4.44, z + 0.24],
      ],
      '#899ba5',
    );
  }
  face(
    [
      [-3.2, 3.65, 5.1],
      [-0.8, 4.04, 6.8],
      [-1.65, 4.12, 9.6],
      [-2.27, 3.96, 8.75],
      [-2.68, 3.86, 7.38],
    ],
    '#443b3e',
  );
  return faces;
}
