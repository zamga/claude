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

  /* --- shallow parallax (rAF, scrub feel) --- */
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  if (!prefersReduced && parallaxEls.length) {
    var ticking = false;
    var update = function () {
      var vh = window.innerHeight;
      parallaxEls.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) return;
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0;
        // progress: -1 (below) .. 1 (above) relative to viewport center
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        var shift = progress * speed * 100;
        el.style.transform = "translate3d(0," + shift.toFixed(2) + "px,0)";
      });
      ticking = false;
    };
    var onScroll = function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
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
