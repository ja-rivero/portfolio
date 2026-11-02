(() => {
  // ---------- Picture: clouds + grid of nine cells (Figma 565:2532) ----------
  const root = document.documentElement;
  const group = document.getElementById('group');
  const frameEl = document.getElementById('frame');
  const boxEl = frameEl.querySelector('.box');
  const art = document.getElementById('art');
  const skyEl = document.getElementById('sky');
  const grid = document.getElementById('grid');
  const slot = document.getElementById('slot');
  const corners = frameEl.querySelectorAll('.corner');

  const ART_H = 473;
  // The picture's width and where its 130px centre column starts, per screen (Figma: 720 wide
  // with the column at x 151 for the first two screens, 712 wide with it at x 255 on the landing)
  const OPEN = { w: 720, x: 151 };
  const LANDED = { w: 712, x: 255 };
  const CELL_W = 130;
  // Rows: white 1px lines at y 194 / 338
  const ROWS = [[0, 194], [195, 338], [339, 473]];
  const cells = [];
  ROWS.forEach(([y0, y1]) => [0, 1, 2].forEach(() => {
    const c = document.createElement('div');
    c.className = 'grid__cell';
    Object.assign(c.style, { top: `${y0}px`, height: `${y1 - y0}px` });
    grid.appendChild(c);
    cells.push(c);
  }));
  const vLines = [0, 1].map(() => {
    const l = document.createElement('i');
    l.className = 'grid__line grid__line--v';
    grid.appendChild(l);
    return l;
  });
  [194, 338].forEach((y) => grid.insertAdjacentHTML('beforeend', `<i class="grid__line grid__line--h" style="top:${y}px"></i>`));

  // Lays the columns out for a picture `w` wide with the centre column starting at x
  function layoutGrid({ w, x }) {
    art.style.width = `${w}px`;
    const cols = [[0, x], [x + 1, x + CELL_W - 1], [x + CELL_W, w]];
    cells.forEach((c, i) => {
      const [x0, x1] = cols[i % 3];
      c.style.left = `${x0}px`;
      c.style.width = `${x1 - x0}px`;
    });
    vLines[0].style.left = `${x}px`;
    vLines[1].style.left = `${x + CELL_W - 1}px`;
  }
  layoutGrid(OPEN);

  // Cell indices, row by row: 0 1 2 / 3 4 5 / 6 7 8. Figma lights the centre, top right
  // and bottom left; on the landing the light moves between three diagonal sets
  const CENTRE = 4;
  const SETS = [[2, 4, 6], [0, 5, 7], [1, 3, 8]];

  // How lit a cell's gradient is, 0–1: it fades in and out, both loading and cycling
  function lightCell(i, lit) {
    cells[i].style.opacity = lit;
  }

  // Windows onto the picture for each screen, in picture px (Figma: the fill sits at
  // -151,-194 behind the 130×145 first box, at 0,-195 behind the 720×144 row box)
  const WIN = {
    cell: { x: OPEN.x, y: 194, w: CELL_W, h: 145 },
    row: { x: 0, y: 195, w: OPEN.w, h: 144 },
    all: { x: 0, y: 0, w: LANDED.w, h: ART_H },
  };
  const INSET = 8; // box inset, both sides, in the opening

  // ms
  const T = {
    corners: [0, 250],
    open: [200, 1100],      // the box opens onto the centre cell's clouds
    sky: [380, 1180],       // which fade in
    centre: [1000, 1600],   // then its gradient fades in
    widen: [1700, 2850],    // the box widens to the middle row
    morph: [3250, 4150],    // a short hold, then the box grows into the landing box, all nine cells
    lightTR: [3650, 4150],  // the other two Figma cells fade in, then the light starts moving
    lightBL: [3750, 4250],
    end: 4250,
  };
  // Landing: each diagonal set holds the light for a third of the cycle, crossfading
  const CYCLE = 12000;  // ms
  const CROSSFADE = 0.1; // of the cycle

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const span = (t, [a, b]) => clamp01((t - a) / (b - a));
  const easeOutExpo = (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p));
  const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOutQuad = (p) => 1 - (1 - p) * (1 - p);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, p) => a + (b - a) * p;
  const lerpWin = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });

  let raf, t0, target, scale, landedAt = 0;

  // Opening size follows the viewport: 1× at the 1512×810 Figma frame, never under 0.8× (so it
  // stays readable) unless it has to shrink to fit
  function openingScale() {
    const prop = Math.min(innerWidth / 1512, innerHeight / 810, 1.5);
    const fit = Math.min((innerWidth - 48) / (WIN.row.w + INSET), (innerHeight - 160) / (WIN.cell.h + INSET));
    return Math.min(fit, Math.max(0.8, prop));
  }

  // Landing box size comes from the slot, which CSS sizes to the viewport
  function measureSlot() {
    const r = slot.getBoundingClientRect();
    return {
      w: r.width,
      h: r.height,
      x: r.left + r.width / 2 - innerWidth / 2, // offset from the centred opening
      y: r.top + r.height / 2 - innerHeight / 2,
    };
  }

  // ---------- Sky: the cloud photo, cropped to fill the picture like Figma's object-cover ----------
  const skyImg = new Image();
  skyImg.src = 'assets/clouds-wide.jpg';
  skyImg.alt = '';
  skyEl.appendChild(skyImg);

  // Places the picture so window `win` sits on the box centre at zoom z
  function camera(win, z) {
    art.style.transform = `translate(${-(win.x + win.w / 2) * z}px, ${-(win.y + win.h / 2) * z}px) scale(${z})`;
    art.style.setProperty('--px', `${1 / z}px`);
  }

  // After landing, the light keeps moving between the diagonal sets
  function lightTick(now) {
    if (landedAt && !reduce) cycleLight(now - landedAt);
    requestAnimationFrame(lightTick);
  }

  function cycleLight(ms) {
    SETS.forEach((set, g) => set.forEach((i, j) => {
      // where this cell is in its set's turn; the set starting lit (Figma's) is mid-turn at 0
      const ph = (((ms / CYCLE) + 0.12 - g / 3 - j * 0.015) % 1 + 1) % 1;
      const lit = smooth(0, CROSSFADE, ph) * (1 - smooth(1 / 3, 1 / 3 + CROSSFADE, ph));
      lightCell(i, lit);
    }));
  }

  // ---------- Timeline ----------
  function render(t) {
    const pOpen = easeInOutCubic(span(t, T.open)); // the same quick-then-settle as the sky opening
    const pWiden = easeInOutCubic(span(t, T.widen));
    const pMorph = easeInOutCubic(span(t, T.morph));
    const to = target || measureSlot();

    // Outer frame: closed (just the corner ticks) → centre cell → middle row → landing box
    const cellW = WIN.cell.w * scale + INSET, cellH = WIN.cell.h * scale + INSET;
    const rowW = WIN.row.w * scale + INSET, rowH = WIN.row.h * scale + INSET;
    let w, h;
    if (t < T.widen[0]) { w = lerp(INSET, cellW, pOpen); h = lerp(INSET, cellH, pOpen); }
    else if (t < T.morph[0]) { w = lerp(cellW, rowW, pWiden); h = lerp(cellH, rowH, pWiden); }
    else { w = lerp(rowW, to.w, pMorph); h = lerp(rowH, to.h, pMorph); }
    frameEl.style.width = `${w}px`;
    frameEl.style.height = `${h}px`;
    frameEl.classList.toggle('is-closed', w < 11);
    // The box inset doubles (the 4px corner squares follow it) and the border thickens, on the way to the landing box
    frameEl.style.setProperty('--k', `${lerp(4, 8, pMorph)}px`);
    frameEl.style.setProperty('--b', pMorph < 0.5 ? '1px' : '2px');

    const c = easeOutQuad(span(t, T.corners));
    corners.forEach((el) => { el.style.opacity = c; });

    // The grid narrows a touch and its centre column slides right into the landing layout
    layoutGrid({ w: lerp(OPEN.w, LANDED.w, pMorph), x: lerp(OPEN.x, LANDED.x, pMorph) });

    // Camera: the window slides from the centre cell to the middle row to the whole grid.
    // Zoom holds while the box opens, then follows the box width
    const win = t < T.widen[0] ? WIN.cell
      : t < T.morph[0] ? lerpWin(WIN.cell, WIN.row, pWiden)
      : lerpWin(WIN.row, WIN.all, pMorph);
    const boxW = w - 2 * parseFloat(frameEl.style.getPropertyValue('--k'));
    camera(win, t < T.widen[0] ? scale : boxW / win.w);

    group.style.transform = `translate(${to.x * pMorph}px, ${to.y * pMorph}px)`;

    skyImg.style.opacity = easeOutQuad(span(t, T.sky));
    // same smooth fade as the landing cycle
    lightCell(CENTRE, smooth(0, 1, span(t, T.centre)));
    lightCell(2, smooth(0, 1, span(t, T.lightTR)));
    lightCell(6, smooth(0, 1, span(t, T.lightBL)));
  }

  function tick(now) {
    const t = now - t0;
    if (!target && t >= T.morph[0]) target = measureSlot();
    render(t);
    if (t < T.end) raf = requestAnimationFrame(tick);
    else land();
  }

  // Hand the frame to the landing layout, then bring in the nav and side content
  function land() {
    frameEl.removeAttribute('style');
    frameEl.style.setProperty('--k', '8px');
    frameEl.style.setProperty('--b', '2px');
    corners.forEach((el) => { el.style.opacity = 1; });
    slot.appendChild(frameEl);
    group.style.transform = 'none';
    fitLanding();
    document.querySelectorAll('[data-in]').forEach((el, i) => el.style.setProperty('--d', `${Math.min(i, 10) * 0.07}s`)); // about page stagger
    root.classList.add('is-landed');
    landedAt = performance.now();
    document.dispatchEvent(new CustomEvent('opening:done'));
  }

  // Landed: the whole picture fills the box, whatever size the viewport makes it
  function fitLanding() {
    layoutGrid(LANDED);
    camera(WIN.all, (slot.getBoundingClientRect().width - 2 * INSET) / LANDED.w);
  }

  // ---------- Full sky: one scroll down and the frame fills the viewport (Figma 566:3062) ----------
  const SKY_W = 840; // the photo's width in picture px, so at full size it covers the viewport
  const FULL_MS = 1100;
  let full = false, busy = false, fullP = 0, lockUntil = 0;

  // p 0 → 1: the frame grows from the slot to just past the viewport edges, so the border and
  // corner ticks slide off screen, and the grid lines and gradients fade out
  function renderFull(p) {
    const s = slot.getBoundingClientRect();
    const pad = 12; // corner tick + box border past each edge
    const x = lerp(s.left, -pad, p), y = lerp(s.top, -pad, p);
    const w = lerp(s.width, innerWidth + 2 * pad, p), h = lerp(s.height, innerHeight + 2 * pad, p);
    frameEl.style.setProperty('--fx', `${x}px`);
    frameEl.style.setProperty('--fy', `${y}px`);
    frameEl.style.setProperty('--fw', `${w}px`);
    frameEl.style.setProperty('--fh', `${h}px`);
    // zoom out to the whole photo (object-cover) rather than the grid's width
    camera(WIN.all, Math.max((w - 2 * INSET) / lerp(LANDED.w, SKY_W, p), (h - 2 * INSET) / ART_H));
    grid.style.opacity = 1 - smooth(0, 0.7, p);
    if (openCaseEl) return; // in a study (a resize got here): the study owns the nav
    root.classList.toggle('is-full', p > 0.5);
    setNav(p > 0.5 ? 'work' : 'intro');
  }

  // Nav: which section is current
  const navLinks = [...document.querySelectorAll('[data-nav]')];
  function setNav(id) {
    navLinks.forEach((a) => {
      const on = a.dataset.nav === id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function setFull(on, then) {
    if (busy || on === full) return;
    busy = true;
    full = on;
    if (on) frameEl.classList.add('is-free');
    else { hidePlanes(); root.classList.remove('is-cases'); }
    const from = fullP, start = performance.now() + (on ? 0 : 250);
    const ms = reduce ? 1 : FULL_MS;
    const step = (now) => {
      const k = clamp01((now - start) / ms);
      fullP = lerp(from, on ? 1 : 0, easeInOutCubic(k));
      renderFull(fullP);
      if (k < 1) { requestAnimationFrame(step); return; }
      busy = false;
      lockUntil = performance.now() + 350; // let trackpad momentum die down
      if (on) flyPlanes();
      else { frameEl.classList.remove('is-free'); grid.style.opacity = ''; fitLanding(); }
      if (then) then();
    };
    requestAnimationFrame(step);
  }

  // ---------- Planes: the coral sticker (150×56), turned and recoloured per Figma 566:3134 ----------
  // x/y/w/h: the turned plane's box in the 1512×785 sky. rot/flip turn the sticker. Every plane
  // is tinted Figma's grey (colour blend) until hovered, then shows its own colour: hot
  // ('transparent' leaves the coral sticker as is). dir: where the nose points. art: a different
  // plane from the sheet (Figma 586:6107, 586:6090), cut out at 2× and drawn at aw×ah. top: empty
  // space above the turned plane inside its box, so the "coming soon!" tag sits on the wing
  // (negative lifts the tag clear of a nose that reaches the top)
  const GREY = '#cdd0dd';
  const PLANES = [
    { id: 'cardinal', x: 179, y: 297, w: 150, h: 56, rot: 0, flip: 1, hot: 'transparent', dir: [1, -0.08] },
    { id: 'docusign', x: 415.9, y: 448.2, w: 148.59, h: 98.82, rot: 9.09, flip: 1, hot: '#a98242', dir: [1, -0.09], art: 'plane-gold.png', aw: 138, ah: 78 },
    { id: 'wispr', soon: true, x: 666, y: 571.28, w: 158.14, h: 122.55, rot: -150.53, flip: -1, hot: '#543665', dir: [-1, -0.65], top: -8 },
    { id: 'pinterest', soon: true, x: 961.47, y: 219, w: 160.11, h: 105.33, rot: -20.66, flip: 1, hot: '#a94270', dir: [1, -0.45], top: -8 },
    { id: 'pixr', soon: true, x: 1148.95, y: 444.12, w: 142.11, h: 152.75, rot: 53.83, flip: 1, hot: '#4251a9', dir: [1, 0.75], art: 'plane-blue.png', aw: 130, ah: 81, top: 25 },
  ];
  const FLY_DELAY = { cardinal: 0, docusign: 380, wispr: 160, pinterest: 520, pixr: 260 };
  const planesEl = document.getElementById('planes');
  const chips = Object.fromEntries([...document.querySelectorAll('.case-chip')].map((c) => [c.dataset.case, c]));

  PLANES.forEach((pl) => {
    const len = Math.hypot(...pl.dir);
    pl.dx = pl.dir[0] / len;
    pl.dy = pl.dir[1] / len;
    const el = document.createElement('a');
    el.className = 'plane';
    el.href = chips[pl.id].getAttribute('href');
    el.tabIndex = -1; // the chips are the keyboard route
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--dx', pl.dx);
    el.style.setProperty('--dy', pl.dy);
    el.style.setProperty('--rot', `${pl.rot}deg`);
    el.style.setProperty('--flip', pl.flip);
    el.style.setProperty('--tint', GREY);
    el.style.setProperty('--hot', pl.hot);
    if (pl.top) el.style.setProperty('--top', `${pl.top}px`);
    el.innerHTML = '<span class="plane__body"><span class="plane__art"><i class="plane__tint"></i></span></span>'
      + (pl.soon ? '<span class="plane__soon">coming soon!</span>' : ''); // no study yet (Figma 566:4546)
    if (pl.soon) chips[pl.id].setAttribute('aria-label', `${pl.id}, coming soon`);
    if (pl.art) {
      const art = el.querySelector('.plane__art');
      art.style.setProperty('--sheet', `url("assets/planes/${pl.art}") 0 0 / 100% 100% no-repeat`);
      Object.assign(art.style, { width: `${pl.aw}px`, height: `${pl.ah}px` });
    }
    planesEl.appendChild(el);
    pl.el = el;

    // a plane and its chip highlight together
    const hot = (on) => { el.classList.toggle('is-hot', on); chips[pl.id].classList.toggle('is-hot', on); };
    [el, chips[pl.id]].forEach((t) => {
      t.addEventListener('pointerenter', () => hot(true));
      t.addEventListener('pointerleave', () => hot(false));
    });
    chips[pl.id].addEventListener('focus', () => hot(true));
    chips[pl.id].addEventListener('blur', () => hot(false));
  });

  // Narrow screens: the planes zigzag down the upper part of the screen instead, clear of the
  // case panel at the bottom (centres as shares of the viewport)
  const PORTRAIT = { cardinal: [0.3, 0.17], pinterest: [0.72, 0.27], docusign: [0.28, 0.4], pixr: [0.7, 0.5], wispr: [0.42, 0.63] };

  // Sky positions scale with the viewport; plane size follows the smaller ratio so they keep shape
  function layoutPlanes() {
    const narrow = innerWidth < 700;
    const sx = innerWidth / 1512, sy = innerHeight / 785;
    const s = narrow ? Math.min(1, Math.max(0.55, innerWidth / 600)) : Math.max(0.6, Math.min(sx, sy));
    PLANES.forEach((pl) => {
      pl.cx = narrow ? PORTRAIT[pl.id][0] * innerWidth : (pl.x + pl.w / 2) * sx;
      pl.cy = narrow ? PORTRAIT[pl.id][1] * innerHeight : (pl.y + pl.h / 2) * sy;
      Object.assign(pl.el.style, {
        left: `${pl.cx - (pl.w * s) / 2}px`, top: `${pl.cy - (pl.h * s) / 2}px`,
        width: `${pl.w * s}px`, height: `${pl.h * s}px`,
      });
      pl.el.style.setProperty('--s', s);
      pl.r = Math.hypot(pl.w, pl.h) * s / 2;
    });
  }
  layoutPlanes();

  // Each plane flies in along a straight line, nose first, from whichever edge is behind it
  function flyPlanes() {
    layoutPlanes();
    PLANES.forEach((pl) => {
      const { dx, dy, cx, cy, r } = pl;
      const tx = dx > 0 ? (cx + r) / dx : dx < 0 ? (innerWidth - cx + r) / -dx : Infinity;
      const ty = dy > 0 ? (cy + r) / dy : dy < 0 ? (innerHeight - cy + r) / -dy : Infinity;
      const d = Math.min(tx, ty);
      pl.el.getAnimations().forEach((a) => a.cancel());
      pl.el.animate([
        { transform: `translate(${-dx * d}px, ${-dy * d}px)`, opacity: 1 },
        { transform: 'translate(0, 0)', opacity: 1 },
      ], {
        duration: reduce ? 0 : 1100 + d * 0.5,
        delay: reduce ? 0 : FLY_DELAY[pl.id],
        easing: 'cubic-bezier(0.2, 0.65, 0.3, 1)',
        fill: 'both',
      });
    });
    setTimeout(() => { if (full && !openCaseEl) root.classList.add('is-cases'); }, reduce ? 0 : 500);
  }

  function hidePlanes() {
    PLANES.forEach((pl) => {
      pl.el.getAnimations().forEach((a) => a.cancel());
      pl.el.classList.remove('is-hot');
      chips[pl.id].classList.remove('is-hot');
      pl.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-out' });
    });
  }

  // ---------- Case study: a click scrolls down through the scrim into it ----------
  const CASES = { cardinal: document.getElementById('case-cardinal'), docusign: document.getElementById('case-docusign') };
  const SCROLL_MS = 1800;
  let openCaseEl = null, autoScroll = null, caseFromY = 0; // caseFromY: scroll when it opened

  function openCase(id) {
    const el = CASES[id];
    if (!el || !full || busy || openCaseEl) return;
    openCaseEl = el;
    PLANES.forEach((pl) => { pl.el.classList.remove('is-hot'); chips[pl.id].classList.remove('is-hot'); });
    root.classList.remove('is-cases');
    root.classList.add('is-case');
    caseFromY = scrollY; // 0 on desktop; the landing's bottom on phones, where it scrolls
    armReveal(el);
    el.hidden = false;
    scrollToY(caseTop(), arriveCase);
  }

  // The study's content eases up as it scrolls into view, like the about page (reveal.js): each
  // heading, paragraph, image, video and list item rises 14px, 70ms apart when several arrive
  // together. Re-armed on every open, so a study plays its entrance each time
  let revealIO = null;
  function armReveal(caseEl) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    revealIO = revealIO || new IntersectionObserver((entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        .forEach((el, k) => {
          const delay = Math.min(k, 10) * 70;
          el.style.setProperty('--d', `${delay}ms`);
          el.classList.add('is-in');
          revealIO.unobserve(el);
          // once it has arrived, hand the element back to its normal styles
          setTimeout(() => {
            el.removeAttribute('data-reveal');
            el.classList.remove('is-in');
            el.style.removeProperty('--d');
          }, delay + 1200);
        });
    }, { threshold: 0 });
    // the outermost pieces only, so a figure rises with its video and caption as one
    const all = [...caseEl.querySelectorAll('.case__body :is(h1, h2, h3, p, li, dl, img, video, figure)')];
    const set = new Set(all);
    all
      .filter((el) => { for (let p = el.parentElement; p !== caseEl; p = p.parentElement) if (set.has(p)) return false; return true; })
      .forEach((el) => {
        el.classList.remove('is-in');
        el.setAttribute('data-reveal', '');
        revealIO.observe(el);
      });
  }
  const caseTop = () => openCaseEl.querySelector(".case__body").getBoundingClientRect().top + scrollY; // the glide ends exactly where the arrived view starts

  // Arrived: drop the scrim and landing above the study (CSS), so scrolling up stops at its top
  function arriveCase() {
    root.classList.add('is-case-in');
    scrollTo(0, 0);
  }

  // Back to the planes: put the scrim back above the study (without moving the view), then
  // glide up through it
  function leaveCase(then) {
    if (!openCaseEl || autoScroll) return;
    const fromTop = scrollY;
    // The footer stays pinned on the way up so the study slides back down over it
    root.classList.add('is-case-leaving');
    root.classList.remove('is-case-in');
    scrollTo(0, caseTop() + fromTop);
    scrollToY(caseFromY, () => { closeCase(); if (then) then(); });
  }

  function closeCase() {
    if (!openCaseEl) return;
    openCaseEl.hidden = true;
    openCaseEl = null;
    root.classList.remove('is-case', 'is-case-leaving');
    root.classList.add('is-full');
    planesEl.style.transform = planesEl.style.opacity = '';
    root.classList.add('is-cases');
    setNav('work');
    lockUntil = performance.now() + 700; // the scroll that brought you back shouldn't also close the sky
  }

  // Eased scroll; scroll input is held while it runs (see the gesture handlers)
  function scrollToY(y, then) {
    cancelAnimationFrame(autoScroll);
    const from = scrollY, start = performance.now(), ms = reduce ? 1 : SCROLL_MS;
    const step = (now) => {
      const k = clamp01((now - start) / ms);
      scrollTo(0, lerp(from, y, easeInOutCubic(k)));
      if (k < 1) autoScroll = requestAnimationFrame(step);
      else { autoScroll = null; if (then) then(); }
    };
    autoScroll = requestAnimationFrame(step);
  }

  // During the glides the planes drift up and fade under the scrim, and the nav turns solid once
  // the scrim's opaque end has passed it
  addEventListener('scroll', () => {
    if (!openCaseEl || root.classList.contains('is-case-in')) return;
    const y = scrollY - caseFromY, h = innerHeight;
    planesEl.style.transform = `translateY(${-y * 0.5}px)`;
    planesEl.style.opacity = 1 - smooth(0.15, 0.9, y / h);
    const body = openCaseEl.querySelector('.case__body').getBoundingClientRect();
    root.classList.toggle('is-full', body.top > 48 + h * 0.2);
    // Once the study has covered the footer again, let it drop back into flow, out of sight
    if (body.bottom >= h) root.classList.remove('is-case-leaving');
  }, { passive: true });

  PLANES.forEach((pl) => [pl.el, chips[pl.id]].forEach((t) => t.addEventListener('click', (e) => {
    e.preventDefault();
    openCase(pl.id);
  })));
  // "return to works", at the top and at the bottom
  document.querySelectorAll('[data-case-back]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    leaveCase();
  }));

  // intro: back to the landing (out of a case study first); work: up into the sky
  navLinks.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    if (!root.classList.contains('is-landed') || busy) return;
    if (a.dataset.nav === 'work') {
      if (openCaseEl) leaveCase();
      else setFull(true);
    } else if (openCaseEl) leaveCase(() => setFull(false));
    else setFull(false);
  }));

  // Coming back to the landing via "intro" on the about page: no replay of the opening, just
  // the about page's entrance, a quick staggered rise (the box too when withBox)
  let enterTimer = 0;
  function enterLanding(withBox, delay = 0) {
    const els = [...document.querySelectorAll('.landing [data-in]' + (withBox ? ', .slot' : ''))];
    els.forEach((el, k) => el.style.setProperty('--rd', `${Math.min(k, 10) * 70}ms`));
    clearTimeout(enterTimer);
    root.classList.remove('is-reveal');
    root.classList.add('is-entering');
    root.classList.toggle('is-entering-box', withBox);
    enterTimer = setTimeout(() => {
      void root.offsetHeight; // commit the hidden state so the rise transitions
      root.classList.add('is-reveal');
      root.classList.remove('is-entering', 'is-entering-box');
      enterTimer = setTimeout(() => root.classList.remove('is-reveal'), 1600);
    }, delay);
  }

  // Landing links straight into a study ("designer @cardinal"): up into the sky, then down into it
  function goCase(id) {
    if (!root.classList.contains('is-landed') || busy) return;
    if (full) openCase(id);
    else setFull(true, () => openCase(id));
  }
  document.querySelectorAll('[data-go-case]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    goCase(a.dataset.goCase);
  }));

  // Case study videos play while on screen and pause off it (stills show until then, and
  // with reduced motion they stay stills)
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) v.play().catch(() => {});
      else v.pause();
    }), { threshold: 0.35 });
    document.querySelectorAll('.case video').forEach((v) => seen.observe(v));
  }

  // ---------- Scroll gestures: down opens the sky, up brings the landing back ----------
  const ready = () => root.classList.contains('is-landed') && !busy && performance.now() > lockUntil;
  // The sky opens on a scroll down past the end of the landing (desktop: no scroll, always there)
  const atEnd = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 2;

  addEventListener('wheel', (e) => {
    if (openCaseEl) { if (autoScroll) e.preventDefault(); return; } // the study scrolls natively, except mid-glide
    if (full || busy) e.preventDefault();
    if (!ready() || Math.abs(e.deltaY) < 4) return;
    if (e.deltaY > 0 && !full && atEnd()) { e.preventDefault(); setFull(true); }
    else if (e.deltaY < 0 && full) setFull(false);
  }, { passive: false });

  addEventListener('keydown', (e) => {
    const down = ['ArrowDown', 'PageDown', ' '].includes(e.key), up = ['ArrowUp', 'PageUp'].includes(e.key);
    if (openCaseEl || !(down || up) || e.target.closest('input, textarea')) return;
    if (full || busy) e.preventDefault();
    if (!ready()) return;
    if (down && !full && atEnd()) { e.preventDefault(); setFull(true); }
    else if (up && full) setFull(false);
  });

  let touchY = null;
  addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (openCaseEl && autoScroll) e.preventDefault();
    if (touchY === null || openCaseEl) return;
    const dy = touchY - e.touches[0].clientY;
    if (full || busy) e.preventDefault();
    if (!ready() || Math.abs(dy) < 30) return;
    touchY = null;
    if (dy > 0 && !full && atEnd()) setFull(true);
    else if (dy < 0 && full) setFull(false);
  }, { passive: false });

  addEventListener('resize', () => {
    scale = openingScale();
    layoutPlanes();
    if (fullP > 0) renderFull(fullP);
    else if (root.classList.contains('is-landed')) fitLanding();
  });

  function play() {
    cancelAnimationFrame(raf);
    target = null;
    render(0);
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // after fonts (so the slot has its final size) and the photo
  Promise.all([document.fonts ? document.fonts.ready : null, skyImg.decode()])
    .then(() => {
      scale = openingScale();
      requestAnimationFrame(lightTick);
      // Arriving from the about page (index.html#intro / #work / #cardinal) skips the opening
      const hash = location.hash.slice(1);
      if (hash === 'intro' && !reduce) enterLanding(true, 50);
      if (reduce || hash) { render(T.end); land(); } else play();
      if (hash) history.replaceState(null, '', location.pathname);
      if (hash === 'work') setFull(true);
      else if (CASES[hash]) goCase(hash);
    });
})();
