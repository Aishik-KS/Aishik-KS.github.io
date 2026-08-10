/* =============================================================
   Aishik's Robot — client-side assistant (vanilla JS, no backend)

   How it works: user questions are normalised and scored against a
   built-in knowledge base of intents (below), each derived from
   Aishik's profile. The best-matching intent's answer is returned.
   There is no LLM call, no API key, and no network — it runs fully
   offline in the browser, which suits static GitHub Pages hosting.
   To upgrade to a real LLM later, replace `respondTo()` with a
   fetch() to your own backend/proxy.
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

  /* ---------- Contact constants (single source) ---------- */
  var EMAIL    = "Aishik.S14@gmail.com";
  var GITHUB   = "https://github.com/Aishik-KS";
  var LINKEDIN = "https://www.linkedin.com/in/Aishik-Sarkar";
  var MEDIUM   = "https://medium.com/@Aishik_S";

  /* ---------- LLM proxy (optional) ----------
     Leave "" to use the built-in offline knowledge base below.
     To enable a REAL LLM: deploy chatbot-proxy/worker.js to Cloudflare (free),
     then paste its URL here, e.g. "https://aishik-bot.<you>.workers.dev".
     If the proxy errors or is unreachable, the bot silently falls back to the KB. */
  var LLM_ENDPOINT = "https://aishik-bot.ask14112001.workers.dev/";
  function ext(url, label) {
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
  }

  /* ---------- Knowledge base ----------
     Each intent: { patterns: [keywords/phrases], answer: HTML }.
     Patterns are matched as substrings of a space-padded, lower-cased
     query; longer phrases score higher (more specific wins). */
  var KB = [
    {
      generic: true,
      patterns: [" hi ", " hey", "hello", "hiya", " yo ", " sup ", "greetings", "good morning", "good evening", "good afternoon"],
      answer: "Hey! 👋 I'm <strong>Aishik's Robot</strong>. Ask me about his experience, projects, skills, education, or how to reach him — or tap a suggestion below."
    },
    {
      generic: true,
      patterns: ["who are you", "what are you", "your name", "are you a bot", "are you real", "are you ai", "who r u"],
      answer: "I'm <strong>Aishik's Robot</strong> — a little assistant that answers questions about Aishik. I run entirely in your browser from a built-in profile, so I'm fast but offline."
    },
    {
      generic: true,
      patterns: ["who is aishik", "about aishik", "about him", "about himself", "who is he", "summary", "what does aishik do", "what does he do", "tell me about yourself", "about yourself"],
      answer: "Aishik Sarkar is an <strong>AI Software Engineer</strong> and Computer Science (Hons) undergrad at NTU, specialising in <strong>AI &amp; Data Science</strong>. He builds AI systems end to end — from the model on bare metal to the interface you actually touch — and came up through security operations, so he sizes up everything by how it can fail and who can reach it."
    },
    {
      generic: true,
      patterns: ["experience", "work history", "work experience", " work ", "worked", "worked for", "where did you work", "where do you work", "where has he worked", "career", "jobs", "companies", "company", "employment", "roles", "background"],
      answer: "Aishik's roles so far:<ul>" +
        "<li><strong>ST Engineering</strong> — AI Engineer (2026–now)</li>" +
        "<li><strong>Kaveman Productions</strong> — AI Software Engineer (2026)</li>" +
        "<li><strong>Mecatron Robotics</strong> — Full-Stack Web Developer (2025–2026)</li>" +
        "<li><strong>Singapore Armed Forces</strong> — Cyber Security Operator (2022–2024)</li>" +
        "<li><strong>Singtel / NCS Group</strong> — Business &amp; Data Analyst (2021–2022)</li>" +
        "</ul>Ask about any one for details."
    },
    {
      patterns: ["st engineering", "stengg", "current job", "current role", "rag platform", "openrag", "vllm", "self-hosted", "self hosted", "mcp"],
      answer: "At <strong>ST Engineering</strong> (AI Engineer, 2026–present) Aishik built a self-hosted RAG platform that cut documentation lookup time 70% (semantic search over 500+ page manuals), enabled prompt orchestration across 5+ models by re-engineering IBM OpenRAG's auth/routing/LangFlow with OpenRouter and OpenSearch, cut inference costs 60% via 100% local GPU inference with vLLM, and added MCP servers for Excel, Word and MongoDB."
    },
    {
      patterns: ["kaveman", "kaveman productions", "superapp", "super app", "workflow management", "supabase", "next.js", "nextjs"],
      answer: "At <strong>Kaveman Productions</strong> (AI Software Engineer, 2026) he built a Project &amp; Workflow Management SuperApp with real-time sync (React/Next.js, Supabase, Tailwind), took core modules — task/project tracking, admin, client portal, role-based permissions — from prototype to deploy in an 8-week Agile sprint, and cut rework by validating requirements with Figma prototypes and stakeholder workshops."
    },
    {
      patterns: ["mecatron", "robotics", "full-stack developer", "full stack developer", "full-stack web developer"],
      answer: "At <strong>Mecatron Robotics</strong> (Full-Stack Web Developer, 2025–2026) he built the team site and internal tools for a 30+ member engineering team, engineered back-end services, APIs and DB integrations, and delivered +40% navigation efficiency and +35% data-retrieval speed."
    },
    {
      patterns: ["saf", "armed forces", "army", "military", "security operator", "cyber security", "cybersecurity"],
      answer: "In the <strong>Singapore Armed Forces</strong> (Cyber Security Operator, 2022–2024) he monitored and analysed network threats on shift work, ensured early detection of cyber-attacks, investigated breaches, and mentored 15+ personnel in incident-response."
    },
    {
      patterns: ["singtel", "ncs", "data analyst", "business analyst"],
      answer: "At <strong>Singtel — NCS Group</strong> (Business &amp; Data Analyst, 2021–2022) he ran SQL/SAS analysis guiding social programs for 200+ families, optimised a data warehouse for accurate reporting, and built encryption/decryption workflows to secure sensitive data."
    },
    {
      generic: true,
      patterns: ["projects", "what have you built", "what has he built", "portfolio", "hackathon", "featured"],
      answer: "Two favourites, both shipped inside hackathon windows:<ul>" +
        "<li><strong>ReUnite</strong> — an AI lost &amp; found platform (won \"Most Useful\" vs 50+ teams)</li>" +
        "<li><strong>Fact Checker</strong> — a Telegram bot that scores how much to trust a news article</li>" +
        "</ul>Ask me about either one."
    },
    {
      patterns: ["reunite", "lost and found", "lost & found", "lost&found"],
      answer: "<strong>ReUnite</strong> (NTU SummerBuild 2025) is an AI lost-and-found platform — snap a photo and it finds the match. Built on React, Node and Firebase with Gemini AI for image-to-text + visual similarity search (a 60% lift in match accuracy) and email alerts in under 5 seconds. Aishik led a team of 5 and it <strong>won \"Most Useful\" against 50+ teams</strong>."
    },
    {
      patterns: ["fact checker", "factchecker", "fake news", "misinformation", "telegram bot", "credibility"],
      answer: "<strong>Fact Checker</strong> (NTU TechFest 2025) is a Telegram bot that reads a news article and tells you how much to trust it. A prompt-engineered Gemini pipeline assesses tone, sourcing and claim structure (+20% detection accuracy, −30% response time). Aishik led a team of 5 and owned the prompt strategy — testers said the reasoning mattered more than the score."
    },
    {
      patterns: ["skills", "tech stack", "techstack", " stack", "technologies", "languages", "programming", "what can he use", "frameworks", "tools", "tech "],
      answer: "Aishik's toolkit:<ul>" +
        "<li><strong>Languages</strong> — Python, Java, C++, C, JavaScript, SQL, HTML5, CSS3</li>" +
        "<li><strong>Web</strong> — ReactJS, NodeJS, Firebase, Git</li>" +
        "<li><strong>AI / ML / Data</strong> — vLLM, LangFlow, OpenRAG, OpenSearch, MCP, Gemini, Claude, Prompt Engineering, KNIME</li>" +
        "<li><strong>Tools</strong> — Figma, VS Code, IntelliJ, Arduino, Raspberry Pi, Fusion 360</li>" +
        "</ul>"
    },
    {
      patterns: ["education", "study", "studied", "degree", "university", "ntu", "nanyang", "school", "polytechnic", "singapore polytechnic", "cgpa", "course"],
      answer: "Education:<ul>" +
        "<li><strong>Nanyang Technological University</strong> — BComp (Hons), Computer Science (2024–2028), double specialisation in AI &amp; Data Science, on a Work-Study Degree with ST Engineering.</li>" +
        "<li><strong>Singapore Polytechnic</strong> — Diploma in Computer Engineering (2019–2022), Singtel Engineering Scholar &amp; Director's Honour Roll.</li>" +
        "</ul>"
    },
    {
      patterns: ["leadership", "involvement", "deep learning week", "dlw", "president", "club", "community", "organis", "organiz", "committee"],
      answer: "Leadership highlights:<ul>" +
        "<li><strong>Deputy President</strong>, NTU Deep Learning Week 2027 — leads one of ASEAN's largest student-run AI hackathons (1000+ participants, 50+ organizers).</li>" +
        "<li><strong>Academics Division</strong>, Deep Learning Week 2026 — built the academic framework + automated scoring.</li>" +
        "<li><strong>Community Projects</strong>, NTU ML &amp; Data Analytics.</li>" +
        "<li><strong>Head of Events</strong>, SP Infocomm Club — +200% event turnout.</li>" +
        "</ul>"
    },
    {
      patterns: ["certificate", "certification", "cert", "huawei", "hcia"],
      answer: "Aishik holds the <strong>Huawei Certified ICT Associate (HCIA) — AI</strong>, issued Aug 2024 by Huawei Technologies. It's verifiable via Huawei's certificate portal (linked in the Certificates section)."
    },
    {
      patterns: ["contact", "reach", "email", "get in touch", "linkedin", "github", "medium", "connect", "socials", "links"],
      answer: "Here's how to reach Aishik:<ul>" +
        "<li>Email — " + ext("mailto:" + EMAIL, EMAIL) + "</li>" +
        "<li>GitHub — " + ext(GITHUB, "Aishik-KS") + "</li>" +
        "<li>LinkedIn — " + ext(LINKEDIN, "Aishik-Sarkar") + "</li>" +
        "<li>Medium — " + ext(MEDIUM, "@Aishik_S") + "</li>" +
        "</ul>"
    },
    {
      patterns: ["resume", "cv", "resumé", "résumé", "curriculum"],
      answer: "You can view Aishik's résumé here: " + ext("assets/resume.pdf", "résumé (PDF)") + " — it opens in a new tab."
    },
    {
      patterns: ["hire", "hiring", "available", "opportunity", "opportunities", "internship", "freelance", "job offer", "recruit", "work with"],
      answer: "Aishik is always open to interesting AI and engineering opportunities. The best way to start a conversation is email — " + ext("mailto:" + EMAIL, EMAIL) + " — or " + ext(LINKEDIN, "LinkedIn") + "."
    },
    {
      patterns: ["artificial intelligence", "machine learning", "llm", "large language model", "specialis", "specializ", "focus", "what kind of ai"],
      answer: "Aishik specialises in <strong>AI &amp; Data Science</strong>, with a focus on <strong>self-hosted LLM and RAG systems</strong> — making capable AI run on local GPUs under real security constraints — alongside full-stack product work."
    },
    {
      patterns: ["location", "based", "where is he", "where does he live", "country", "singapore"],
      answer: "Aishik is based in <strong>Singapore</strong> 🇸🇬."
    },
    {
      generic: true,
      patterns: ["hobby", "hobbies", "for fun", "free time", "passion"],
      answer: "His tagline says it: <strong>\"I build intelligent AI systems for fun.\"</strong> A lot of his projects start as a \"what if I just built this?\" and turn into something real."
    },
    {
      generic: true,
      patterns: ["thanks", "thank you", " thx", " ty ", "cheers", "appreciate"],
      answer: "Anytime! 🤖 Ask me anything else about Aishik."
    }
  ];

  var SUGGESTIONS = [
    "What does Aishik do?",
    "Tell me about ReUnite",
    "What's his tech stack?",
    "Where has he worked?",
    "How do I contact him?"
  ];

  var FALLBACK =
    "I'm not sure about that one 🤔 — but I can tell you about Aishik's " +
    "<strong>experience</strong>, <strong>projects</strong>, <strong>skills</strong>, " +
    "<strong>education</strong>, <strong>leadership</strong>, or <strong>contact</strong> details. " +
    "Try one of the suggestions below.";

  /* ---------- Matching ---------- */
  function normalise(s) {
    return (" " + s.toLowerCase() + " ").replace(/[^a-z0-9@.& ]+/g, " ").replace(/\s+/g, " ");
  }
  function respondTo(query) {
    var q = " " + query.toLowerCase().replace(/[^a-z0-9@.& ]+/g, " ").replace(/\s+/g, " ") + " ";
    var best = null, bestScore = 0;
    KB.forEach(function (intent) {
      var score = 0;
      intent.patterns.forEach(function (p) {
        if (q.indexOf(p) !== -1) score += p.trim().length;
      });
      // Specific/topic intents beat generic conversational ones ("tell me about…",
      // "what does he do") whenever a real topic keyword is present.
      if (score > 0 && !intent.generic) score += 100;
      if (score > bestScore) { bestScore = score; best = intent; }
    });
    return best ? best.answer : FALLBACK;
  }

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

    // Offline mode: answer from the built-in knowledge base.
    if (!LLM_ENDPOINT) {
      var answer = respondTo(query);
      var delay = prefersReduced ? 200 : 450 + Math.min(900, answer.length * 4);
      setTimeout(function () {
        typing.remove();
        addMessage(answer, "bot");
        history.push({ role: "model", text: answer });
      }, delay);
      return;
    }

    // LLM mode: call the proxy; fall back to the KB on any error/timeout.
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
        var fallback = respondTo(query);         // graceful degrade to the offline KB
        addMessage(fallback, "bot");
        history.push({ role: "model", text: fallback });
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
