import { attachCameraInput } from '../3d-flocking/camera-input.mjs';
import { STEP } from '../3d-flocking/swarm.mjs';
import { Battle, FLEETS } from './battle.mjs';
import { BattleScene } from './scene.mjs';

const byId = (id) => document.getElementById(id);
const canvas = byId('battlefield');
const scene = new BattleScene(canvas);
const battle = new Battle();
const orders = [...document.querySelectorAll('[data-order]')];
const views = [...document.querySelectorAll('[data-view]')];
const descriptions = {
  engage: 'Wings pursue enemy fighters.',
  split: 'Outer wings fly high and low.',
  rally: 'Hold fire and recharge shields.',
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let running = !reducedMotion.matches;
let trails = true;
let speed = 1;
let dirty = true;
let previous = null;
let accumulator = 0;

const pips = battle.ships.map((ship) => {
  const pip = document.createElement('i');
  byId('pips-' + ship.side).append(pip);
  return pip;
});
function clock(time) {
  const seconds = Math.floor(time + 1e-7);
  return [Math.floor(seconds / 60), seconds % 60].map((n) => String(n).padStart(2, '0')).join(':');
}
function showScore() {
  for (const [side, fleet] of battle.fleets.entries()) byId('count-' + side).textContent = fleet.length;
  for (const ship of battle.ships) pips[ship.id].classList.toggle('lost', !ship.alive);
}
function showOrder() {
  for (const button of orders) {
    button.setAttribute('aria-pressed', String(button.dataset.order === battle.order));
    button.disabled = Boolean(battle.outcome);
  }
  byId('order-description').textContent = descriptions[battle.order];
}
function showPlayback() {
  const complete = Boolean(battle.outcome);
  byId('pause').disabled = complete;
  byId('pause').setAttribute('aria-pressed', String(!running));
  byId('play-text').textContent = complete ? 'Finished' : running ? 'Pause' : 'Resume';
  byId('play-glyph').setAttribute('href', running ? '#pause-icon' : '#play-icon');
  byId('status').textContent = complete ? 'Complete' : running ? 'Engagement' : 'Paused';
  previous = null;
  accumulator = 0;
}
function togglePause() {
  if (battle.outcome) return;
  running = !running;
  showPlayback();
}
function finish() {
  running = false;
  showPlayback();
  showScore();
  showOrder();
  const { winner, counts, reason } = battle.outcome;
  const title = winner === null ? 'The fleets draw' : FLEETS[winner].name + ' holds the field';
  const detail = counts[0] + ' Meridian · ' + counts[1] + ' Vesper remaining';
  byId('result-title').textContent = title;
  byId('result-detail').textContent =
    detail + (reason === 'time' ? ' at the time limit.' : ' after ' + clock(battle.time) + '.');
  byId('result').hidden = false;
}
function restart(fresh) {
  const fromResult = !byId('result').hidden;
  const seed = fresh ? crypto.getRandomValues(new Uint32Array(1))[0] : battle.seed;
  battle.reset(seed);
  if (fromResult) running = !reducedMotion.matches;
  byId('result').hidden = true;
  byId('clock').textContent = clock(0);
  showOrder();
  showScore();
  showPlayback();
  dirty = true;
  if (fromResult) canvas.focus({ preventScroll: true });
}
function giveOrder(order) {
  if (battle.issue(order)) showOrder();
}
function showView() {
  for (const button of views)
    button.setAttribute('aria-pressed', String(button.dataset.view === scene.mode));
  dirty = true;
}
for (const button of orders) button.addEventListener('click', () => giveOrder(button.dataset.order));
for (const button of views)
  button.addEventListener('click', () => {
    scene.setView(button.dataset.view);
    showView();
  });
for (const button of document.querySelectorAll('[data-restart]')) {
  button.addEventListener('click', () => restart(button.dataset.restart === 'new'));
}
byId('pause').addEventListener('click', togglePause);
byId('speed').addEventListener('change', (event) => {
  speed = Number(event.target.value);
});
byId('trails').addEventListener('click', () => {
  trails = !trails;
  byId('trails').setAttribute('aria-pressed', String(trails));
  dirty = true;
});
attachCameraInput(canvas, scene, showView);
document.addEventListener('keydown', (event) => {
  if (
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    ![document.body, canvas].includes(event.target)
  )
    return;
  if (event.code === 'Space') {
    event.preventDefault();
    togglePause();
  } else {
    const order = { 1: 'engage', 2: 'split', 3: 'rally' }[event.key];
    if (order) giveOrder(order);
  }
});

let audio = null;
let nextTone = 0;
const soundButton = byId('sound');
const AudioEngine = window.AudioContext || window.webkitAudioContext;
soundButton.disabled = !AudioEngine;
soundButton.addEventListener('click', async () => {
  soundButton.disabled = true;
  try {
    audio ??= new AudioEngine();
    if (soundButton.getAttribute('aria-pressed') === 'true') await audio.suspend();
    else await audio.resume();
    const enabled = audio.state === 'running';
    soundButton.setAttribute('aria-pressed', String(enabled));
    byId('audio-glyph').setAttribute('href', enabled ? '#sound-icon' : '#mute-icon');
    byId('audio-text').textContent = enabled ? 'Sound on' : 'Sound off';
  } catch {
    soundButton.title = 'Combat audio is unavailable in this browser';
  } finally {
    soundButton.disabled = false;
  }
});
function playSound(events) {
  if (!events.length || audio?.state !== 'running') return;
  const now = audio.currentTime;
  const event =
    events.find((e) => e.type === 'loss') ?? events.find((e) => e.type === 'hit') ?? events[0];
  if (now < nextTone && event.type !== 'loss') return;
  const loss = event.type === 'loss',
    shot = event.type === 'shot';
  const frequency = loss ? 132 : shot ? (event.side ? 530 : 740) : 280;
  const duration = loss ? 0.26 : shot ? 0.09 : 0.13;
  nextTone = now + 0.075;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = shot ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(loss ? 34 : frequency * 0.48, now + duration);
  gain.gain.setValueAtTime(0.0002, now);
  gain.gain.exponentialRampToValueAtTime(loss ? 0.09 : 0.037, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0002, now + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(now);
  oscillator.stop(now + duration);
}

new ResizeObserver(([entry]) => {
  scene.resize(entry.contentRect.width, entry.contentRect.height, window.devicePixelRatio || 1);
  dirty = true;
}).observe(canvas);
document.addEventListener('visibilitychange', () => {
  previous = null;
  accumulator = 0;
});
reducedMotion.addEventListener('change', (event) => {
  if (event.matches && running) togglePause();
});
function frame(now) {
  if (!document.hidden && scene.width > 0 && scene.height > 0) {
    if (running) {
      if (previous !== null) accumulator += Math.min(0.12, (now - previous) / 1000) * speed;
      while (accumulator >= STEP && running) {
        accumulator -= STEP;
        battle.step();
        playSound(battle.events);
        if (battle.events.some((e) => e.type === 'loss')) showScore();
        if (battle.ticks % 30 === 0 || battle.outcome) byId('clock').textContent = clock(battle.time);
        if (battle.outcome) finish();
        dirty = true;
      }
    }
    if (dirty) {
      scene.drawBattle(battle, trails);
      dirty = false;
    }
  }
  previous = now;
  requestAnimationFrame(frame);
}
showScore();
showOrder();
showPlayback();
requestAnimationFrame(frame);
