/* =============================================================
   Aishik's Robot — chat widget (vanilla JS, no framework)

   How it works: each question (+ recent history) is POSTed to a
   Cloudflare Worker (chatbot-proxy/worker.js), which holds the Gemini
   API key server-side and calls Gemma. This file never sees a key and
   never calls Google directly. The reply is rendered as plain text
   (model output is untrusted) with a typing-indicator delay for feel.
   ============================================================= */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- DOM ---------- */
  var root      = document.getElementById("chat");
  var panel     = document.getElementById("chat-panel");
  var fab       = root && root.querySelector(".chat__fab");
  var log       = root && root.querySelector("[data-chat-log]");
  var form      = root && root.querySelector("[data-chat-form]");
  var input     = root && root.querySelector("[data-chat-input]");
  var suggestEl = root && root.querySelector("[data-chat-suggest]");
  if (!root || !panel || !fab || !log || !form || !input) return;

  /* ---------- Contact constants (used only in the connection-error message below) ---------- */
  /* Built from parts, not one literal, so the address isn't sitting in the shipped
     JS as plain scrapeable text — light deterrent, not real security. */
  var EMAIL    = "Aishik.S14" + "@" + "gmail.com";
  var LINKEDIN = "https://www.linkedin.com/in/Aishik-Sarkar";
  function ext(url, label) {
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
  }

  /* The Cloudflare Worker proxy (chatbot-proxy/worker.js) — holds the Gemini key
     server-side and calls Gemma. See chatbot-proxy/README.md to deploy your own. */
  var LLM_ENDPOINT = "https://aishik-bot.ask14112001.workers.dev/";

  var SUGGESTIONS = [
    "What does Aishik do?",
    "Tell me about ReUnite",
    "What's his tech stack?",
    "Where has he worked?",
    "How do I contact him?"
  ];

  // Shown (as authored, trusted HTML — unlike the model's own replies) if the
  // Worker errors, times out, or is unreachable. No offline fallback anymore —
  // this is the whole degrade path.
  var ERROR_REPLY =
    "Sorry, I'm having trouble connecting right now 🤔 — please try again in a moment, " +
    "or reach Aishik directly: " + ext("mailto:" + EMAIL, "email") + " or " +
    ext(LINKEDIN, "LinkedIn") + ".";

  /* ---------- Rendering ---------- */
  function scrollLogToEnd() { log.scrollTop = log.scrollHeight; }

  function addMessage(html, who) {
    var el = document.createElement("div");
    el.className = "msg msg--" + who;
    if (who === "user") { el.textContent = html; }   // user text: never HTML
    else { el.innerHTML = html; }                     // bot text: authored, trusted
    log.appendChild(el);
    scrollLogToEnd();
    return el;
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "msg msg--bot msg--typing";
    el.setAttribute("aria-label", "Aishik's Robot is typing");
    el.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(el);
    scrollLogToEnd();
    return el;
  }

  // Conversation history for LLM context: [{role:'user'|'model', text}]
  var history = [];

  // Render an UNTRUSTED bot reply (LLM output) as plain text — never innerHTML.
  function addBotText(text) {
    var el = document.createElement("div");
    el.className = "msg msg--bot";
    el.textContent = text;
    log.appendChild(el);
    scrollLogToEnd();
  }

  function botReply(query) {
    var typing = showTyping();
    history.push({ role: "user", text: query });

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: query, history: history.slice(-10) }),
      signal: controller.signal
    })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        var reply = data && data.reply ? String(data.reply).trim() : "";
        if (!reply) throw new Error("empty reply");
        typing.remove();
        addBotText(reply);                       // plain text — model output is untrusted
        history.push({ role: "model", text: reply });
      })
      .catch(function () {
        clearTimeout(timer);
        typing.remove();
        addMessage(ERROR_REPLY, "bot");
        history.pop();                           // don't feed a failed turn back as context
      });
  }

  function renderSuggestions() {
    if (!suggestEl) return;
    suggestEl.innerHTML = "";
    SUGGESTIONS.forEach(function (text) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chat__chip";
      chip.textContent = text;
      chip.addEventListener("click", function () { submitQuery(text); });
      suggestEl.appendChild(chip);
    });
  }

  function submitQuery(text) {
    var q = text.trim();
    if (!q) return;
    // Suggestions are only useful before the first message — once a real
    // conversation starts, clear them so the log gets that vertical space
    // back (critical on mobile, where the panel is short).
    if (suggestEl && suggestEl.childNodes.length) suggestEl.innerHTML = "";
    addMessage(q, "user");
    botReply(q);
  }

  /* ---------- Open / close ---------- */
  var greeted = false;
  function isOpen() { return root.classList.contains("is-open"); }

  function openChat() {
    if (isOpen()) return;
    panel.hidden = false;
    root.classList.add("is-open");
    fab.setAttribute("aria-expanded", "true");
    fab.setAttribute("aria-label", "Close Aishik's Robot");
    if (!greeted) {
      greeted = true;
      renderSuggestions();
      // Opening greeting (no user bubble).
      var typing = showTyping();
      setTimeout(function () {
        typing.remove();
        addMessage("Hey! 👋 I'm <strong>Aishik's Robot</strong>. Ask me anything about Aishik — his work, projects, skills, or how to reach him. Tap a suggestion to start.", "bot");
      }, prefersReduced ? 150 : 500);
    }
    // Focus the input for immediate typing (after the open animation).
    setTimeout(function () { input.focus(); }, 120);
  }

  function closeChat() {
    if (!isOpen()) return;
    root.classList.remove("is-open");
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-label", "Open Aishik's Robot");
  }

  function toggleChat() { isOpen() ? closeChat() : openChat(); }

  /* ---------- Wire up ---------- */
  fab.addEventListener("click", toggleChat);

  // Any element flagged data-chat-open (e.g. the hero CTA) opens the chat.
  document.querySelectorAll("[data-chat-open]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openChat();
    });
  });

  root.querySelectorAll("[data-chat-close]").forEach(function (btn) {
    btn.addEventListener("click", closeChat);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = input.value;
    input.value = "";
    submitQuery(value);
  });

  // Escape closes the panel and returns focus to the launcher.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) {
      closeChat();
      fab.focus();
    }
  });
})();
