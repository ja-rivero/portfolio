// Project pop-ups (Work grid on the home page, Design explorations page).
// Clicking a card (or pressing Enter / Space on it) lifts its picture out of the
// grid and grows it to fit the screen, with the caption underneath, over a
// blurred page. Clicking anywhere outside the picture (or Escape) sends it back
// into its place in the grid.

(() => {
  const cards = [...document.querySelectorAll(".project-grid .project")];
  if (!cards.length) return;

  const OPEN_DURATION = 560;
  const CLOSE_DURATION = 420;
  const root = document.documentElement;
  const EASE = getComputedStyle(root).getPropertyValue("--ease-out").trim() || "cubic-bezier(0.22, 1, 0.36, 1)";
  const BOUNCE =
    getComputedStyle(root).getPropertyValue("--ease-bounce-soft").trim() || "cubic-bezier(0.34, 1.12, 0.64, 1)";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.innerHTML = `
    <figure class="lightbox__figure">
      <div class="lightbox__frame"></div>
      <figcaption class="lightbox__caption"></figcaption>
    </figure>`;
  document.body.append(dialog);

  const frame = dialog.querySelector(".lightbox__frame");
  const caption = dialog.querySelector(".lightbox__caption");

  let current = null; // the card that is open
  let openedByKey = false;
  let closing = false;

  // Transform that puts the frame exactly over the card in the grid.
  function fromCard(card) {
    const a = card.getBoundingClientRect();
    const b = frame.getBoundingClientRect();
    return `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})`;
  }

  function backdrop(keyframes, options) {
    try {
      return dialog.animate(keyframes, { ...options, pseudoElement: "::backdrop" });
    } catch {
      return null;
    }
  }

  function open(card) {
    if (current) return;
    current = card;

    // The card's picture, its background colour and its caption.
    const extra = [...card.classList].filter((name) => name.startsWith("project--"));
    frame.className = ["lightbox__frame", ...extra].join(" ");
    frame.style.setProperty("--ratio", card.style.getPropertyValue("--ratio"));
    frame.style.backgroundColor = getComputedStyle(card).backgroundColor;
    const source = card.querySelector("img, video");
    const media = source.cloneNode();
    media.removeAttribute("loading");
    frame.replaceChildren(media);
    // A video carries on from the frame the card was showing.
    if (media.tagName === "VIDEO") {
      media.muted = true;
      media.currentTime = source.currentTime;
      if (!reduceMotion) media.play().catch(() => {});
    }
    const text = card.querySelector(".project__caption");
    caption.innerHTML = text ? text.innerHTML : "";
    dialog.setAttribute("aria-label", text ? text.textContent.trim() : media.alt || media.getAttribute("aria-label"));

    root.classList.add("has-lightbox");
    dialog.showModal();
    card.classList.add("is-lifted");

    if (reduceMotion) return;
    frame.animate([{ transform: fromCard(card) }, { transform: "none" }], {
      duration: OPEN_DURATION,
      easing: EASE,
    });
    caption.animate(
      [
        { opacity: 0, transform: "translateY(var(--rise))" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 420, delay: 180, easing: BOUNCE, fill: "backwards" }
    );
    backdrop([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
  }

  async function close() {
    if (!current || closing) return;
    closing = true;
    const card = current;

    if (!reduceMotion) {
      const moves = [
        frame.animate([{ transform: "none" }, { transform: fromCard(card) }], {
          duration: CLOSE_DURATION,
          easing: EASE,
          fill: "forwards",
        }).finished,
        caption.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" })
          .finished,
      ];
      const fade = backdrop([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_DURATION, easing: "ease-out", fill: "forwards" });
      if (fade) moves.push(fade.finished);
      await Promise.all(moves);
    }

    // The card picks the video up where the pop-up left it.
    const shown = frame.querySelector("video");
    const cardVideo = card.querySelector("video");
    if (shown && cardVideo) cardVideo.currentTime = shown.currentTime;

    card.classList.remove("is-lifted");
    dialog.close();
    frame.replaceChildren(); // stops a playing video
    root.classList.remove("has-lightbox");
    frame.getAnimations().forEach((a) => a.cancel());
    caption.getAnimations().forEach((a) => a.cancel());
    dialog.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    if (openedByKey) card.focus({ preventScroll: true });
    current = null;
    closing = false;
  }

  cards.forEach((card) => {
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");
    card.addEventListener("click", () => {
      openedByKey = false;
      open(card);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openedByKey = true;
      open(card);
    });
  });

  // Anywhere but the picture closes it.
  dialog.addEventListener("click", (event) => {
    if (!frame.contains(event.target)) close();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
})();
