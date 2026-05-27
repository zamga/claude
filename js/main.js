/* =====================================================================
   MERIDIAN — interaction layer
   Depth, not spectacle: scroll reveals, shallow parallax, tactile UI.
   ===================================================================== */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- footer year --- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* --- header: condense on scroll --- */
  var header = document.querySelector("[data-header]");
  var setScrolled = function () {
    if (!header) return;
    if (window.scrollY > 24) header.setAttribute("data-scrolled", "");
    else header.removeAttribute("data-scrolled");
  };
  setScrolled();
  window.addEventListener("scroll", setScrolled, { passive: true });

  /* --- mobile navigation --- */
  var toggle = document.querySelector("[data-nav-toggle]");
  if (toggle && header) {
    toggle.addEventListener("click", function () {
      var open = header.toggleAttribute("data-nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    header.querySelectorAll(".primary-nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        header.removeAttribute("data-nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* --- scroll reveals via IntersectionObserver --- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));

  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    // stagger siblings within a group
    document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
      var items = group.querySelectorAll("[data-reveal]");
      items.forEach(function (el, i) {
        el.style.transitionDelay = (i * 0.08).toFixed(2) + "s";
      });
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    revealEls.forEach(function (el) { observer.observe(el); });
  }

  /* --- scroll physics + motion layer (GSAP ScrollTrigger) --- */
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var hasGSAP = !!gsap && !prefersReduced;
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));

  // Fallback parallax (only used when ScrollTrigger is unavailable).
  function rafParallax() {
    var ticking = false;
    function update() {
      var vh = window.innerHeight;
      parallaxEls.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) return;
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0;
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        el.style.transform = "translate3d(0," + (progress * speed * 100).toFixed(2) + "px,0)";
      });
      ticking = false;
    }
    function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  if (hasGSAP) {
    if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    // Scroll physics: frame-synced, eased (scrubbed) parallax. The scrub value
    // adds an inertia-like lag so layers settle behind the scroll position.
    if (ScrollTrigger && parallaxEls.length) {
      parallaxEls.forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0;
        gsap.fromTo(el,
          { yPercent: -speed * 50 },
          {
            yPercent: speed * 50,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1 }
          });
      });
    } else if (parallaxEls.length) {
      rafParallax();
    }

    // Hero: stagger the eyebrow, headline, dek, and button up into place on load.
    var heroItems = gsap.utils.toArray(".hero__content [data-anim]");
    if (heroItems.length) {
      gsap.set(heroItems, { opacity: 0, y: 30 });
      gsap.to(heroItems, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        delay: 0.15
      });
    }

    // "Firm in Action" cards: scale up and fade in as they scroll into view.
    var cards = gsap.utils.toArray(".proof-card");
    if (cards.length && ScrollTrigger) {
      gsap.set(cards, { opacity: 0, scale: 0.95, y: 20, transition: "none" });
      ScrollTrigger.batch(cards, {
        start: "top 85%",
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.12,
            ease: "power2.out",
            overwrite: true,
            onComplete: function () {
              batch.forEach(function (el) { el.style.transition = ""; });
            }
          });
        }
      });
    }

    // Recalculate trigger positions once fonts/images settle.
    if (ScrollTrigger) window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  } else {
    // No GSAP, or reduced motion: reveal animated elements immediately.
    document.querySelectorAll("[data-anim]").forEach(function (el) {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    if (!prefersReduced && parallaxEls.length) rafParallax();
  }

  /* --- subscription form (client-side validation) --- */
  var form = document.querySelector("[data-subscribe-form]");
  if (form) {
    var status = form.querySelector("[data-subscribe-status]");
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector('input[name="email"]');
      var value = (input && input.value || "").trim();
      if (!emailRe.test(value)) {
        status.textContent = "Please enter a valid email address.";
        status.setAttribute("data-error", "");
        if (input) input.focus();
        return;
      }
      status.removeAttribute("data-error");
      status.textContent = "Thank you — your subscription is confirmed.";
      form.reset();
    });
  }
})();
