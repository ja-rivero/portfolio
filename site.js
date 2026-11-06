(() => {
  // Shared by every page: the nav menu and the breaks in the squiggly underlines.

  // Nav opens on hover or keyboard focus, and on tap (for touch, where there's no hover)
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('nav-toggle');
  const setNav = (open) => {
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', open);
  };
  // Going to a page from the open nav: the next page starts with the nav open, then it
  // collapses back. Until the pointer has moved off the nav it won't reopen on its own, even
  // though the cursor is still sitting on it
  const CARRY = 'nav-was-open';
  let holdClosed = false;
  try {
    if (sessionStorage.getItem(CARRY)) {
      sessionStorage.removeItem(CARRY);
      holdClosed = true;
      // already open from the first paint (the head script set .nav-carry); hand that over
      // to .is-open without animating, so it can collapse from there
      nav.classList.add('is-instant', 'is-open');
      document.documentElement.classList.remove('nav-carry');
      nav.getBoundingClientRect();
      nav.classList.remove('is-instant');
      setTimeout(() => setNav(false), 180);
    }
  } catch (e) { /* no storage: just start closed */ }
  nav.querySelectorAll('.nav__link').forEach((a) => a.addEventListener('click', () => {
    if (a.getAttribute('href') === '#') return; // placeholder links don't go anywhere
    try { sessionStorage.setItem(CARRY, '1'); } catch (e) { /* fine */ }
  }));
  document.addEventListener('pointermove', (e) => { if (holdClosed && !nav.contains(e.target)) holdClosed = false; });

  nav.addEventListener('mouseenter', () => { if (!holdClosed) setNav(true); });
  nav.addEventListener('mouseleave', () => { holdClosed = false; if (!nav.contains(document.activeElement)) setNav(false); });
  nav.addEventListener('focusin', () => setNav(true));
  nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget) && !nav.matches(':hover')) setNav(false); });
  navToggle.addEventListener('click', () => {
    setNav(true);
    nav.querySelector('.nav__link').focus();
  });
  document.addEventListener('pointerdown', (e) => { if (!nav.contains(e.target)) setNav(false); });

  // "Work" while already on the home page: a link to the same page would only change the
  // address, so reload it as #work to play the landing's entrance (and reveals) again
  document.querySelectorAll('a[href="index.html#work"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (!document.getElementById('opening')) return; // not the home page: follow the link
      e.preventDefault();
      history.replaceState(null, '', '#work');
      location.reload();
    });
  });


  // Breaks in the squiggles where descenders (p, g, y…) cross them: draw each such letter
  // on a canvas, find its columns of ink below the baseline, and mask those (plus a little
  // air) out of the wave
  const GAP_AIR = 2.5; // px either side of the stem
  const DESCENDERS = /[gjpqy]/;
  const inkCache = new Map();
  function inkBelowBaseline(ch, cs) {
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const key = `${ch}|${font}`;
    if (inkCache.has(key)) return inkCache.get(key);
    const size = parseFloat(cs.fontSize), pad = size;
    const c = document.createElement('canvas');
    c.width = Math.ceil(size * 3); c.height = Math.ceil(size * 3);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.font = font;
    x.fillText(ch, pad, pad * 1.5);
    const top = Math.ceil(pad * 1.5 + size * 0.06); // just under the baseline
    const d = x.getImageData(0, top, c.width, c.height - top).data;
    let lo = Infinity, hi = -Infinity;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] > 40) {
        const col = ((i - 3) / 4) % c.width;
        lo = Math.min(lo, col); hi = Math.max(hi, col + 1);
      }
    }
    const ink = lo > hi ? null : [lo - pad, hi - pad];
    inkCache.set(key, ink);
    return ink;
  }
  function measureGaps() {
    document.querySelectorAll('.wavy').forEach((w) => {
      const left = w.getBoundingClientRect().left;
      const stops = [];
      const walker = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        for (let i = 0; i < n.data.length; i++) {
          if (!DESCENDERS.test(n.data[i])) continue;
          const ink = inkBelowBaseline(n.data[i], getComputedStyle(n.parentElement));
          if (!ink) continue;
          const r = document.createRange();
          r.setStart(n, i); r.setEnd(n, i + 1);
          const x = r.getBoundingClientRect().left - left;
          const a = (x + ink[0] - GAP_AIR).toFixed(1), b = (x + ink[1] + GAP_AIR).toFixed(1);
          stops.push(`#000 ${a}px, transparent ${a}px, transparent ${b}px, #000 ${b}px`);
        }
      }
      w.style.setProperty('--gap', stops.length ? `linear-gradient(to right, ${stops.join(', ')})` : 'none');
    });
  }

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(measureGaps);
  // Without the reveal animations (reduced motion), squiggles are simply there
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.wavy').forEach((w) => w.classList.add('is-drawn'));
  }
  addEventListener('resize', measureGaps);
})();
