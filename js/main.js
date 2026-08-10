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

    function activate(index, focus) {
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
        if (panels[i]) panels[i].hidden = !selected;
      });
      if (ind) ind.style.transform = "translateX(" + index * 100 + "%)";
      if (focus && tabs[index]) tabs[index].focus();
    }

    seg.addEventListener("click", function (e) {
      var tab = e.target.closest(".seg__btn");
      if (tab) activate(tabs.indexOf(tab), false);
    });

    // Arrow-key navigation between tabs (WAI-ARIA pattern).
    seg.addEventListener("keydown", function (e) {
      var current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      var next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (current + 1) % tabs.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (current - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next !== null) { e.preventDefault(); activate(next, true); }
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
    var EMAIL = "Aishik.S14@gmail.com";

    function setNote(text, ok) {
      if (!note) return;
      note.textContent = text;
      note.classList.toggle("is-error", !ok);
      note.classList.toggle("is-ok", ok);
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

      var subject = encodeURIComponent("Portfolio enquiry from " + name);
      var body = encodeURIComponent(message + "\n\n— " + name + "\n" + email);
      window.location.href = "mailto:" + EMAIL + "?subject=" + subject + "&body=" + body;

      setNote("Opening your email app… if nothing happens, write to " + EMAIL + " directly.", true);
      form.reset();
    });
  }

  /* ---------- 7. Back to top ---------- */
  function initBackToTop() {
    document.querySelectorAll("[data-scroll-top]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
      });
    });
  }

  /* ---------- 8. Smart "back" link on case / listing pages ----------
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
    initBackToTop();
    initSmartBack();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
