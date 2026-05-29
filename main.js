/* =============================================================
   MERIDIAN ATLAS — Motion Engineering
   Vanilla JS, dependency-free. All motion gated behind
   prefers-reduced-motion. Curves/durations mirror the CSS tokens.
   ============================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------- 1. Hero line-clip reveal (on load) ---------- */
  const hero = document.querySelector(".hero");
  if (hero) {
    // Defer one frame so initial transforms paint before transitioning.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => hero.classList.add("is-ready"));
    });
  }

  /* ---------- 2. Header scroll state ---------- */
  const header = document.querySelector("[data-header]");
  if (header) {
    let ticking = false;
    const update = () => {
      header.dataset.scrolled = window.scrollY > 12 ? "true" : "false";
      ticking = false;
    };
    update();
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
  }

  /* ---------- 3. Scroll reveal via IntersectionObserver ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-inview"));
  } else {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          // Stagger siblings sharing a parent for editorial cadence.
          const sibs = Array.from(
            el.parentElement.querySelectorAll(":scope > [data-reveal]")
          );
          const i = Math.max(0, sibs.indexOf(el));
          el.style.transitionDelay = i * 70 + "ms";
          el.classList.add("is-inview");
          obs.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- 4. Count-up stats (Track Record) ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const fmt = (val, decimals) =>
    decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
  const finalText = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = (el.dataset.count.split(".")[1] || "").length;
    return (el.dataset.prefix || "") + fmt(target, decimals) + (el.dataset.suffix || "");
  };

  if (counters.length && (prefersReduced || !("IntersectionObserver" in window))) {
    // No animation: show the resolved figures immediately.
    counters.forEach((el) => (el.textContent = finalText(el)));
  } else if (counters.length) {
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = (el.dataset.count.split(".")[1] || "").length;
      const prefix = el.dataset.prefix || "";
      const suffix = el.dataset.suffix || "";
      const start = performance.now();
      const dur = 1100; // ~ between --dur-hero and --dur-reveal, eased below
      const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const v = target * easeOutExpo(t);
        el.textContent = prefix + fmt(v, decimals) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = prefix + fmt(target, decimals) + suffix;
      };
      requestAnimationFrame(tick);
    };

    const cio = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            run(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => cio.observe(el));
  }

  /* ---------- 5. Magnetic CTA physics (pointer-fine only) ---------- */
  const fine = window.matchMedia("(pointer: fine)").matches;
  if (fine && !prefersReduced) {
    const STRENGTH = 0.28; // attenuated pull
    const MAX = 10; // px clamp — restraint over flourish

    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      let raf = null;
      let tx = 0,
        ty = 0;

      const apply = () => {
        el.style.transform = `translate(${tx}px, ${ty}px)`;
        raf = null;
      };
      const schedule = () => {
        if (raf === null) raf = requestAnimationFrame(apply);
      };

      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        tx = Math.max(-MAX, Math.min(MAX, dx * STRENGTH));
        ty = Math.max(-MAX, Math.min(MAX, dy * STRENGTH));
        schedule();
      });
      el.addEventListener("pointerleave", () => {
        tx = ty = 0;
        schedule();
      });
    });
  }

  /* ---------- 6. Marquee: duplicate-group seamless loop guard ---------- */
  // CSS handles the animation; if reduced-motion, neutralize width hack.
  if (prefersReduced) {
    document.querySelectorAll(".ticker__track").forEach((t) => {
      t.style.width = "100%";
      const dup = t.querySelector('[aria-hidden="true"]');
      if (dup) dup.style.display = "none";
    });
  }
})();
