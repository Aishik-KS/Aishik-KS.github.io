/* ============================================================
   Aishik's Robot — Cloudflare Worker proxy (Gemini-backed)
   ------------------------------------------------------------
   This runs on Cloudflare (NOT on GitHub Pages). It holds your
   Gemini API key as an encrypted secret so the key is never sent
   to the browser. The website calls this Worker; the Worker calls
   Gemini and returns the answer.

   Setup steps are in README.md next to this file.
   ============================================================ */

// 1) Only requests from these origins are answered (deters casual abuse).
//    Add/remove as needed. Keep your GitHub Pages URL; add your custom
//    domain here too once you have it.
const ALLOWED_ORIGINS = [
  "https://aishik-ks.github.io",
  "https://aishik-ks.ai",
  "https://www.aishik-ks.ai",
  "http://localhost:8000",     // for local testing
];

// 2) Model + limits. gemini-2.0-flash is fast and has a free tier.
const MODEL       = "gemini-2.0-flash";
const MAX_MESSAGE = 800;   // max chars per user message (caps cost/abuse)

// 3) Who the bot is + the ONLY facts it may use. Keep in sync with about.md.
const SYSTEM_PROMPT = `You are "Aishik's Robot", a friendly assistant on Aishik Kumar Sarkar's personal portfolio website. Answer visitors' questions about Aishik in the third person, warmly and concisely (usually 1–3 sentences). Use ONLY the facts below. If you don't know or the question is unrelated to Aishik, say so briefly and point them to his contact links. Never invent facts, employers, dates, or metrics. Reply in plain text — no markdown, no HTML.

ABOUT
- AI Software Engineer; Computer Science (Hons) undergrad at NTU (Aug 2024 – expected Jun 2028), double specialisation in AI & Data Science, on a Work-Study degree with ST Engineering.
- Builds AI systems end to end; came up through security operations.
- Contact: email Aishik.S14@gmail.com · GitHub github.com/Aishik-KS · LinkedIn linkedin.com/in/Aishik-Sarkar · Medium medium.com/@Aishik_S.

WORK
- ST Engineering — AI Engineer (May 2026–present): built a self-hosted RAG platform that cut documentation lookup time 70% across 500+ page manuals; prompt orchestration across 5+ models (re-engineered OpenRAG auth/routing/LangFlow, OpenRouter, OpenSearch); cut inference costs 60% via 100% local GPU inference with vLLM; added MCP servers for Excel, Word, MongoDB.
- Kaveman Productions — AI Software Engineer (Mar–May 2026): built a Project & Workflow Management SuperApp with real-time sync (React/Next.js, Supabase, Tailwind); prototype to deployed build in an 8-week Agile sprint.
- Mecatron Robotics — Full-Stack Web Developer (Jul 2025–May 2026): official site + internal tools for a 30+ member team; +40% navigation efficiency, +35% data-retrieval speed.
- Singapore Armed Forces — Cyber Security Operator, National Service (Oct 2022–Aug 2024): monitored network threats, investigated breaches, mentored 15+ personnel.
- Singtel / NCS Group — Business & Data Analyst (Oct 2021–Apr 2022): SQL/SAS analysis for social programs (200+ families); optimised a data warehouse; built encryption/decryption workflows.

PROJECTS
- ReUnite — AI lost & found for NTU (SummerBuild 2025, won "Most Useful" out of 50+ teams). ReactJS/NodeJS/Firebase + Gemini image-to-text and visual similarity; +60% match accuracy; under-5-second email alerts. Team of 5 — Aishik led and owned the AI matching.
- Fact Checker — Telegram bot that scores news credibility (NTU TechFest 2025). Python + prompt-engineered Gemini pipeline; +20% detection accuracy, −30% response time. Team of 5 — Aishik led the prompt strategy.

LEADERSHIP
- NTU Deep Learning Week (DLW) 2027 — Deputy President; DLW 2026 — Academics Division; NTU MLDA — Community Projects; SP Infocomm Club — Head of Events.

SKILLS
- Languages: Python, Java, C++, C, JavaScript, SQL, HTML5, CSS3, Git.
- Web & frameworks: ReactJS, Next.js, NodeJS, Supabase, Firebase.
- AI/ML: RAG, vLLM, LangFlow, OpenRAG, OpenSearch, MCP, Gemini, Claude, prompt engineering, KNIME.
- Tools: Figma, VS Code, IntelliJ, PyCharm, Android Studio.

CERTIFICATES
- Huawei Certified ICT Associate (HCIA) — AI.`;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }

    const message = String(body.message || "").slice(0, MAX_MESSAGE).trim();
    if (!message) return json({ error: "empty message" }, 400, cors);

    // Build Gemini "contents" from recent history + the new message.
    const hist = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const contents = hist
      .filter((m) => m && m.text)
      .map((m) => ({
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: String(m.text).slice(0, 2000) }],
      }));
    contents.push({ role: "user", parts: [{ text: message }] });

    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 300 },
    };

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_KEY}`;

    let g;
    try {
      g = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      return json({ error: "upstream unreachable" }, 502, cors);
    }
    if (!g.ok) {
      let detail = "";
      try { detail = (await g.text()).slice(0, 600); } catch {}
      console.log("Gemini error", g.status, detail);   // visible in Cloudflare live logs
      return json({ error: "model error " + g.status, detail }, 502, cors);
    }

    const data = await g.json();
    const reply = ((data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts) || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    return json({ reply: reply || "Sorry — I couldn't answer that one." }, 200, cors);
  },
};
