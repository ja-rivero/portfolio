(() => {
  // Tool icons drop into the dashed bowl one by one and bounce to rest, then the bowl drops
  // open like a trapdoor, swinging down under its right-hand rim (the hinge) so they fall
  // out, swings back up, and it all starts over. Everything is in the bowl's own 270×135 units; the card clips what leaves it.
  const stage = document.getElementById('tools');
  if (!stage) return;
  const bowl = stage.querySelector('.tools__bowl');

  const G = 0.0032;          // gravity, px/ms²
  const DROP_FROM = -260;    // start height, above the top of the card
  const REBOUND = 0.32;      // each bounce keeps this much of the speed it landed with
  const BOUNCES = 2;
  const HINGE = [270, 0];    // right-hand rim
  const TIP = 95;            // degrees the bowl swings down (anticlockwise, under the hinge)

  // Per icon: when it drops (ms), sideways drift and spin on the way down, and how far the
  // bowl has swung (degrees) when it spills out. They ride the tipping bowl, then slide out
  // over the open rim, top of the pile first: Figma, then GitHub, the Vercel icon, and
  // Claude last. Drop order: GitHub, Vercel, Claude, then Figma on top
  const ICONS = [
    { sel: '.tool--github', start: 0,   dx: -14, spin: -70, wob: 1,  out: 28 },
    { sel: '.tool--play',   start: 190, dx: 16,  spin: 60,  wob: -1, out: 32 },
    { sel: '.tool--claude', start: 380, dx: -8,  spin: 90,  wob: 1,  out: 38 },
    { sel: '.tool--figma',  start: 620, dx: 12,  spin: -55, wob: -1, out: 20 },
  ];
  // Checked against the swing: with these, every icon clears the rim through the open top
  // (with room to spare) before the turning bowl can sweep into it
  const SPILL = 0.6;   // px/ms out through the bowl's open top as it spills
  const SLIDE = 0.12;  // px/ms along the rim towards the far (dropping) side

  // Cycle (ms)
  const DUMP = 3300;          // bowl drops open
  const SWING = 400;          // falls to TIP fast, speeding up like a trapdoor
  const HOLD = 800;           // swings past and settles, hanging under the hinge
  const BACK = 1000;          // swings back up, overshooting a little
  const REST = 500;           // empty bowl before the next drop
  const CYCLE = DUMP + SWING + HOLD + BACK + REST;

  const easeInQuad = (p) => p * p;
  const easeOutBack = (p, c = 1.25) => 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  const rad = (d) => (d * Math.PI) / 180;

  // Bowl angle over the cycle; negative = anticlockwise, the left side dropping under
  function bowlAngle(t) {
    if (t < DUMP) return 0;
    t -= DUMP;
    if (t < SWING) return -TIP * easeInQuad(t / SWING);
    t -= SWING;
    // pendulum: carries on past, then settles back to hanging
    if (t < HOLD) return -TIP - 20 * Math.exp(-t / 240) * Math.sin(t / 85);
    t -= HOLD;
    if (t < BACK) return -TIP * (1 - easeOutBack(t / BACK));
    return 0;
  }

  // A point in the bowl, carried round the hinge by angle a
  function swing([x, y], a) {
    const c = Math.cos(rad(a)), s = Math.sin(rad(a));
    const ox = x - HINGE[0], oy = y - HINGE[1];
    return [HINGE[0] + ox * c - oy * s, HINGE[1] + ox * s + oy * c];
  }

  const icons = ICONS.map((cfg) => {
    const el = stage.querySelector(cfg.sel);
    const [x, y, r] = el.dataset.at.split(' ').map(Number);
    const d = y - DROP_FROM;
    const v = Math.sqrt(2 * G * d);   // speed when it lands
    const fall = v / G;               // time to land
    const bounces = [];
    let vb = v;
    for (let i = 0; i < BOUNCES; i++) { vb *= REBOUND; bounces.push(vb); }
    // when the swinging bowl reaches this icon's slide-out angle
    let out = DUMP;
    while (-bowlAngle(out) < cfg.out && out < DUMP + SWING) out++;
    // speed it leaves with: how fast the bowl was carrying it, plus a push out through the
    // open top (the bowl's own "up", tipped with it) and along towards the dropping rim,
    // so it spills over the edge instead of falling through the bottom; then gravity
    const a = bowlAngle(out);
    const p1 = swing([x, y], a), p0 = swing([x, y], bowlAngle(out - 16));
    const up = [Math.sin(rad(a)), -Math.cos(rad(a))];    // bowl's up, tipped
    const along = [-Math.cos(rad(a)), -Math.sin(rad(a))]; // towards the far rim
    const vx = (p1[0] - p0[0]) / 16 + SPILL * up[0] + SLIDE * along[0];
    const vy = (p1[1] - p0[1]) / 16 + SPILL * up[1] + SLIDE * along[1];
    const vr = (bowlAngle(out) - bowlAngle(out - 16)) / 16 + cfg.wob * 0.25;
    return { ...cfg, el, x, y, r, fall, v, bounces, outAt: out, outPos: p1, outR: r + bowlAngle(out), vx, vy, vr };
  });

  function place(ic, x, y, r) {
    ic.el.style.transform = `translate(${x - ic.w / 2}px, ${y - ic.h / 2}px) rotate(${r}deg)`;
  }

  function render(t) {
    const a = bowlAngle(t);
    bowl.style.transform = a ? `rotate(${a}deg)` : '';

    icons.forEach((ic) => {
      let x = ic.x, y = ic.y, r = ic.r;
      const td = t - ic.start;
      if (td < 0) {
        y = DROP_FROM; x = ic.x + ic.dx; r = ic.r + ic.spin; // waiting above the card
      } else if (td < ic.fall) {
        // falling, drifting into line and turning to its resting angle
        const p = td / ic.fall;
        y = DROP_FROM + 0.5 * G * td * td;
        x = ic.x + ic.dx * (1 - p);
        r = ic.r + ic.spin * (1 - p);
      } else if (t < ic.outAt) {
        // bounces, then a little wobble as it settles; carried round once the bowl swings
        let tb = td - ic.fall, lift = 0;
        for (const vb of ic.bounces) {
          const dur = (2 * vb) / G;
          if (tb < dur) { lift = vb * tb - 0.5 * G * tb * tb; break; }
          tb -= dur;
        }
        const since = td - ic.fall;
        r = ic.r + ic.wob * 9 * Math.exp(-since / 170) * Math.sin(since / 42);
        [x, y] = swing([ic.x, ic.y - lift], a);
        r += a;
      } else {
        // slid out: free fall off the rim, tumbling, until the card hides it
        const tf = t - ic.outAt;
        x = ic.outPos[0] + ic.vx * tf;
        y = ic.outPos[1] + ic.vy * tf + 0.5 * G * tf * tf;
        r = ic.outR + ic.vr * tf;
      }
      place(ic, x, y, r);
    });
  }

  function measure() {
    icons.forEach((ic) => { ic.w = ic.el.offsetWidth; ic.h = ic.el.offsetHeight; });
  }

  // Still version for reduced motion: everything resting in the bowl
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    measure();
    render(DUMP - 1);
    return;
  }

  // Only runs while the card is on screen; each time it comes into view it starts over
  let raf = 0, t0 = 0;
  function frame(now) {
    render((now - t0) % CYCLE);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf) return;
    measure();
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  measure();
  render(0);
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.2 })
    .observe(stage.closest('.card') || stage);
})();
