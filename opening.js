(() => {
  // ---------- Scene (Figma units: the 712×522 "fill - dither" frame) ----------
  // The sky picture covers that frame (object-fit: cover), so it overhangs it left and right
  const IMG_W = 1672, IMG_H = 941;                  // assets/sky.png
  const SKY_H = 522, SKY_W = IMG_W * SKY_H / IMG_H; // 927.5
  const SKY_X = (712 - SKY_W) / 2;                  // -107.75
  const SKY_R = SKY_X + SKY_W;

  // The grid of the landing frame (Figma 671:24104–24111). Every cell is grey (#1d2325 in
  // Color blend over the sky) except the ones listed as colour at the time; the overhang
  // either side of the frame is always grey
  const CELLS = {
    a: [0, 0, 220, 195],     f: [220, 0, 165, 195],   c: [385, 0, 327, 195],
    b: [0, 195, 220, 167],   p: [220, 195, 165, 167], d: [385, 195, 327, 167],
    g: [0, 362, 255, 160],   e: [255, 362, 130, 160], h: [385, 362, 327, 160],
  };
  const OVERHANG = [[SKY_X, 0, -SKY_X, SKY_H], [712, 0, SKY_R - 712, SKY_H]];

  // Colour cells per stage. The landing starts on the Figma pair (the plane's cell and the
  // top-left); from there the two colour cells take turns moving: every HOP_MS the one that
  // has stayed longest fades back to grey while another cell fades to colour. Colour cells
  // never share an edge (touching at a corner is fine)
  const OPENING_COLOUR = ['p', 'f', 'e'];       // the plane's whole column, as in the strip
  const LANDING_COLOUR = ['p', 'a'];
  const HOP_MS = 2400;

  // Cells that share an edge of some length (not just a corner)
  const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.5;
  function sharesEdge([ax, ay, aw, ah], [bx, by, bw, bh]) {
    const touchX = Math.abs(ax + aw - bx) < 0.5 || Math.abs(bx + bw - ax) < 0.5;
    const touchY = Math.abs(ay + ah - by) < 0.5 || Math.abs(by + bh - ay) < 0.5;
    return (touchX && overlap(ay, ay + ah, by, by + bh)) || (touchY && overlap(ax, ax + aw, bx, bx + bw));
  }
  const NEIGHBOURS = Object.fromEntries(Object.entries(CELLS).map(([k, r]) =>
    [k, Object.keys(CELLS).filter((o) => o !== k && sharesEdge(r, CELLS[o]))]));

  // Plane (Figma "favicon" 671:24112: the coral plane rotated -39.27°, tinted #b73939)
  const PLANE = { cx: 262 + 4.33 + 85.486 / 2, cy: 238.73 + 5.42 + 77.953 / 2, w: 84.596, h: 31.55, rot: -39.27 };

  // Anchors: the scene point kept on the box centre at each stage
  const A_PLANE = [302.5, 278.5];  // first screen: just the plane's cell
  const A_STRIP = [356, 278.5];    // strip: the full width, the plane's row
  const A_LAND = [356, 261];       // landing: the whole frame

  const root = document.documentElement;
  const group = document.getElementById('group');
  const frameEl = document.getElementById('frame');
  const sceneEl = document.getElementById('scene');
  const caption = document.getElementById('caption');
  const slot = document.getElementById('slot');
  const corners = frameEl.querySelectorAll('.corner');
  const wavy = document.querySelector('.wavy');
  const introPill = document.getElementById('intro-pill');
  const nameLetters = () => [...document.querySelectorAll('.intro__name span')];

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img.decode().then(() => img);
  }

  function place(el, x, y, w, h) {
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    return el;
  }

  let skyEl, planeEl, planeGreyEl, hopTimer;
  const greyEls = {};

  async function buildScene() {
    const [sky, plane] = await Promise.all([loadImage('assets/sky.png'), loadImage('assets/plane-mask.png')]);
    sky.alt = '';
    sky.className = 'sky';
    skyEl = place(sky, SKY_X, 0, SKY_W, SKY_H);

    // Grey cells show a pre-made grey copy of the sky (the #1d2325 Color blend from Figma,
    // done once on a canvas) rather than blending live: a live mix-blend-mode breaks in
    // Chrome under the top scrim's backdrop blur, flashing colour through as it scrolls by
    const greySky = await tinted(sky, '#1d2325');
    const greyUrl = URL.createObjectURL(await new Promise((r) => greySky.toBlob(r)));
    const grey = (r) => {
      const d = document.createElement('i');
      d.className = 'grey';
      d.style.backgroundImage = `url(${greyUrl})`;
      d.style.backgroundSize = `${SKY_W}px ${SKY_H}px`;
      d.style.backgroundPosition = `${SKY_X - r[0]}px ${-r[1]}px`;
      return place(d, ...r);
    };
    const greys = [...OVERHANG.map(grey), ...Object.entries(CELLS).map(([k, r]) => (greyEls[k] = grey(r)))];

    // Tint the plane like Figma (Color blend #b73939, its own alpha kept), plus a grey copy
    // that shows over it whenever its cell is grey
    const c = await tinted(plane, '#b73939');
    c.className = 'plane';
    planeEl = place(c, PLANE.cx - PLANE.w / 2, PLANE.cy - PLANE.h / 2, PLANE.w, PLANE.h);
    const g = await tinted(c, '#1d2325');
    g.className = 'plane plane--grey';
    planeGreyEl = place(g, PLANE.cx - PLANE.w / 2, PLANE.cy - PLANE.h / 2, PLANE.w, PLANE.h);
    greyEls.p.extra = planeGreyEl;

    sceneEl.replaceChildren(skyEl, planeEl, ...greys, planeGreyEl);
  }

  // A canvas copy of an image with a "color" blend of the given tint (hue and saturation of
  // the tint, the image's own lightness and alpha), as Figma's Color blend mode does
  async function tinted(img, tint) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'color';
    x.fillStyle = tint;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(img, 0, 0);
    return c;
  }

  // ---------- Timeline ----------
  // Box sizes (inner window) from the Figma frames, in scene units
  const SHOT = { w: 165, h: 164 };  // 618:2563 — just the plane
  const STRIP = { w: 712, h: 164 }; // 618:2478 — the strip, plane column in colour
  const INSET = 8;                  // corner tick and window inset
  const CAPTION_LIFT = 17;          // half of caption + gap, keeps frame + caption centred together

  // One span per letter, so text can load letter by letter without clipping
  function splitLetters(el) {
    const spans = [...el.textContent].map((ch) => {
      const s = document.createElement('span');
      s.textContent = ch;
      return s;
    });
    el.replaceChildren(...spans);
    return spans;
  }
  const letters = splitLetters(caption);
  const introLetters = [...document.querySelectorAll('[data-split]')].flatMap(splitLetters);
  document.documentElement.classList.remove('is-booting'); // letters now hide themselves

  // ms. The plane loads in once and stays
  const T = {
    // the box's three moves (open, widen, morph) all take 1000ms on the same ease-in-out
    corners: [0, 250],
    open: [200, 1200],
    sky: [350, 1200],
    plane: [600, 1300],
    widen: [1800, 2800],
    stripOut: [4000, 4550],     // caption holds 1.2s once typed, then backspaces out, last letter first
    morph: [4550, 5550],        // box grows into the landing box (landing colours from the start), intro loads
    end: 5550,
  };

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const span = (t, [a, b]) => clamp01((t - a) / (b - a));
  const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOutQuad = (p) => 1 - (1 - p) * (1 - p);
  const lerp = (a, b, p) => a + (b - a) * p;

  let raf, t0, target;

  // Landing box geometry from the slot (CSS fits it to the viewport). The opening uses the
  // landing zoom too, so the sky never changes scale on the way in
  function measureSlot() {
    const r = slot.getBoundingClientRect();
    return {
      w: r.width - 2 * INSET,
      h: r.height - 2 * INSET,
      x: r.left + r.width / 2 - innerWidth / 2, // offset from the centred opening
      y: r.top + r.height / 2 - innerHeight / 2,
    };
  }
  const landingZoom = () => (slot.getBoundingClientRect().height - 2 * INSET) / SKY_H;

  function setScene(z, ax, ay) {
    sceneEl.style.transform = `scale(${z}) translate(${-ax}px, ${-ay}px)`;
  }

  function render(t) {
    const pOpen = easeInOutCubic(span(t, T.open));
    const pWiden = easeInOutCubic(span(t, T.widen));
    const pMorph = easeInOutCubic(span(t, T.morph));
    const pOut = span(t, T.stripOut);
    const to = target || measureSlot();
    const z = landingZoom();

    // Inner window: closed → plane shot → strip → landing box
    let w, h;
    if (t < T.widen[0]) { w = lerp(0, SHOT.w * z, pOpen); h = lerp(0, SHOT.h * z, pOpen); }
    else if (t < T.morph[0]) { w = lerp(SHOT.w, STRIP.w, pWiden) * z; h = SHOT.h * z; }
    else { w = lerp(STRIP.w * z, to.w, pMorph); h = lerp(STRIP.h * z, to.h, pMorph); }
    frameEl.style.width = `${w + 2 * INSET}px`;
    frameEl.style.height = `${h + 2 * INSET}px`;
    frameEl.classList.toggle('is-closed', w < 1);

    const c = easeOutQuad(span(t, T.corners));
    corners.forEach((el) => { el.style.opacity = c; });

    setScene(z, lerp(A_PLANE[0], A_STRIP[0], pWiden), lerp(A_STRIP[1], A_LAND[1], pMorph));
    skyEl.style.opacity = easeOutQuad(span(t, T.sky));
    // The plane's column is colour while the box is a strip; the landing's cells are just
    // there as soon as the box starts growing into it, no fade
    setColour(t < T.morph[0] ? OPENING_COLOUR : LANDING_COLOUR);

    const p = span(t, T.plane);
    planeEl.style.opacity = easeOutQuad(p);
    planeEl.style.scale = `${lerp(0.92, 1, easeOutQuad(p))}`;
    planeGreyEl.style.scale = planeEl.style.scale;

    const lift = -CAPTION_LIFT * pWiden * (1 - pMorph);
    group.style.transform = `translate(${to.x * pMorph}px, ${lift + to.y * pMorph}px)`;

    // Caption loads left → right in step with the box widening, then backspaces out at an
    // even pace, from the last letter back to the first
    const cw = caption.offsetWidth;
    const left = Math.ceil(letters.length * (1 - pOut));
    letters.forEach((s, i) => {
      const mid = s.offsetLeft + s.offsetWidth / 2;
      s.classList.toggle('is-on', pWiden > 0 && mid <= cw * pWiden && i < left);
    });

    // Intro loads letter by letter as the box grows into place; the squiggle under "human
    // experience" draws in once those words are all in
    const n = Math.round(introLetters.length * pMorph);
    introLetters.forEach((s, i) => s.classList.toggle('is-on', i < n));
    introPill.classList.toggle('is-on', nameLetters().slice(-1)[0].classList.contains('is-on'));
    drawSquiggle();
  }

  // the intro squiggle draws once the last letter of its words is on screen
  function drawSquiggle() {
    const last = wavy.lastElementChild;
    wavy.classList.toggle('is-drawn', !!last && last.classList.contains('is-on'));
  }

  function setColour(keys) {
    Object.entries(greyEls).forEach(([k, el]) => {
      el.classList.toggle('is-colour', keys.includes(k));
      if (el.extra) el.extra.classList.toggle('is-colour', keys.includes(k)); // the grey plane
    });
  }

  // On the landing the colour cells wander: the oldest of the two fades back to grey while
  // a new cell fades to colour. The new cell is never the one just
  // left, and shares no edge with either colour cell (so not even mid-fade do they touch)
  function startHops() {
    const colour = [...LANDING_COLOUR];
    let left = null;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    sceneEl.classList.add('is-hopping'); // grey cells fade from here on
    clearInterval(hopTimer);
    hopTimer = setInterval(() => {
      const free = Object.keys(CELLS).filter((k) => !colour.includes(k) && k !== left
        && colour.every((c) => !NEIGHBOURS[c].includes(k)));
      if (!free.length) return;
      left = colour.shift();
      const next = pick(free);
      colour.push(next);
      setColour(colour);
    }, HOP_MS);
  }

  function step(now) {
    const t = now - t0;
    if (!target && t >= T.morph[0]) target = measureSlot();
    render(t);
    if (t < T.end) raf = requestAnimationFrame(step);
    else land();
  }

  // Hand the frame to the landing layout
  function land() {
    frameEl.removeAttribute('style');
    corners.forEach((el) => { el.style.opacity = 1; });
    slot.appendChild(frameEl);
    group.style.transform = 'none';
    root.classList.add('is-landed');
    if (!reduce) startHops();
  }

  // The landing box follows the viewport, and the scene keeps filling it
  addEventListener('resize', () => {
    if (root.classList.contains('is-landed')) setScene(landingZoom(), ...A_LAND);
  });

  function play() {
    cancelAnimationFrame(raf);
    target = null;
    render(0);
    t0 = performance.now();
    raf = requestAnimationFrame(step);
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Arriving from "Work" (index.html#work) skips the opening and lands straight on the page;
  // the plain address (the nav's plane) plays it. The #work is cleared so a reload plays it
  const skip = location.hash === '#work';
  if (skip) {
    history.replaceState(null, '', location.pathname + location.search);
    root.classList.add('is-work-entrance'); // grid lines and scrim appear without fading
  }

  // Start at the top, so the landing box is where the opening expects it
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  (document.fonts ? document.fonts.ready : Promise.resolve())
    .then(buildScene)
    .then(() => {
      if (reduce) { render(T.end); land(); }
      else if (skip) enter();
      else play();
    });

  // The "Work" entrance: no opening sequence, but the landing still animates in. The hero
  // box expands from its centre like the frames below, the intro types in (the tag popping
  // in after "I'm Jordan,", the squiggle drawing under its words) and the nav, scrim and grid
  // fade in with the landing; the rest reveals on scroll as usual
  const ENTER = { frame: [0, 1000], type: [350, 1350] };
  function enter() {
    render(T.end);                 // finished layout, colours and plane
    root.classList.add('is-entering-intro');
    land();
    introLetters.forEach((l) => l.classList.remove('is-on'));
    introPill.classList.remove('is-on');
    wavy.classList.remove('is-drawn');

    const r = slot.getBoundingClientRect();
    frameEl.style.setProperty('--fw', `${r.width}px`);
    frameEl.style.setProperty('--fh', `${r.height}px`);
    frameEl.classList.add('is-entering');
    frameEl.getBoundingClientRect(); // start from --r: 0
    requestAnimationFrame(() => frameEl.classList.add('is-in'));

    const t0 = performance.now();
    const nameEnd = document.querySelectorAll('.intro__name span').length;
    function type(now) {
      const p = span(now - t0, ENTER.type);
      const n = Math.round(introLetters.length * p);
      introLetters.forEach((l, i) => l.classList.toggle('is-on', i < n));
      introPill.classList.toggle('is-on', n >= nameEnd);
      drawSquiggle();
      if (now - t0 < Math.max(ENTER.type[1], ENTER.frame[1])) requestAnimationFrame(type);
      else {
        root.classList.remove('is-entering-intro');
        frameEl.classList.remove('is-entering', 'is-in');
        frameEl.style.removeProperty('--fw');
        frameEl.style.removeProperty('--fh');
      }
    }
    requestAnimationFrame(type);
  }

  // The frame has moved into the landing layout, so a replay starts from a fresh page
  document.getElementById('replay').addEventListener('click', () => location.reload());
})();
