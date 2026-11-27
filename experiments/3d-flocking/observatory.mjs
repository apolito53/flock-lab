import { attachCameraInput } from './camera-input.mjs';
import { Swarm, DEFAULTS, STEP } from './swarm.mjs';
import { Observer } from './observer.mjs';

const byId = (id) => document.getElementById(id);
const canvas = byId('space');
const camera = new Observer(canvas);
const swarm = new Swarm();
const options = { trails: true, sphere: false };
const views = [...document.querySelectorAll('[data-view]')];
const series = [];
const chart = byId('history');
const chartCtx = chart.getContext('2d');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let running = !motionPreference.matches;
let dirty = true,
  previousFrame = null,
  accumulator = 0,
  origin = 0,
  nextSample = 0;

function paintChart() {
  const width = chart.clientWidth,
    height = chart.clientHeight;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  chart.width = Math.round(width * ratio);
  chart.height = Math.round(height * ratio);
  if (!width || !height) return;
  chartCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  chartCtx.lineWidth = 1.2;
  chartCtx.strokeStyle = '#8ecbb3';
  chartCtx.beginPath();
  series.forEach((n, i) => {
    const x = width - 1 - ((series.length - 1 - i) * (width - 2)) / 79;
    const y = height - 2 - n * (height - 4);
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  chartCtx.stroke();
  if (series.length) {
    const y = height - 2 - series.at(-1) * (height - 4);
    chartCtx.fillStyle = '#b1dec6';
    chartCtx.fillRect(width - 2, y - 1, 2, 2);
  }
}

function telemetry(sample = false) {
  const reading = swarm.measure();
  byId('agreement').textContent = Math.round(reading.agreement * 100) + '%';
  byId('mean-radius').textContent = reading.radius.toFixed(1);
  byId('mean-speed').textContent = reading.speed.toFixed(1);
  const seconds = Math.max(0, Math.floor(swarm.time - origin + 1e-6));
  byId('clock').textContent =
    String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  if (sample) {
    series.push(reading.agreement);
    if (series.length > 80) series.shift();
    paintChart();
  }
}

function beginObservation() {
  // Start with a short, real flight history so trails are visible even if reduced motion starts paused.
  for (let i = 0; i < 72; i++) swarm.step();
  origin = swarm.time;
  series.length = 0;
  nextSample = swarm.time + 0.25;
  previousFrame = null;
  accumulator = 0;
  dirty = true;
  telemetry(true);
}

function syncPlayback() {
  byId('live-state').textContent = running ? 'Live' : 'Paused';
  byId('live-state').parentElement.classList.toggle('paused', !running);
  byId('pause-text').textContent = running ? 'Pause' : 'Resume';
  byId('pause-icon').setAttribute('href', running ? '#i-pause' : '#i-play');
  byId('pause').setAttribute('aria-pressed', String(!running));
  byId('scatter').disabled = !running;
  previousFrame = null;
  accumulator = 0;
  dirty = true;
}

function togglePlayback() {
  running = !running;
  syncPlayback();
}
byId('pause').addEventListener('click', togglePlayback);
motionPreference.addEventListener('change', (e) => {
  if (e.matches) {
    running = false;
    syncPlayback();
  }
});
byId('scatter').addEventListener('click', () => {
  swarm.scatter();
  telemetry();
  dirty = true;
});
byId('reset').addEventListener('click', () => {
  swarm.reset();
  beginObservation();
});

for (const key of ['population', 'alignment', 'cohesion', 'separation', 'gravity', 'radius']) {
  const input = byId(key);
  const percent = !['population', 'radius'].includes(key);
  input.value = percent ? Math.round(DEFAULTS[key] * 100) : DEFAULTS[key];
  const read = () => {
    const value = Number(input.value);
    const display = String(value) + (percent ? '%' : key === 'radius' ? ' u' : '');
    input.style.setProperty(
      '--fill',
      ((value - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100 + '%',
    );
    byId('out-' + key).textContent = display;
    input.setAttribute('aria-valuetext', display);
    if (key === 'population') swarm.setPopulation(value);
    else swarm.settings[key] = percent ? value / 100 : value;
    dirty = true;
  };
  input.addEventListener('input', () => {
    read();
    if (key === 'population') telemetry();
  });
  read();
}
const leaderToggle = byId('leader');
leaderToggle.addEventListener('change', () => {
  swarm.settings.leader = leaderToggle.checked;
  byId('leader-controls').disabled = !leaderToggle.checked;
  byId('leader-key').hidden = !leaderToggle.checked;
  dirty = true;
});
byId('momentum').addEventListener('change', (e) => {
  swarm.settings.momentum = e.target.checked;
});
byId('sphere').addEventListener('change', (e) => {
  options.sphere = e.target.checked;
  dirty = true;
});
byId('trails').addEventListener('click', () => {
  options.trails = !options.trails;
  byId('trails').setAttribute('aria-pressed', String(options.trails));
  dirty = true;
});
function showAngle() {
  for (const button of views)
    button.setAttribute('aria-pressed', String(button.dataset.view === camera.mode));
  dirty = true;
}
for (const button of views)
  button.addEventListener('click', () => {
    camera.setView(button.dataset.view);
    showAngle();
  });

attachCameraInput(canvas, camera, showAngle);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && [document.body, canvas].includes(e.target)) {
    e.preventDefault();
    togglePlayback();
  }
});

new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  camera.resize(width, height, devicePixelRatio);
  camera.prepare();
  paintChart();
  dirty = true;
}).observe(canvas);
document.addEventListener('visibilitychange', () => {
  previousFrame = null;
  accumulator = 0;
});

function frame(now) {
  if (!document.hidden && camera.width > 0) {
    if (running) {
      accumulator += previousFrame === null ? 0 : Math.min(0.12, (now - previousFrame) / 1000);
      while (accumulator >= STEP) {
        swarm.step();
        accumulator -= STEP;
        dirty = true;
      }
      if (swarm.time >= nextSample) {
        telemetry(true);
        nextSample += 0.25;
      }
    }
    if (dirty) {
      camera.draw(swarm, options);
      dirty = false;
    }
  }
  previousFrame = now;
  requestAnimationFrame(frame);
}

beginObservation();
syncPlayback();
requestAnimationFrame(frame);
