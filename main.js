(() => {
  // The intro plays at the top of the page, so don't restore an old scroll position
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const root = document.documentElement;
  const ball = document.getElementById('ball');
  const body = ball.querySelector('.ball__body');
  const text = document.getElementById('text');
  const slot = document.getElementById('slot');
  const home = document.getElementById('home');

  // Roll
  const V_MAX = 190;         // px/s cruising speed
  const ACCEL_TIME = 0.25;   // s to reach cruising speed
  const OMEGA = 13;          // settle spring stiffness (rad/s)
  const ZETA = 0.42;         // under-damped → overshoots, then rolls back
  const FADE = 14;           // px of soft edge on each revealed letter

  // Grow: three springy steps, the last one lands on the home ball
  const GROW_STEPS = [0.16, 0.42, 1];
  const GROW_DELAY = 500;    // ms the finished line holds before growing
  const GROW_PAUSE = 180;    // ms between steps
  const GROW_OMEGA = 15;
  const GROW_ZETA = 0.5;

  // Split into letter spans so each one can appear as the ball passes it
  const full = text.textContent;
  text.textContent = '';
  const chars = [...full].map((c) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = c;
    text.appendChild(s);
    return s;
  });

  let D, R, fullW, startX, endX, charX;
  let x, v, revealed, shown, phase, t0, last, raf;
  let grow; // { p, v, step, wait, from, to }

  function measure() {
    D = ball.offsetWidth;
    R = D / 2;
    fullW = text.scrollWidth;
    // Relative to the line itself (offsetLeft also counts the intro padding)
    charX = chars.map((s) => s.offsetLeft - chars[0].offsetLeft);
    startX = 0;
    endX = fullW - D;
  }

  function render() {
    // Visible line grows with the ball's leading edge and never shrinks back
    revealed = Math.max(revealed, Math.min(fullW, x + D));
    const offset = (fullW - revealed) / 2; // keep the group optically centered

    ball.style.transform = `translateX(${offset + x}px)`;
    body.style.transform = `rotate(${(x / R) * (180 / Math.PI)}deg)`;
    text.style.transform = `translateX(${offset}px)`;

    // Letters appear in step with the ball's progress: nothing at rest,
    // the full line (fade included) once it reaches the end
    shown = Math.max(shown, (Math.min(x, endX) / endX) * (fullW + FADE));
    for (let i = 0; i < chars.length; i++) {
      const p = Math.min(1, Math.max(0, (shown - charX[i]) / FADE));
      chars[i].style.opacity = p;
      chars[i].style.transform = `translateY(${(1 - p) * 3}px)`;
    }
  }

  // Page-space rects (scroll-independent) for where the ball starts and ends
  function pageRect(el) {
    const r = el.getBoundingClientRect();
    return { left: r.left + scrollX, top: r.top + scrollY, size: r.width };
  }

  // Lift the ball out of the intro so it can be resized for real (scaling a
  // 39px drawing up to 637px leaves a soft, lumpy edge)
  function detachBall() {
    const from = pageRect(ball);
    const spacer = document.createElement('div');
    spacer.style.cssText = `width:${D}px;height:${D}px`;
    ball.replaceWith(spacer);
    home.appendChild(ball); // home clips the ball if it runs past the viewport
    ball.classList.add('is-free');
    ball.style.transform = 'none';
    return from;
  }

  function renderGrow() {
    const { p, from, to } = grow;
    const base = pageRect(home); // ball is positioned inside the home section
    const s = ball.style;
    s.left = `${from.left + (to.left - from.left) * p - base.left}px`;
    s.top = `${from.top + (to.top - from.top) * p - base.top}px`;
    s.width = s.height = `${from.size + (to.size - from.size) * p}px`;
  }

  function startGrow(now) {
    grow = { p: 0, v: 0, step: 0, wait: now + GROW_DELAY };
    grow.from = detachBall();
    grow.to = pageRect(slot);
    renderGrow();
    phase = 'grow';
  }

  function finish() {
    unlockScroll();
    phase = 'done';
    root.classList.add('is-grown');
    startTakeover();
  }

  function tick(now) {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;

    if (phase === 'roll') {
      // Push builds quickly, then the ball coasts at cruise speed
      const k = Math.min(1, (now - t0) / 1000 / ACCEL_TIME);
      v = V_MAX * k * (2 - k);
      x += v * dt;
      if (x >= endX) { phase = 'settle'; }
    } else if (phase === 'settle') {
      // Damped spring around the resting point: momentum carries the ball
      // past the end, then it rolls back and settles
      const a = -OMEGA * OMEGA * (x - endX) - 2 * ZETA * OMEGA * v;
      v += a * dt;
      x += v * dt;
      if (Math.abs(x - endX) < 0.4 && Math.abs(v) < 4) {
        x = endX; v = 0;
        render();
        startGrow(now);
      }
    }

    if (phase === 'grow') {
      if (now >= grow.wait) {
        if (grow.step === 0 && grow.p === 0) root.classList.add('is-growing');
        // Each step springs to its target size, overshooting slightly like a pop
        const target = GROW_STEPS[grow.step];
        const a = -GROW_OMEGA * GROW_OMEGA * (grow.p - target) - 2 * GROW_ZETA * GROW_OMEGA * grow.v;
        grow.v += a * dt;
        grow.p += grow.v * dt;
        if (Math.abs(grow.p - target) < 0.002 && Math.abs(grow.v) < 0.02) {
          grow.p = target; grow.v = 0;
          if (grow.step === GROW_STEPS.length - 1) finish();
          else { grow.step++; grow.wait = now + GROW_PAUSE; }
        }
      }
      renderGrow();
    } else if (phase !== 'done') {
      render();
    }

    if (phase !== 'done') raf = requestAnimationFrame(tick);
  }

  function play() {
    cancelAnimationFrame(raf);
    measure();
    x = startX; v = 0; revealed = D; shown = 0;
    phase = 'roll';
    t0 = last = performance.now();
    render();
    raf = requestAnimationFrame(tick);
  }

  function showFinal() {
    measure();
    x = endX; v = 0; revealed = fullW; shown = fullW + FADE;
    render();
    grow = { p: 1, v: 0, step: GROW_STEPS.length - 1 };
    detachBall();
    grow.from = grow.to = pageRect(slot);
    root.classList.add('is-growing');
    renderGrow();
    finish();
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skipIntro = root.classList.contains('skip-intro'); // arrived via the "work" link

  // The page can't scroll until the ball has finished growing
  const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown']);
  const blockInput = (e) => {
    if (e.type !== 'keydown' || SCROLL_KEYS.has(e.key)) e.preventDefault();
  };
  const holdTop = () => { if (scrollY) window.scrollTo(0, 0); }; // e.g. dragging the scrollbar
  function lockScroll() {
    ['wheel', 'touchmove', 'keydown'].forEach((t) => addEventListener(t, blockInput, { passive: false }));
    addEventListener('scroll', holdTop);
  }
  function unlockScroll() {
    ['wheel', 'touchmove', 'keydown'].forEach((t) => removeEventListener(t, blockInput, { passive: false }));
    removeEventListener('scroll', holdTop);
  }
  if (!reduce && !skipIntro) lockScroll();

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    if (reduce || skipIntro) showFinal(); else play();
    if (skipIntro) {
      // Let the settled layout paint without transitions, then restore them and
      // play the page entrance (same as the about page)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        root.classList.remove('skip-intro');
        if (window.startReveal) window.startReveal();
      }));
      history.replaceState(null, '', location.pathname);
    }
    placeNotes(); // re-measure once the web font has loaded
    document.getElementById('intro').classList.add('is-ready');
  });

  // Side notes keep the same gap from the ball's curve on both sides, at any
  // ball size (CSS percentages drift because the note boxes don't scale)
  const NOTE_GAP = 0.085; // of the ball width, from the 637px design
  const stackedNotes = window.matchMedia('(max-width: 860px)');

  function placeNotes() {
    const S = slot.offsetWidth;
    const r = S / 2;
    for (const note of slot.querySelectorAll('.note')) {
      note.style.left = note.style.right = '';
      if (stackedNotes.matches) continue;
      const y = note.offsetTop + note.offsetHeight / 2;
      const reach = Math.sqrt(Math.max(0, r * r - (y - r) ** 2));
      const gap = S * NOTE_GAP;
      if (note.classList.contains('note--shiny')) {
        note.style.left = `${r + reach + gap}px`;
        note.style.right = 'auto';
      } else {
        note.style.left = 'auto';
        note.style.right = `${S - (r - reach - gap)}px`;
      }
    }
  }

  placeNotes();
  window.addEventListener('resize', placeNotes);

  // ---------- Scroll takeover ----------
  // While the home screen is pinned, scrolling grows the ball in three springy
  // steps until it swallows the viewport, then the page switches to dark mode.
  const takeover = document.getElementById('takeover');
  const light = ball.querySelector('.ball__light');
  const TAKE_AT = [0.12, 0.42, 0.72];   // scroll progress that triggers each step
  const TAKE_STEPS = [0.14, 0.4, 1];    // share of the way to covering the screen
  const TAKE_OMEGA = 13;
  const TAKE_ZETA = 0.55;
  const DARK_AT = 0.9;                  // ball is (nearly) covering the screen
  const take = { k: 0, v: 0, raf: 0, last: 0 };

  function takeDistance() { return innerHeight * 1.2; }

  // Pin the home screen; if it is taller than the viewport (stacked layouts),
  // let it scroll until its bottom is in view first
  function layoutTakeover() {
    const overflow = Math.max(0, home.offsetHeight - innerHeight);
    home.style.top = `${-overflow}px`;
    takeover.style.height = `${home.offsetHeight + takeDistance()}px`;
  }

  function takeProgress() {
    const start = takeover.offsetTop + Math.max(0, home.offsetHeight - innerHeight);
    return (scrollY - start) / takeDistance();
  }

  function takeTarget() {
    const passed = TAKE_AT.filter((t) => takeProgress() >= t).length;
    return passed ? TAKE_STEPS[passed - 1] : 0;
  }

  function renderTakeover() {
    const h = home.getBoundingClientRect();
    const sl = slot.getBoundingClientRect();
    const base = sl.width;
    const cx = sl.left - h.left + base / 2;   // ball centre in home coordinates
    const cy = sl.top - h.top + base / 2;
    // Diameter that reaches the farthest viewport corner from the ball's centre
    const vx = h.left + cx, vy = h.top + cy;
    const reach = Math.hypot(Math.max(vx, innerWidth - vx), Math.max(vy, innerHeight - vy));
    const size = base + (reach * 2 + 8 - base) * take.k;

    const s = ball.style;
    s.left = `${cx - size / 2}px`;
    s.top = `${cy - size / 2}px`;
    s.width = s.height = `${size}px`;
    // The reflection belongs to a ball, not a whole screen: fade it as it grows
    light.style.opacity = Math.max(0, 1 - take.k / 0.45);

    root.classList.toggle('is-taking', take.k > 0.01 || takeTarget() > 0);
    root.classList.toggle('is-dark', take.k >= DARK_AT);
  }

  function takeTick(now) {
    const dt = Math.min(0.033, (now - take.last) / 1000);
    take.last = now;
    const target = takeTarget();
    if (reduce) {
      take.k = target; take.v = 0;
    } else {
      const a = -TAKE_OMEGA * TAKE_OMEGA * (take.k - target) - 2 * TAKE_ZETA * TAKE_OMEGA * take.v;
      take.v += a * dt;
      take.k = Math.max(0, take.k + take.v * dt);
    }
    renderTakeover();
    if (Math.abs(take.k - target) < 0.0005 && Math.abs(take.v) < 0.005) {
      take.k = target; take.v = 0; take.raf = 0;
      renderTakeover();
    } else {
      take.raf = requestAnimationFrame(takeTick);
    }
  }

  function wakeTakeover() {
    if (phase !== 'done' || take.raf) return;
    take.last = performance.now();
    take.raf = requestAnimationFrame(takeTick);
  }

  function startTakeover() {
    layoutTakeover();
    renderTakeover();
    wakeTakeover(); // in case the page was scrolled during the intro
  }

  layoutTakeover();
  window.addEventListener('scroll', wakeTakeover, { passive: true });

  // Keep the grown ball locked onto its slot as the layout changes
  window.addEventListener('resize', () => {
    layoutTakeover();
    if (phase !== 'done') return;
    renderTakeover();
    wakeTakeover();
  });

  // Links to the case studies glide down to them (through the ball takeover)
  document.querySelectorAll('a[href="#work"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('work').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  // Already on the home page: "work" just glides back to the top
  document.querySelectorAll('a[href="index.html#home"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  // ---------- Project strips ----------
  // Trackpads and touch scroll them natively; let mouse users drag them too.
  // A project with a case study (data-href) opens it on a click (not a drag).
  for (const strip of document.querySelectorAll('.project__strip')) {
    const href = strip.closest('.project').dataset.href;
    let startX = 0, startLeft = 0, dragging = false, moved = false;

    strip.addEventListener('pointerdown', (e) => {
      moved = false;
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startLeft = strip.scrollLeft;
      strip.setPointerCapture(e.pointerId);
      strip.classList.add('is-dragging');
    });
    strip.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (Math.abs(e.clientX - startX) > 5) moved = true;
      strip.scrollLeft = startLeft - (e.clientX - startX);
    });
    const stop = () => { dragging = false; strip.classList.remove('is-dragging'); };
    strip.addEventListener('pointerup', stop);
    strip.addEventListener('pointercancel', stop);

    if (href) {
      strip.classList.add('is-link');
      strip.setAttribute('role', 'link');
      strip.addEventListener('click', () => { if (!moved) window.location.href = href; });
      strip.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.location.href = href; });
    }
  }

  // "study coming soon!" tag: eases after the cursor over projects without a case study
  const tag = document.getElementById('cursorTag');
  if (tag && window.matchMedia('(hover: hover)').matches) {
    const LAG = 9;           // how quickly the tag catches up (higher = snappier)
    const OFFSET = 16;       // sits down-right of the cursor
    let tx = 0, ty = 0, x = 0, y = 0, on = false, tagRaf = 0, tagLast = 0;

    const follow = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - tagLast) / 1000));
      tagLast = now;
      const k = reduce ? 1 : 1 - Math.exp(-LAG * dt);
      x += (tx - x) * k;
      y += (ty - y) * k;
      tag.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      tagRaf = (on || Math.abs(tx - x) + Math.abs(ty - y) > 0.5) ? requestAnimationFrame(follow) : 0;
    };

    document.querySelectorAll('.project:not([data-href])').forEach((p) => {
      p.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        tx = e.clientX + OFFSET; ty = e.clientY + OFFSET;
        if (!on) { x = tx; y = ty; }   // appear at the cursor, then trail it
        on = true;
        tag.classList.add('is-on');
        if (!tagRaf) { tagLast = performance.now(); tagRaf = requestAnimationFrame(follow); }
      });
      p.addEventListener('pointermove', (e) => { tx = e.clientX + OFFSET; ty = e.clientY + OFFSET; });
      p.addEventListener('pointerleave', () => { on = false; tag.classList.remove('is-on'); });
    });
  }

  // Case study videos play only while on screen (and not for reduced motion)
  const videos = document.querySelectorAll('.tile__video');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting) target.play().catch(() => {});
        else target.pause();
      }
    }, { rootMargin: '200px 0px' });
    videos.forEach((v) => io.observe(v));
  }
})();
