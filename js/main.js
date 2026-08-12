/* =============================================================
   Aishik Sarkar — portfolio behaviour (vanilla JS, no libraries)
   1. Hero name "token stream" + status chip
   2. Scroll-reveal (IntersectionObserver)
   3. Scroll-spy side nav / drawer active state (IntersectionObserver)
   4. Mobile drawer (open / close / a11y)
   All motion respects prefers-reduced-motion.
   ============================================================= */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Built at runtime (not one literal string) so the address doesn't sit in the
     shipped HTML/JS as plain scrapeable text — light deterrent, not real security. */
  function getEmail() {
    return "Aishik.S14" + "@" + "gmail.com";
  }

  /* ---------- 1. Hero name token stream ---------- */
  function streamHeroName() {
    var el = document.querySelector("[data-stream]");
    var statusText = document.querySelector("[data-stream-status] .status-chip__text");
    if (!el) return;

    var full = el.getAttribute("data-stream-text") || el.textContent;

    // Reduced motion (or no JS timing): show final text immediately.
    if (prefersReduced) {
      el.textContent = full;
      if (statusText) statusText.textContent = "ready";
      return;
    }

    if (statusText) statusText.textContent = "generating";
    el.textContent = "";

    var i = 0;
    var step = 62; // ms per character — fast enough to feel snappy, slow enough to read
    function tick() {
      el.textContent = full.slice(0, i + 1);
      i++;
      if (i < full.length) {
        setTimeout(tick, step);
      } else if (statusText) {
        statusText.textContent = "ready";
      }
    }
    // Small beat before it starts "generating".
    setTimeout(tick, 350);
  }

  /* ---------- 2. Scroll-reveal ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (prefersReduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target); // reveal once
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 3. Scroll-spy ---------- */
  function initScrollSpy() {
    var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
    var railLinks = document.querySelectorAll(".sidenav__link");
    var drawerLinks = document.querySelectorAll(".mobile-drawer__link");
    if (!sections.length || !("IntersectionObserver" in window)) return;

    function setActive(id) {
      railLinks.forEach(function (a) {
        a.classList.toggle("is-active", a.getAttribute("href") === "#" + id);
      });
      drawerLinks.forEach(function (a) {
        a.classList.toggle("is-active", a.getAttribute("href") === "#" + id);
      });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, {
      // Active when a section sits in the middle band of the viewport.
      rootMargin: "-45% 0px -50% 0px",
      threshold: 0
    });

    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- 4. Mobile drawer ---------- */
  function initDrawer() {
    var toggle = document.querySelector(".nav-toggle");
    var drawer = document.getElementById("mobile-drawer");
    if (!toggle || !drawer) return;

    var links = drawer.querySelectorAll(".mobile-drawer__link");

    function open() {
      drawer.classList.add("is-open");
      toggle.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close navigation menu");
      document.body.style.overflow = "hidden";
    }
    function close() {
      drawer.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation menu");
      document.body.style.overflow = "";
    }
    function isOpen() { return drawer.classList.contains("is-open"); }

    toggle.addEventListener("click", function () {
      isOpen() ? close() : open();
    });

    // Close after choosing a destination (let the smooth-scroll happen).
    links.forEach(function (a) {
      a.addEventListener("click", close);
    });

    // Escape closes the drawer.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) {
        close();
        toggle.focus();
      }
    });
  }

  /* ---------- 5. Segmented toggle (Work / Education / Leadership) ---------- */
  function initTabs() {
    var seg = document.querySelector(".seg");
    if (!seg) return;
    var tabs = Array.prototype.slice.call(seg.querySelectorAll(".seg__btn"));
    var ind = seg.querySelector(".seg__ind");
    var panels = tabs.map(function (t) {
      return document.getElementById(t.getAttribute("aria-controls"));
    });

    // The three tab buttons aren't equal width (grid 1fr tracks size to each
    // button's own content when the container itself is width:max-content —
    // "Leadership" is wider than "Work"), so the old CSS assumption of exact
    // thirds (width:33% + translateX(index*100%)) left the red indicator
    // mismatched against the actual button it's meant to highlight. Position
    // it from real geometry instead — always exact, on any content/width.
    function positionIndicator(index) {
      if (!ind || !tabs[index]) return;
      var segRect = seg.getBoundingClientRect();
      var btnRect = tabs[index].getBoundingClientRect();
      ind.style.width = btnRect.width + "px";
      ind.style.transform = "translateX(" + (btnRect.left - segRect.left) + "px)";
    }

    function activate(index, focus) {
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
        if (panels[i]) panels[i].hidden = !selected;
      });
      positionIndicator(index);
      if (focus && tabs[index]) tabs[index].focus();
    }

    var activeIndex = 0;
    seg.addEventListener("click", function (e) {
      var tab = e.target.closest(".seg__btn");
      if (tab) { activeIndex = tabs.indexOf(tab); activate(activeIndex, false); }
    });

    // Button widths can change on resize/rotate (different wrapping, font
    // metrics) — keep the indicator glued to the active button.
    window.addEventListener("resize", function () { positionIndicator(activeIndex); });

    // Arrow-key navigation between tabs (WAI-ARIA pattern).
    seg.addEventListener("keydown", function (e) {
      var current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      var next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (current + 1) % tabs.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (current - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next !== null) { e.preventDefault(); activeIndex = next; activate(next, true); }
    });

    activate(0, false); // set initial indicator position
  }

  /* ---------- 6. Contact form (no backend) ----------
     Static hosting (GitHub Pages) can't run server code, so on submit we validate
     client-side and hand off to the visitor's mail app with the message prefilled.
     To deliver to an inbox directly instead, point the form at a Formspree endpoint. */
  function initContactForm() {
    var form = document.querySelector("[data-cform]");
    if (!form) return;
    var note = form.querySelector("[data-cform-note]");
    var submitBtn = form.querySelector(".cform__submit");
    var EMAIL = getEmail();

    function setNote(text, ok) {
      if (!note) return;
      note.textContent = text;
      note.classList.toggle("is-error", !ok);
      note.classList.toggle("is-ok", ok);
    }

    // Belt-and-suspenders: if Formspree ever errors, times out, or the
    // action URL is still the unconfigured placeholder, open the visitor's
    // own mail app with the message prefilled instead — never just lost.
    function mailtoFallback(name, email, message) {
      var subject = encodeURIComponent("Portfolio enquiry from " + name);
      var body = encodeURIComponent(message + "\n\n— " + name + "\n" + email);
      window.location.href = "mailto:" + EMAIL + "?subject=" + subject + "&body=" + body;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (form.name.value || "").trim();
      var email = (form.email.value || "").trim();
      var message = (form.message.value || "").trim();

      if (!name || !email || !message) {
        setNote("Please fill in your name, email, and a message.", false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setNote("That email doesn't look right — mind checking it?", false);
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      setNote("Sending…", true);

      fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form)
      })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          setNote("Message sent — thanks! I'll get back to you soon.", true);
          form.reset();
        })
        .catch(function () {
          mailtoFallback(name, email, message);
          setNote("Couldn't reach the inbox directly, so I opened your email app instead — if nothing happens, write to " + EMAIL + " directly.", true);
          form.reset();
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ---------- 7. Email links (built at runtime, same reason as getEmail() above) ---------- */
  function initEmailLinks() {
    var email = getEmail();
    document.querySelectorAll("[data-email-link]").forEach(function (a) {
      a.href = "mailto:" + email;
    });
    document.querySelectorAll("[data-email-text]").forEach(function (el) {
      el.textContent = email;
    });
  }

  /* ---------- 7b. Org logo tiles (CSP-friendly replacement for inline onload/onerror) ----------
     Each timeline logo <img> has no src fallback markup of its own: if it loads, the tile
     switches to the "has-img" (white chip) style; if it 404s, the <img> removes itself and
     the monogram underneath shows through. Previously wired via inline onload/onerror
     attributes, which a script-src CSP without 'unsafe-inline' blocks — moved here instead. */
  function initLogoFallback() {
    document.querySelectorAll(".timeline__logo img").forEach(function (img) {
      function markLoaded() { img.parentNode.classList.add("has-img"); }
      function markFailed() { img.remove(); }
      if (img.complete) {
        if (img.naturalWidth > 0) markLoaded(); else markFailed();
      } else {
        img.addEventListener("load", markLoaded);
        img.addEventListener("error", markFailed);
      }
    });
  }

  /* ---------- 8. Back to top ---------- */
  function initBackToTop() {
    document.querySelectorAll("[data-scroll-top]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
      });
    });
  }

  /* ---------- 9. Smart "back" link on case / listing pages ----------
     The .back-link has a sensible default href, but if you arrived from the home
     page or the all-projects listing, send you back THERE (with scroll restored),
     instead of always dumping you on the all-projects page. */
  function initSmartBack() {
    var back = document.querySelector(".back-link");
    if (!back || !document.referrer) return;
    var u;
    try { u = new URL(document.referrer); } catch (e) { return; }
    if (u.origin !== location.origin) return;               // external referrer — keep default

    var path = u.pathname.replace(/\/$/, "/index.html");     // treat "/" as index.html
    if (path === location.pathname) return;                  // reload / same page

    var fromList = /\/projects\/index\.html$/.test(path);
    var fromHome = /\/index\.html$/.test(path) && !fromList;
    if (!fromHome && !fromList) return;                      // e.g. another case page — keep default

    back.setAttribute("href", document.referrer);
    back.innerHTML = '<span aria-hidden="true">←</span> ' + (fromHome ? "Back home" : "All projects");
    back.addEventListener("click", function (e) {
      if (window.history.length > 1) {                       // real back = restores scroll position
        e.preventDefault();
        window.history.back();
      }
    });
  }

  /* ---------- init ---------- */
  function init() {
    streamHeroName();
    initReveal();
    initScrollSpy();
    initDrawer();
    initTabs();
    initContactForm();
    initEmailLinks();
    initLogoFallback();
    initBackToTop();
    initSmartBack();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
