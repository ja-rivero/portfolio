// Footer gumballs: solid balls that rest in their spots from the design. The
// cursor is a small solid disc that shoves whatever it touches, balls knock
// into each other, and each one eases back to its spot. The colour picker
// recolours the whole pile; "spill the gumballs" lets gravity take them and
// they refill on their own.
(() => {
  const root = document.documentElement;
  const footer = document.getElementById('footer');
  const stage = document.getElementById('gumballs');
  const tip = document.getElementById('gumTip');
  const controls = footer.querySelector('.footer__controls');
  const emptyBtn = document.getElementById('gumEmpty');
  const swatches = [...footer.querySelectorAll('.swatch')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const W = 1512, H = 474;   // design frame
  const MAX_SCALE = 1.25;
  const MIN_SMALL_H = 124;   // small screens: tall enough for the controls floating over the balls
  const K = 260;             // pull back to the resting spot…
  const C = 2 * Math.sqrt(K) * 0.9; // …nearly critically damped: settles, no wobble
  const CURSOR_R = 20;       // the cursor's solid radius (design px)
  const BOUNCE = 0.15;       // restitution when balls knock together
  const G = 2600;            // gravity (design px / s²)

  // [x, y, size] of each gumball in the 1512 × 474 Figma frame
  const LAYOUT = [
    [0, 76, 160], [160, 76, 136], [264, 147, 190], [430, 275, 93], [447, 365, 109],
    [556, 395, 79], [756, 356, 118], [827, 216, 181], [819, 76, 143], [956, 127, 127],
    [1080, 78, 170], [1008, 246, 106], [967, 348, 126], [389, 76, 93], [468, 140, 51],
    [503, 76, 332], [1104, 240, 234], [305, 331, 143], [207, 355, 98], [139, 231, 135],
    [0, 236, 139], [84, 351, 123],
  ];

  // ---------- colour memory ----------
  // The chosen colour carries across pages for this visit (sessionStorage), but
  // a reload — or closing the site — starts the gumballs black again
  const COLOR_KEY = 'gumball-color';
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  const store = {
    get() { try { return sessionStorage.getItem(COLOR_KEY); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(COLOR_KEY, v); } catch (e) { /* storage blocked */ } },
    clear() { try { sessionStorage.removeItem(COLOR_KEY); } catch (e) { /* storage blocked */ } },
  };

  function selectSwatch(sw) {
    swatches.forEach((x) => {
      const on = x === sw;
      x.classList.toggle('is-active', on);
      x.setAttribute('aria-checked', on);
    });
    stage.style.setProperty('--gum', getComputedStyle(sw).getPropertyValue('--c').trim());
  }

  if (nav && nav.type === 'reload') store.clear();
  const saved = swatches.find((x) => x.dataset.name === store.get());
  if (saved) selectSwatch(saved); // before the balls exist, so they start in it (no sweep)

  const balls = LAYOUT.map(([x, y, d]) => {
    const el = document.createElement('div');
    el.className = 'gumball';
    // Recolours sweep across the pile from left to right
    el.style.transitionDelay = `${((x + d / 2) / W) * 0.3}s`;
    stage.appendChild(el);
    return {
      el, r: d / 2, m: (d / 2) ** 2, ax: x + d / 2, ay: y + d / 2,
      dx: 0, dy: 0, vx: 0, vy: 0, state: 'anchored', delay: 0,
    };
  });

  // Neighbouring pairs, with how close they may get: touching, or however
  // much they already overlap in the design
  const pairs = [];
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      const rest = Math.hypot(a.ax - b.ax, a.ay - b.ay);
      pairs.push({ a, b, min: Math.min(a.r + b.r, rest) });
    }
  }

  let s = 1;
  let pointer = null;        // cursor in design px, relative to the gumball stage
  let mode = 'full';         // full → emptying → empty → refilling → full
  let raf = 0, last = 0;

  // ---------- layout ----------

  function layout() {
    s = Math.min(footer.clientWidth / W, MAX_SCALE);
    const minH = window.innerWidth <= 900 ? MIN_SMALL_H : 0;
    root.style.setProperty('--fs', s);
    root.style.setProperty('--footer-h', `${Math.round(Math.max(H * s, minH))}px`);
    for (const b of balls) b.el.style.width = b.el.style.height = `${b.r * 2 * s}px`;
    render();
  }

  function render() {
    for (const b of balls) {
      const x = (b.ax + b.dx - b.r) * s;
      const y = (b.ay + b.dy - b.r) * s;
      b.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }

  // ---------- physics ----------

  const live = (b) => b.state === 'anchored' && b.delay <= 0;

  function collide() {
    for (const { a, b, min } of pairs) {
      if (!live(a) || !live(b)) continue;
      let nx = (b.ax + b.dx) - (a.ax + a.dx);
      let ny = (b.ay + b.dy) - (a.ay + a.dy);
      const dist = Math.hypot(nx, ny) || 0.0001;
      const pen = min - dist;
      if (pen <= 0.01) continue;
      nx /= dist; ny /= dist;
      // Separate them, the lighter ball giving way more
      const total = a.m + b.m;
      a.dx -= nx * pen * (b.m / total); a.dy -= ny * pen * (b.m / total);
      b.dx += nx * pen * (a.m / total); b.dy += ny * pen * (a.m / total);
      // Exchange momentum along the contact if they're moving together
      const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vrel < 0) {
        const j = (-(1 + BOUNCE) * vrel) / (1 / a.m + 1 / b.m);
        a.vx -= (j / a.m) * nx; a.vy -= (j / a.m) * ny;
        b.vx += (j / b.m) * nx; b.vy += (j / b.m) * ny;
      }
    }
  }

  function pushFromCursor() {
    if (!pointer || reduce) return;
    for (const b of balls) {
      if (!live(b)) continue;
      let nx = b.ax + b.dx - pointer.x, ny = b.ay + b.dy - pointer.y;
      const dist = Math.hypot(nx, ny) || 0.0001;
      const pen = b.r + CURSOR_R - dist;
      if (pen <= 0) continue;
      nx /= dist; ny /= dist;
      // A solid contact: move the ball out of the cursor and stop it moving inward
      b.dx += nx * pen; b.dy += ny * pen;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= vn * nx; b.vy -= vn * ny; }
    }
  }

  function step(dt) {
    let busy = false;
    for (const b of balls) {
      if (b.delay > 0) { b.delay -= dt; busy = true; continue; }

      if (b.state === 'anchored') {
        b.vx += (-K * b.dx - C * b.vx) * dt;
        b.vy += (-K * b.dy - C * b.vy) * dt;
        b.dx += b.vx * dt; b.dy += b.vy * dt;
      } else if (b.state === 'falling' || b.state === 'dropping') {
        b.vy += G * dt;
        b.dx += b.vx * dt; b.dy += b.vy * dt;
        b.vx *= 0.995;
        if (b.state === 'falling' && b.ay + b.dy - b.r > H + 40) {
          b.state = 'gone';
        } else if (b.state === 'dropping' && b.dy >= 0) {
          // Land on its spot with a small bounce, then the spring settles it
          b.dy = 0;
          b.vy = -b.vy * 0.3;
          if (Math.abs(b.vy) < 90) b.state = 'anchored';
        }
      }
    }

    pushFromCursor();
    collide();
    collide();

    for (const b of balls) {
      if (b.state === 'falling' || b.state === 'dropping') { busy = true; continue; }
      if (b.state === 'anchored' && (Math.abs(b.dx) + Math.abs(b.dy) > 0.05 ||
          Math.abs(b.vx) + Math.abs(b.vy) > 0.05)) busy = true;
    }
    return busy;
  }

  function tick(now) {
    // rAF timestamps can be a touch earlier than performance.now() at wake-up
    const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
    last = now;
    // Sub-step so springs and contacts stay stable on slow frames
    let busy = false;
    const n = Math.ceil(dt / 0.006);
    for (let i = 0; i < n; i++) busy = step(dt / n) || busy;
    render();
    finishModes();
    if (busy || pointer) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
    }
  }

  function wake() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function finishModes() {
    if (mode === 'emptying' && balls.every((b) => b.state === 'gone')) {
      mode = 'empty';
      setTimeout(refill, reduce ? 0 : REFILL_PAUSE);
    } else if (mode === 'refilling' && balls.every((b) => b.state === 'anchored' && b.delay <= 0)) {
      mode = 'full';
      emptyBtn.disabled = false;
    }
  }

  // ---------- interaction ----------

  function toStage(e) {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  }

  footer.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer = toStage(e);
    wake();
  });
  footer.addEventListener('pointerleave', () => { pointer = null; wake(); });

  // ---------- colour picker ----------

  // The colour name only shows while a swatch is hovered or focused
  function showTip(sw) {
    tip.textContent = sw.dataset.name;
    const c = controls.getBoundingClientRect();
    const r = sw.getBoundingClientRect();
    const x = r.left + r.width / 2 - c.left - tip.offsetWidth / 2;
    tip.style.transform = `translateX(${x}px)`;
    tip.classList.add('is-visible');
  }

  function hideTip() { tip.classList.remove('is-visible'); }

  swatches.forEach((sw) => {
    sw.addEventListener('click', () => {
      selectSwatch(sw); // recolour every gumball
      store.set(sw.dataset.name);
    });
    sw.addEventListener('pointerenter', () => showTip(sw));
    sw.addEventListener('pointerleave', hideTip);
    sw.addEventListener('focus', () => showTip(sw));
    sw.addEventListener('blur', hideTip);
  });

  // ---------- empty / refill ----------
  // Emptying lets gravity take every ball, then they refill on their own;
  // the button is disabled until the last one has landed back in place

  const REFILL_PAUSE = 450; // ms with an empty machine before the refill

  function empty() {
    mode = 'emptying';
    emptyBtn.disabled = true;
    for (const b of balls) {
      b.state = reduce ? 'gone' : 'falling';
      b.vx = (Math.random() - 0.5) * 240;
      b.vy = -Math.random() * 320;          // a small hop before they drop
      b.delay = reduce ? 0 : Math.random() * 0.3;
      if (reduce) b.dy = H + b.r * 2;
    }
    render();
    wake();
    finishModes();
  }

  function refill() {
    mode = 'refilling';
    for (const b of balls) {
      b.dx = 0; b.vx = 0; b.vy = 0;
      if (reduce) { b.dy = 0; b.state = 'anchored'; continue; }
      b.dy = -(b.ay + b.r + 40 + Math.random() * 260); // start above the footer
      b.state = 'dropping';
      b.delay = Math.random() * 0.45;
    }
    render();
    wake();
    finishModes();
  }

  emptyBtn.addEventListener('click', () => { if (mode === 'full') empty(); });

  window.addEventListener('resize', layout);
  layout();
})();
