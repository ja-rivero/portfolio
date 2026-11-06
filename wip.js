(() => {
  // "Still tinkering..." (Figma 696:28033): a black tag that follows the cursor while it's over
  // a case study that doesn't have its own page yet (a .work card with no .work__link). Each
  // time it shows, its letters type in like the intro. Only for a mouse or trackpad: touch
  // screens have no cursor to follow
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const cards = [...document.querySelectorAll('.work')].filter((w) => !w.querySelector('.work__link'));
  if (!cards.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TEXT = 'Still tinkering...';
  const LETTER_MS = 12;              // typing pace
  const OFFSET = { x: 16, y: 18 };   // tag's top-left corner, down and right of the pointer
  const EASE = 0.28;                 // how quickly it catches up with the pointer each frame

  const tag = document.createElement('div');
  tag.className = 'wip-tag';
  tag.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'wip-tag__text';
  tag.appendChild(text);
  const letters = [...TEXT].map((ch) => {
    const s = document.createElement('span');
    s.className = 't';
    s.textContent = ch;
    text.appendChild(s);
    return s;
  });
  // The pill hugs whatever has been typed so far (padding + typed text), so it grows as the
  // letters come in and shrinks as they backspace out; the CSS eases the width between
  const PAD_X = 16;
  const fit = () => { tag.style.width = `${text.offsetWidth + PAD_X * 2}px`; };
  document.body.appendChild(tag);
  fit();

  let shown = false, raf = 0, typing = 0;
  const pointer = { x: 0, y: 0 }, pos = { x: 0, y: 0 };

  function place() {
    // (via `translate`, not `transform`: the CSS `scale` would otherwise scale this offset
    // too, and the pill would fly toward the window corner as it shrinks)
    tag.style.translate = `${pos.x + OFFSET.x}px ${pos.y + OFFSET.y}px`;
  }
  // active: the pill is on screen (showing, or still reversing out); count: letters typed
  let active = false, count = 0;

  // glide after the pointer (or stick to it, with reduced motion), while the pill is up
  function follow() {
    const k = reduce ? 1 : EASE;
    pos.x += (pointer.x - pos.x) * k;
    pos.y += (pointer.y - pos.y) * k;
    place();
    if (active || Math.abs(pointer.x - pos.x) + Math.abs(pointer.y - pos.y) > 0.5) raf = requestAnimationFrame(follow);
    else raf = 0;
  }
  // Types forwards or backspaces (last letter first) from wherever it is now to `target`
  // letters, one per LETTER_MS; done() runs once it gets there
  function typeTo(target, done) {
    cancelAnimationFrame(typing);
    const from = count, dir = Math.sign(target - from), t0 = performance.now();
    const set = (n) => {
      count = n;
      letters.forEach((l, i) => l.classList.toggle('is-on', i < n));
      fit();
    };
    if (reduce || !dir) { set(target); if (done) done(); return; }
    (function step(now) {
      const moved = Math.min(Math.abs(target - from), Math.floor((now - t0) / LETTER_MS) + 1);
      set(from + dir * moved);
      if (count !== target) typing = requestAnimationFrame(step);
      else if (done) done();
    })(t0);
  }
  // In: the pill pops up, then the letters type in
  function show() {
    if (shown) return;
    shown = true;
    if (!active) {
      // appear right at the pointer rather than sliding in from where it last was
      active = true;
      pos.x = pointer.x; pos.y = pointer.y;
      place();
      tag.classList.add('is-on');
    }
    // (back on a card mid-reverse: just type on again from where it got to)
    typeTo(letters.length);
    if (!raf) raf = requestAnimationFrame(follow);
  }
  // Out: the same in reverse; the letters backspace away, then the pill shrinks down
  function hide() {
    if (!shown) return;
    shown = false;
    typeTo(0, () => {
      if (shown) return;
      active = false;
      tag.classList.remove('is-on');
    });
  }

  const over = (el) => !!el && cards.some((c) => c.contains(el));
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (over(e.target)) show(); else hide();
    if (shown && !raf) raf = requestAnimationFrame(follow);
  }, { passive: true });
  // scrolling moves the cards under a still pointer
  addEventListener('scroll', () => {
    if (!pointer.x && !pointer.y) return;
    if (over(document.elementFromPoint(pointer.x, pointer.y))) show(); else hide();
  }, { passive: true });
  document.addEventListener('pointerleave', hide);
  addEventListener('blur', hide);
})();
