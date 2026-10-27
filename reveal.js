// Page entrance: anything marked [data-reveal] eases up in a quick stagger as
// it comes into view. Runs only when the page opted in with .js-reveal (set in
// <head>). The home page starts it itself once its layout is in place, via
// window.startReveal(); about-page photos also shimmer until they load.
(() => {
  const root = document.documentElement;
  const STAGGER = 70; // ms between items revealed together
  let started = false;

  window.startReveal = () => {
    if (started || !root.classList.contains('js-reveal')) return;
    started = true;

    const els = [...document.querySelectorAll('[data-reveal]')]; // document order
    const io = new IntersectionObserver((entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target)
        .sort((a, b) => els.indexOf(a) - els.indexOf(b))
        .forEach((el, k) => {
          const delay = Math.min(k, 10) * STAGGER;
          el.style.setProperty('--d', `${delay}ms`);
          el.classList.add('is-in');
          io.unobserve(el);
          // Once it has arrived, hand the element back to its normal styles
          setTimeout(() => {
            el.removeAttribute('data-reveal');
            el.classList.remove('is-in');
            el.style.removeProperty('--d');
          }, delay + 1200);
        });
    }, { threshold: 0 }); // anything on screen counts, even at the very edge
    els.forEach((el) => io.observe(el));

    // About photos: shimmer while loading, then come into focus
    for (const img of document.querySelectorAll('.about img[data-reveal]')) {
      if (img.complete && img.naturalWidth) continue;
      img.classList.add('is-loading');
      img.addEventListener('load', () => {
        img.classList.remove('is-loading');
        img.classList.add('is-sharpening');
      }, { once: true });
      img.addEventListener('error', () => img.classList.remove('is-loading'), { once: true });
    }
  };

  // The home page waits until the intro has been skipped and the ball placed
  if (!root.classList.contains('skip-intro')) window.startReveal();
})();
