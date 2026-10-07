// Project cards make their entrance as they come into view (Work grid on the
// home page, Design explorations page). Each card fades in, rises and grows
// into place while coming into focus (a blur that clears), one after another
// in reading order. A card whose image has not loaded yet stays soft until it
// has (blur-up). The motion itself lives in styles.css ([data-reveal]).
// Grids marked data-reveal="replay" (the Work grid) play it again each time a
// card comes back into view after leaving it completely.

(() => {
  const grids = document.querySelectorAll("[data-reveal]");
  if (!grids.length) return;

  const STAGGER = 90; // ms between cards revealed together

  const cards = [...document.querySelectorAll("[data-reveal] .project")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Blur-up: mark each card once its image is ready. Video cards show their
  // poster (a still of the first frame) straight away.
  cards.forEach((card) => {
    const img = card.querySelector("img");
    const done = () => card.classList.add("is-loaded");
    if (!img || (img.complete && img.naturalWidth)) done();
    else img.addEventListener("load", done, { once: true });
  });

  // Video cards loop silently while on screen and pause when they leave it.
  // With reduced motion they stay on their poster.
  const videos = [...document.querySelectorAll("[data-reveal] .project video")];
  if (videos.length && !reduceMotion && "IntersectionObserver" in window) {
    const player = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) target.play().catch(() => {});
        else target.pause();
      });
    });
    videos.forEach((video) => player.observe(video));
  }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    cards.forEach((card) => card.classList.add("is-in"));
    return;
  }

  const replays = (card) => card.closest("[data-reveal]").dataset.reveal === "replay";

  // Out of sight: reset instantly (no animation), ready to enter again. A card
  // that left past the top waits just above the screen (and comes back down);
  // one that left past the bottom waits below (and rises), so the reset always
  // moves it further out of view.
  function reset(card, leftAbove) {
    card.classList.toggle("from-above", leftAbove);
    card.classList.add("is-resetting");
    card.classList.remove("is-in");
    void card.offsetWidth; // apply the reset before re-enabling motion
    card.classList.remove("is-resetting");
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio === 0 && entry.target.classList.contains("is-in") && replays(entry.target)) {
          const viewTop = entry.rootBounds ? entry.rootBounds.top : 0;
          reset(entry.target, entry.boundingClientRect.bottom <= viewTop);
        }
      });

      // Reading order across the columns at the moment they arrive: by how
      // far down a card sits, then left to right.
      const arriving = entries
        .filter((entry) => entry.intersectionRatio >= 0.12 && !entry.target.classList.contains("is-in"))
        .map((entry) => ({ card: entry.target, box: entry.boundingClientRect }))
        .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
      arriving.forEach(({ card }, i) => {
        card.style.setProperty("--reveal-delay", `${i * STAGGER}ms`);
        card.classList.add("is-in");
        if (!replays(card)) observer.unobserve(card);
      });
    },
    // 0 to notice a card leaving completely; 0.12 to start its entrance.
    { threshold: [0, 0.12] }
  );

  cards.forEach((card) => observer.observe(card));
})();
