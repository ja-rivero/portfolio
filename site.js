// Site-wide motion, shared by every page. Loaded in <head> without defer, so
// it runs before the first paint.
//
// 1. Nav: which link is active lives on <html data-nav>. A new page first
//    draws the nav exactly as the previous page left it, then glides the
//    active state over to its own link (see .side-nav__link in styles.css).
//    That keeps the nav seamless through page transitions.
// 2. Page transitions for browsers without cross-document view transitions.
//    Where they are supported, styles.css (@view-transition) handles them and
//    this part does nothing. Elsewhere it plays the same motion by hand: the
//    content fades in with a small bounce on arrival, and fades out quickly
//    before following a link to another page.

(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Colour ----------

  // The footer colour picked earlier in the visit (footer.js) also tints the
  // nav dot, so apply it before the first paint.
  try {
    const hue = sessionStorage.getItem("footer-hue");
    if (hue) root.style.setProperty("--hue", hue);
  } catch {
    // Storage unavailable: stay on the default teal.
  }

  // ---------- Nav ----------

  const NAV_KEY = "nav-from"; // the active link on the page being left

  // The active link for this page, from its address.
  function navFor(url) {
    const page = url.pathname.replace(/\.html$/, "");
    if (page.endsWith("/about")) return "about";
    if (page.endsWith("/explorations")) return "explorations";
    return "work";
  }

  let current = navFor(window.location);
  let from = null;
  try {
    from = sessionStorage.getItem(NAV_KEY);
    sessionStorage.removeItem(NAV_KEY);
  } catch {
    // Storage unavailable: just start on this page's own state.
  }

  function setNav(key) {
    current = key;
    root.dataset.nav = key;
    document.querySelectorAll(".side-nav__link").forEach((link) => {
      if (link.dataset.nav === key) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  // First paint shows the previous page's state; two frames later (after
  // that first frame has been drawn and captured) glide to this page's.
  root.dataset.nav = from && !reduceMotion ? from : current;
  document.addEventListener("DOMContentLoaded", () => {
    const target = current;
    setNav(root.dataset.nav);
    requestAnimationFrame(() => requestAnimationFrame(() => setNav(target)));
  });

  // Moving between sections on the home page.
  window.addEventListener("hashchange", () => setNav(navFor(window.location)));

  // Remember what was active for the next page.
  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.setItem(NAV_KEY, current);
    } catch {
      // Storage unavailable: the next page just starts on its own state.
    }
  });

  // Restored from the back/forward cache: this page never reloaded, so drop
  // the note it left for a next page.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    try {
      sessionStorage.removeItem(NAV_KEY);
    } catch {
      // Nothing to clean up.
    }
  });

  // ---------- Page transitions (fallback) ----------

  const nativeTransitions = "PageRevealEvent" in window;
  if (nativeTransitions || reduceMotion) return;

  const LEAVE_MS = 180; // matches --page-out in styles.css

  root.classList.add("page-enter");

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (link.target && link.target !== "_self") ||
      link.hasAttribute("download")
    ) {
      return;
    }
    const url = new URL(link.href, window.location.href);
    // Only other pages on this site; same-page anchors behave as usual.
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

    event.preventDefault();
    root.classList.remove("page-enter");
    root.classList.add("page-leave");
    setTimeout(() => {
      window.location.href = url.href;
    }, LEAVE_MS);
  });

  // Coming back with the back button can restore the faded-out page from
  // cache; show it again.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) root.classList.remove("page-leave");
  });
})();
