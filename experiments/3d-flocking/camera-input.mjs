export function attachCameraInput(canvas, camera, changed) {
  const contacts = new Map();
  function pinch() {
    const [a, b] = contacts.values();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, span: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    contacts.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 1 });
  });
  canvas.addEventListener('pointermove', (e) => {
    const previous = contacts.get(e.pointerId);
    if (!previous) return;
    const before = contacts.size === 2 ? pinch() : null;
    contacts.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: previous.pan });
    if (before) {
      const after = pinch();
      camera.pan(after.x - before.x, after.y - before.y);
      if (before.span > 1 && after.span > 1) camera.magnify(after.span / before.span);
    } else if (contacts.size === 1) {
      const dx = e.clientX - previous.x,
        dy = e.clientY - previous.y;
      if (previous.pan || e.shiftKey) camera.pan(dx, dy);
      else if (dx || dy) camera.rotate(dx, dy);
    }
    changed();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    canvas.addEventListener(event, (e) => contacts.delete(e.pointerId));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? camera.height : 1);
      camera.magnify(Math.exp(-Math.max(-240, Math.min(240, delta)) * 0.0015));
      changed();
    },
    { passive: false },
  );
  canvas.addEventListener('keydown', (e) => {
    const arrows = { ArrowLeft: [-9, 0], ArrowRight: [9, 0], ArrowUp: [0, 9], ArrowDown: [0, -9] };
    if (arrows[e.key]) {
      if (e.shiftKey) camera.pan(...arrows[e.key]);
      else camera.rotate(...arrows[e.key]);
    } else if (e.key === '+' || e.key === '=') camera.magnify(1.12);
    else if (e.key === '-') camera.magnify(1 / 1.12);
    else if (e.key === 'Home') camera.setView('orbit');
    else return;
    e.preventDefault();
    changed();
  });
}
