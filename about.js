(() => {
  // Arriving from "Learn about my workflow" (about.html#ai; the head script took the hash
  // off so the browser wouldn't jump): once the page has drawn, glide down so the AI card
  // sits in the middle of the window. With reduced motion it just goes there
  if (window.glideTo) {
    const target = document.getElementById(window.glideTo);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = () => {
      const r = target.getBoundingClientRect();
      const top = scrollY + r.top - Math.max(120, (innerHeight - r.height) / 2);
      scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    };
    (document.fonts ? document.fonts.ready : Promise.resolve())
      .then(() => setTimeout(go, reduce ? 0 : 350));
  }

  // Flip circles: hover or keyboard focus flips them (CSS); a tap or click toggles them too,
  // so they work on touch screens
  document.querySelectorAll('.flip').forEach((f) => {
    f.addEventListener('click', () => f.classList.toggle('is-flipped'));
    f.addEventListener('mouseleave', () => f.classList.remove('is-flipped'));
  });

  // AI card staircase: every beat each icon hops up one step (top one first, the rest a
  // moment after, like a queue moving up). The top icon hops off the edge and fades; it
  // then pops back in on the bottom step, so the climb never ends. Runs only while the card
  // is on screen; with reduced motion the icons just sit on their steps
  const stairs = document.getElementById('stairs');
  if (stairs) {
    const STEP = { x: 69.3, y: -51 };      // one step: across and up
    const FIRST = { x: 72.5, y: 195 };     // centre of the icon on the bottom step
    const HOP_MS = 620, STAGGER_MS = 90, BEAT_MS = 1900;
    const at = (slot) => ({ x: FIRST.x + STEP.x * slot, y: FIRST.y + STEP.y * slot });
    const pose = (p, tilt, sx = 1, sy = 1) =>
      `translate(${p.x}px, ${p.y}px) rotate(${tilt}deg) scale(${sx}, ${sy})`;
    // bottom to top
    let order = [...stairs.querySelectorAll('.tool')];
    const tilt = (el) => parseFloat(el.dataset.tilt) || 0;
    order.forEach((el, slot) => { el.style.transform = pose(at(slot), tilt(el)); });

    // Animate el and leave it at its final pose
    function run(el, frames, opts) {
      const a = el.animate(frames, { fill: 'forwards', ...opts });
      return a.finished.then(() => {
        const last = frames[frames.length - 1];
        el.style.transform = last.transform;
        if ('opacity' in last) el.style.opacity = last.opacity;
        a.cancel();
      }).catch(() => {});
    }
    // A hop with a crouch, an arc 24px above the higher step, and a squashed landing
    function hop(el, from, to, delay, fade) {
      const t = tilt(el), top = Math.min(from.y, to.y) - 24;
      const mid = { x: (from.x + to.x) / 2, y: top };
      return run(el, [
        { transform: pose(from, t), opacity: 1 },
        { transform: pose(from, t, 1.06, 0.9), offset: 0.14, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
        { transform: pose(mid, t + 6, 0.95, 1.06), offset: 0.55, easing: 'cubic-bezier(0.5, 0, 0.8, 0.4)' },
        { transform: pose(to, t, 1.05, 0.93), offset: 0.86, easing: 'ease-out', opacity: fade ? 0 : 1 },
        { transform: pose(to, t), opacity: fade ? 0 : 1 },
      ], { duration: HOP_MS, delay });
    }
    // The returning icon pops in on the bottom step
    function popIn(el, delay) {
      const t = tilt(el), p = at(0);
      return run(el, [
        { transform: pose({ x: p.x, y: p.y + 14 }, t, 0.6, 0.6), opacity: 0 },
        { transform: pose(p, t, 1.06, 1.06), opacity: 1, offset: 0.7, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
        { transform: pose(p, t), opacity: 1 },
      ], { duration: 420, delay });
    }

    let timer = null, busy = false;
    function beat() {
      if (busy) return;
      busy = true;
      const n = order.length;
      const top = order[n - 1];
      const hops = order.map((el, slot) =>
        hop(el, at(slot), at(slot + 1), (n - 1 - slot) * STAGGER_MS, el === top));
      // once the top icon is gone, it comes back at the bottom after the others have moved up
      hops[n - 1].then(() => popIn(top, (n - 1) * STAGGER_MS));
      order = [top, ...order.slice(0, n - 1)];
      Promise.all(hops).then(() => { busy = false; });
    }
    const start = () => { if (!timer) { beat(); timer = setInterval(beat, BEAT_MS); } };
    const stop = () => { clearInterval(timer); timer = null; };

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()))
        .observe(stairs);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else if (stairs.getBoundingClientRect().top < innerHeight) start();
      });
    }
  }

  // Header photos: clicking (or tapping, or Enter on) a side photo brings it to the middle,
  // biggest; clicking the middle one does nothing. The layout is worked out rather than
  // fixed: the featured photo sits dead centre and the two side photos are scaled to fit
  // the row with the same gap either side, so every arrangement is symmetric and stays
  // inside the column. Everything is in the row's 726-unit design width (the CSS turns
  // units into container widths)
  const row = document.getElementById('hero-photos');
  if (row) {
    const ROW_W = 726;
    const FIT_GAP = 16;      // the gap the sizes are worked out for (fills the row)
    const GAP = 6;           // the gap they're actually placed with, a little tighter
    const FEATURED = { landscape: 1.3, portrait: 1 }; // featured photo's scale
    const SIDE_MAX = 0.92;   // side photos never bigger than this
    const items = [...row.querySelectorAll('.hero-photos__item')];
    const dims = (el) => {
      const cs = el.style;
      const w = parseFloat(cs.getPropertyValue('--w')), h = parseFloat(cs.getPropertyValue('--h'));
      const r = (parseFloat(cs.getPropertyValue('--rot')) * Math.PI) / 180;
      // width of the tilted photo's bounding box
      return { bw: w * Math.abs(Math.cos(r)) + h * Math.abs(Math.sin(r)), portrait: h > w };
    };
    function layout(featured) {
      const c = items.find((el) => el.dataset.i === featured);
      const others = items.filter((el) => el !== c);
      // keep the reading order on the sides (lower number on the left)
      const [l, r] = others.sort((a, b) => a.dataset.i - b.dataset.i);
      const dc = dims(c), dl = dims(l), dr = dims(r);
      const sc = dc.portrait ? FEATURED.portrait : FEATURED.landscape;
      const wc = dc.bw * sc;
      const ss = Math.min(SIDE_MAX, (ROW_W - wc - 2 * FIT_GAP) / (dl.bw + dr.bw));
      const wl = dl.bw * ss, wr = dr.bw * ss;
      // the side photos sit GAP from the centre one; the whole group is centred in the row
      const total = wl + GAP + wc + GAP + wr;
      const x0 = (ROW_W - total) / 2;
      const place = (el, x, s, z) => {
        el.style.setProperty('--px', `${(x / ROW_W) * 100}%`);
        el.style.setProperty('--s', s);
        el.style.zIndex = z;
        el.setAttribute('aria-pressed', el === c);
      };
      place(l, x0 + wl / 2, ss, 1);
      place(c, x0 + wl + GAP + wc / 2, sc, 2);
      place(r, x0 + wl + GAP + wc + GAP + wr / 2, ss, 1);
      row.dataset.layout = featured;
    }
    items.forEach((el) => el.addEventListener('click', () => layout(el.dataset.i)));
    layout(row.dataset.layout || '2');
  }

  // Photo strip: swipes and trackpads scroll it natively; with a mouse you can also drag it
  const track = document.getElementById('life-track');
  if (!track) return;
  let down = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = { x: e.clientX, left: track.scrollLeft, moved: false };
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 3) { down.moved = true; track.classList.add('is-dragging'); }
    track.scrollLeft = down.left - dx;
  });
  const end = () => { down = null; track.classList.remove('is-dragging'); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  // arrow keys scroll it when focused
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') track.scrollBy({ left: 240, behavior: 'smooth' });
    if (e.key === 'ArrowLeft') track.scrollBy({ left: -240, behavior: 'smooth' });
  });
})();
