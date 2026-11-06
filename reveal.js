(() => {
  // Case study videos ([data-autoplay]) play, muted and looping, only while they're on
  // screen; with reduced motion they stay on their poster. data-rate speeds one up (1.2 = 20% faster)
  document.querySelectorAll('video[data-rate]').forEach((v) => {
    v.defaultPlaybackRate = v.playbackRate = parseFloat(v.dataset.rate) || 1;
  });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const vo = new IntersectionObserver((entries) => {
      entries.forEach(({ target: v, isIntersecting }) => {
        if (isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('video[data-autoplay]').forEach((v) => vo.observe(v));
  }
})();

(() => {
  // Scroll reveals below the hero. Each [data-reveal] block comes in once, as it scrolls into
  // view: its frame expands from the centre like the opening box (CSS, driven by .is-in),
  // then its pieces come in one after another in reading order: "My works" and the
  // case study titles ([data-type]) type in letter by letter like the intro, and everything else ([data-pop]:
  // text, tags, buttons, link lists) appears whole.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.classList.add('reveal');

  const LETTER_MS = 14;    // typing pace
  const POP_MS = 120;      // pause after something appears whole, before the next piece
  const FRAME_LEAD = 450;  // a framed block's text starts this far into its frame opening

  // One span per character, nested elements (the squiggle, tags) kept as they are
  function split(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.trim()) nodes.push(n);
    nodes.forEach((n) => {
      const frag = document.createDocumentFragment();
      for (const ch of n.data) {
        const s = document.createElement('span');
        s.className = 't';
        s.textContent = ch;
        frag.appendChild(s);
      }
      n.replaceWith(frag);
    });
    el.classList.add('is-split');
    return [...el.querySelectorAll('.t')];
  }

  const typed = new Map();
  document.querySelectorAll('[data-type]').forEach((el) => typed.set(el, split(el)));

  // Reveals letters of el at LETTER_MS each; resolves when it's all in
  function type(el) {
    const letters = typed.get(el) || [];
    const wavies = [...el.querySelectorAll('.wavy')];
    return new Promise((done) => {
      const t0 = performance.now();
      function frame(now) {
        const n = Math.min(letters.length, Math.floor((now - t0) / LETTER_MS) + 1);
        for (let i = 0; i < n; i++) letters[i].classList.add('is-on');
        // a squiggle draws once all of its words are in
        wavies.forEach((w) => {
          const ts = w.querySelectorAll('.t');
          if (ts.length && ts[ts.length - 1].classList.contains('is-on')) w.classList.add('is-drawn');
        });
        if (n < letters.length) requestAnimationFrame(frame);
        else {
          wavies.forEach((w) => w.classList.add('is-drawn'));
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  async function reveal(block) {
    block.classList.add('is-in');
    const framed = block.matches('.framed') || block.querySelector('.framed');
    const pieces = [...block.querySelectorAll('[data-type], [data-pop]')];
    if (framed) await new Promise((r) => setTimeout(r, FRAME_LEAD));
    for (const el of pieces) {
      if (el.matches('[data-type]')) await type(el);
      else {
        el.classList.add('is-on');
        // its squiggle draws a beat after the words appear (the delay is in the CSS)
        el.querySelectorAll('.wavy').forEach((w) => w.classList.add('is-drawn'));
        await new Promise((r) => setTimeout(r, POP_MS));
      }
    }
  }

  // Starts once the opening has landed (before that the page is covered). On every scroll
  // it reveals each block whose top has come 15% up into the window, or that's already
  // been scrolled past (so a quick jump down never leaves anything hidden behind it). The
  // footer is pinned under the page, so it goes by the end of the page content instead,
  // once that's halfway up the window (the footer is being uncovered).
  function start() {
    const content = document.querySelector('.landing');
    let pending = [...document.querySelectorAll('[data-reveal]')];
    function check() {
      const vh = innerHeight;
      const footerUp = content.getBoundingClientRect().bottom < vh * 0.5;
      pending = pending.filter((b) => {
        const show = b.closest('.footer') ? footerUp : b.getBoundingClientRect().top < vh * 0.85;
        if (show) reveal(b);
        return !show;
      });
      if (!pending.length) {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onScroll);
      }
    }
    let queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; check(); });
    }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    check();
  }

  if (root.classList.contains('is-landed')) start();
  else {
    const mo = new MutationObserver(() => {
      if (!root.classList.contains('is-landed')) return;
      mo.disconnect();
      start();
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }
})();
