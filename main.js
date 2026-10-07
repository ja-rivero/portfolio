// Intro → landing screen hand-off.
// Once the photo cards have risen in, the tagline fades out and the page switches
// to its landing layout. The heading and each photo are animated from where they
// were to where they land (FLIP): the photos shrink into thumbnails one after
// another, passing over the landing text as it fades in beneath them.

const HOLD_AFTER_INTRO = 900; // ms to let the full carousel sit before shrinking
const MOVE_DURATION = 800;
const CARD_STAGGER = 50; // ms between each photo starting its move (domino)
// A smooth ease-out (no overshoot), the same curve the photos rise in with
// (--ease-out in styles.css).
const EASE =
  getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() ||
  "cubic-bezier(0.22, 1, 0.36, 1)";

const landing = document.querySelector(".landing");
const heading = document.querySelector(".intro__heading");
const tagline = document.querySelector(".intro__tagline");
const cards = [...document.querySelectorAll(".carousel__card")];
const scrollHint = document.querySelector(".scroll-hint");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The photos wait off-screen until they rise in, so the browser would only
// decode them as they start moving (a visible hitch). Decode them up front.
cards.forEach((card) => {
  const img = card.querySelector("img");
  if (img && img.decode) img.decode().catch(() => {});
});

function showLanding() {
  landing.dataset.state = "home";
}

function center(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Animates each element from its pre-`update` box to its new one. Works from box
// centers so the cards' own rotation (kept in --tilt) can ride along unchanged.
function flip(items, update) {
  const before = items.map(({ el }) => el.getBoundingClientRect());
  update();
  items.forEach(({ el, delay = 0, rotate = "0deg" }, i) => {
    const after = el.getBoundingClientRect();
    const from = center(before[i]);
    const to = center(after);
    const scale = before[i].height / after.height;
    el.animate(
      [
        { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${scale}) rotate(${rotate})` },
        { transform: `rotate(${rotate})` },
      ],
      { duration: MOVE_DURATION, delay, easing: EASE, fill: "backwards" }
    );
  });
}

async function playHandOff() {
  await tagline.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 200,
    easing: "ease-out",
    fill: "forwards",
  }).finished;

  flip(
    [
      { el: heading },
      ...cards.map((el, i) => ({
        el,
        delay: i * CARD_STAGGER,
        rotate: getComputedStyle(el).getPropertyValue("--tilt").trim() || "0deg",
      })),
    ],
    showLanding
  );
}

// Arriving from another page via a section link (e.g. index.html#work) skips
// the intro: the inline script at the top of <main> in index.html has already
// switched to the landing screen before the first paint.
const skipIntro = "skipIntro" in landing.dataset;

if (skipIntro) {
  showLanding();
} else if (reduceMotion) {
  showLanding();
} else {
  // Hand off once the last photo has risen into place.
  const lastCard = cards[cards.length - 1];
  lastCard.addEventListener("animationend", function onEnd(event) {
    if (event.animationName !== "card-rise") return;
    lastCard.removeEventListener("animationend", onEnd);
    setTimeout(playHandOff, HOLD_AFTER_INTRO);
  });
}

// "Scroll for work" brings the Work grid up over the introduction.
scrollHint.addEventListener("click", () => {
  document.querySelector(".work").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
});
