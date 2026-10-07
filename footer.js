// Site footer: "Building dots and all kinds of shapes since 2025".
// Built here so every page that loads this script gets the same footer.
//
// 1. Reveal: the footer sits underneath the page (see .site-footer in
//    styles.css). We track how much of it is uncovered: --footer-progress
//    (0 → 1) fades the picker in, and the shapes make their entrance.
// 2. Colour picker: each swatch shows its name on hover; picking one
//    recolours the shapes and the nav dot by changing the palette hue (--hue
//    on <html>; site.js applies the saved one before the first paint).
// 3. Water: the cursor parts the shapes like water droplets as it moves
//    through them; the background dots stay still.

const COLORS = [
  { name: "teal", hue: 180 },
  { name: "magenta", hue: 282 },
  { name: "orange", hue: 35 },
];

// Shapes from the Figma composition (1512 × 398 frame), in paint order.
// [shade, x, y, width, height, rotation°] — rotated shapes are given by their
// unrotated size, centred on (x + width / 2, y + height / 2).
const SHAPES = [
  [3, 209, 0, 184, 185],
  [2, 22.69, 15.18, 189.145, 118.227, 24.13],
  [1, 392, 0, 281, 240],
  [3, 951, 2, 177, 184],
  [1, 1128, 0, 306, 207],
  [2, 1097, 207, 209, 191],
  [2, 673, 0, 281, 398],
  [4, 887.04, 248.79, 281, 72.42, -47.13],
  [3, 300, 240, 381, 158],
  [1, 0, 148, 305, 250],
];

const shape = ([shade, x, y, w, h, rotate = 0]) => {
  const turn = rotate ? ` transform="rotate(${rotate} ${x + w / 2} ${y + h / 2})"` : "";
  // Wrapped in a group so the entrance can move it without touching its tilt.
  return `<g class="footer-shape"><rect class="shade-${shade}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}"${turn}/></g>`;
};

// The picked colour is kept for the visit (sessionStorage), so every page
// opens with it until another is picked or the site is closed.
const COLOR_KEY = "footer-color";
const HUE_KEY = "footer-hue"; // read by site.js
function savedColor() {
  try {
    return COLORS.find((color) => color.name === sessionStorage.getItem(COLOR_KEY)) || COLORS[0];
  } catch {
    return COLORS[0];
  }
}
function saveColor(name, hue) {
  try {
    sessionStorage.setItem(COLOR_KEY, name);
    sessionStorage.setItem(HUE_KEY, hue);
  } catch {
    // Storage unavailable (e.g. private mode): the colour just won't carry over.
  }
}
const current = savedColor();

const swatch = ({ name, hue }) => `
  <button class="swatch" type="button" style="--swatch-hue: ${hue}" data-hue="${hue}" aria-pressed="${name === current.name}" aria-label="${name}">
    <span class="swatch__name" aria-hidden="true">${name}</span>
  </button>`;

document.body.insertAdjacentHTML(
  "beforeend",
  `<footer class="site-footer">
    <div class="site-footer__stage">
      <svg class="footer-art" viewBox="0 0 1512 398" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="footer-goo" filterUnits="userSpaceOnUse" x="-60" y="-60" width="1632" height="518">
            <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 22 -10" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="in" />
          </filter>
          <filter id="footer-wake-goo" filterUnits="userSpaceOnUse" x="-60" y="-60" width="1632" height="518">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
          </filter>
          <mask id="footer-wake" class="footer-wake" maskUnits="userSpaceOnUse" x="-60" y="-60" width="1632" height="518">
            <rect x="-60" y="-60" width="1632" height="518" fill="#fff" />
            <g filter="url(#footer-wake-goo)">${'<circle cx="-999" cy="-999" r="0" fill="#000" />'.repeat(48)}</g>
          </mask>
        </defs>
        <g filter="url(#footer-goo)">
          <g mask="url(#footer-wake)">${SHAPES.map(shape).join("")}</g>
        </g>
      </svg>
      <div class="footer-panel">
        <div class="color-picker" role="group" aria-label="Footer colour">
          <img class="color-picker__icon" src="assets/color-picker.svg" width="16" height="16" alt="">
          ${COLORS.map(swatch).join("")}
        </div>
        <p class="footer-caption">Building dots and all kinds<br>of shapes since 2025</p>
      </div>
    </div>
  </footer>`
);

const root = document.documentElement;
const page = document.querySelector(".landing");
const footer = document.querySelector(".site-footer");

// ---------- Colour picker ----------

// Normally already applied by site.js; this covers a colour saved by name only.
root.style.setProperty("--hue", current.hue);

footer.querySelector(".color-picker").addEventListener("click", (event) => {
  const picked = event.target.closest(".swatch");
  if (!picked) return;
  root.style.setProperty("--hue", picked.dataset.hue);
  saveColor(picked.getAttribute("aria-label"), picked.dataset.hue);
  footer.querySelectorAll(".swatch").forEach((button) => {
    button.setAttribute("aria-pressed", String(button === picked));
  });
});

// ---------- Water ----------
// The cursor moves through the shapes like a finger through water droplets:
// a trail of circles follows it, melted into one smooth tapered stroke
// (#footer-wake-goo) and cut out of the shapes (#footer-wake); then a "goo"
// filter (#footer-goo) smooths the cut edges and pinches thin necks of colour
// apart into separate droplets. The faster you move, the wider
// the parting; it closes back up behind the cursor. The dots stay put.

const stage = footer.querySelector(".site-footer__stage");
const panel = footer.querySelector(".footer-panel");
const art = footer.querySelector(".footer-art");
const wake = [...footer.querySelectorAll(".footer-wake circle")];
const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const REST_RADIUS = 14; // px: the small parting while the cursor is still
const MAX_RADIUS = 44; // px: the widest parting when moving fast
const SPEED_GAIN = 2.2; // how much speed widens the parting
const CLOSE_RATE = 0.86; // how quickly the trail heals behind (per frame)

const head = { x: 0, y: 0, targetX: 0, targetY: 0, r: 0 };
const trail = []; // older positions, newest first: { x, y, r } in SVG units
let inside = false;
let frame = 0;

// Pointer position → SVG user units (the art is scaled to cover the footer).
function toArt(clientX, clientY) {
  const point = new DOMPoint(clientX, clientY).matrixTransform(art.getScreenCTM().inverse());
  return { x: point.x, y: point.y };
}

function tick() {
  const scale = art.getScreenCTM().a || 1; // screen px per SVG unit
  const lastX = head.x;
  const lastY = head.y;
  head.x += (head.targetX - head.x) * 0.35;
  head.y += (head.targetY - head.y) * 0.35;

  const speed = Math.hypot(head.x - lastX, head.y - lastY) * scale; // px per frame
  const target = inside ? Math.min(MAX_RADIUS, REST_RADIUS + speed * SPEED_GAIN) / scale : 0;
  head.r += (target - head.r) * 0.2;

  // Leave a trail behind the head that heals over time. Fast moves are filled
  // in with extra points so the wake stays one smooth stroke.
  if (speed > 0.5 && head.r > 0) {
    const gap = Math.hypot(head.x - lastX, head.y - lastY);
    const steps = Math.min(10, Math.max(1, Math.ceil(gap / (head.r * 0.35))));
    for (let s = steps; s >= 1; s--) {
      const t = s / steps;
      trail.unshift({ x: head.x + (lastX - head.x) * t, y: head.y + (lastY - head.y) * t, r: head.r * 0.9 });
    }
  }
  trail.length = Math.min(trail.length, wake.length - 1);
  for (const drop of trail) drop.r *= CLOSE_RATE;
  while (trail.length && trail[trail.length - 1].r < 0.3) trail.pop();

  const circles = [head, ...trail];
  wake.forEach((circle, i) => {
    const drop = circles[i];
    circle.setAttribute("cx", drop ? drop.x.toFixed(1) : -999);
    circle.setAttribute("cy", drop ? drop.y.toFixed(1) : -999);
    circle.setAttribute("r", drop ? Math.max(0, drop.r).toFixed(2) : 0);
  });

  const busy = inside || head.r > 0.3 || trail.length > 0;
  frame = busy ? requestAnimationFrame(tick) : 0;
}

if (smooth) {
  footer.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const point = toArt(event.clientX, event.clientY);
    head.targetX = point.x;
    head.targetY = point.y;
    const overPanel = panel.contains(event.target);
    if (!inside && !overPanel) {
      // Entering: start right at the pointer rather than sliding in.
      head.x = point.x;
      head.y = point.y;
    }
    inside = !overPanel;
    if (!frame) frame = requestAnimationFrame(tick);
  });

  footer.addEventListener("pointerleave", () => {
    inside = false;
  });
}

// ---------- Reveal ----------

function updateReveal() {
  const coverEdge = page.getBoundingClientRect().bottom; // where the uncovered part starts
  const revealed = Math.min(footer.offsetHeight, Math.max(0, window.innerHeight - coverEdge));
  root.style.setProperty("--footer-progress", (revealed / footer.offsetHeight).toFixed(3));
  revealShapes(coverEdge, revealed);
}

// ---------- Shapes entrance ----------
// As the footer is uncovered from the bottom up, each shape makes its
// entrance once the uncovered edge has passed a little way into it: it fades
// in, rises and grows into place while coming into focus (the same motion as
// the Design explorations cards). Shapes arriving together follow one
// another, lowest first. Covering the footer again resets them, so the
// entrance plays each time.

const SHAPE_STAGGER = 70; // ms between shapes arriving together
const SHAPE_TRIGGER = 0.35; // how much of a shape must be uncovered (0–1)
const shapeEls = [...footer.querySelectorAll(".footer-shape")];
const shapeBoxes = shapeEls.map((el) => el.firstElementChild.getBBox()); // SVG units, untransformed

function revealShapes(coverEdge, revealed) {
  if (!smooth) {
    shapeEls.forEach((el) => el.classList.add("is-in"));
    return;
  }

  if (revealed <= 0) {
    // Fully covered again: reset out of sight, without animating.
    if (shapeEls.some((el) => el.classList.contains("is-in"))) {
      footer.classList.add("is-resetting");
      shapeEls.forEach((el) => el.classList.remove("is-in"));
      void footer.offsetWidth; // apply the reset before re-enabling motion
      footer.classList.remove("is-resetting");
    }
    return;
  }

  // Shape positions on screen, from their SVG boxes (the art is scaled).
  const ctm = art.getScreenCTM();
  const arriving = [];
  shapeEls.forEach((el, i) => {
    if (el.classList.contains("is-in")) return;
    const top = ctm.d * shapeBoxes[i].y + ctm.f;
    const height = ctm.d * shapeBoxes[i].height;
    if (coverEdge <= top + height * SHAPE_TRIGGER) arriving.push({ el, top });
  });

  arriving
    .sort((a, b) => b.top - a.top)
    .forEach(({ el }, i) => {
      el.style.setProperty("--shape-delay", `${i * SHAPE_STAGGER}ms`);
      el.classList.add("is-in");
    });
}

let revealFrame = 0;
function schedule() {
  if (!revealFrame) {
    revealFrame = requestAnimationFrame(() => {
      revealFrame = 0;
      updateReveal();
    });
  }
}

window.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", schedule);
updateReveal();
