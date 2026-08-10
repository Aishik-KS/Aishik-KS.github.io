# Aishik's Robot — real-LLM setup (Cloudflare Worker + Gemini)

This turns the offline chatbot into a real Gemini-backed one **without exposing an API key**.
The Worker runs on Cloudflare (free), holds the key server-side, and the website calls it.

```
Browser (chatbot.js) ──POST {message, history}──▶ Cloudflare Worker ──▶ Gemini API
        no key                                     (secret key here)
```

You do this **once**, all in the browser (no command line needed). ~10 minutes.

---

## Step 1 — Get a free Gemini API key
1. Go to **https://aistudio.google.com/apikey** (sign in with Google).
2. Click **Create API key** → copy it. Keep it secret.
3. Leave it on the **free tier** (don't add billing) — then the worst case is the bot
   hits the free quota and quietly falls back to the offline answers. No surprise bill.

## Step 2 — Create the Cloudflare Worker
1. Sign up / log in at **https://dash.cloudflare.com** (free).
2. Left sidebar → **Workers & Pages** → **Create** → **Create Worker**.
3. Give it a name, e.g. **`aishik-bot`** → **Deploy** (deploys the default hello-world).
4. Click **Edit code**. Select all the placeholder code, delete it, and paste the entire
   contents of **`worker.js`** (in this folder). Click **Deploy**.

## Step 3 — Add your API key as a secret
1. On the Worker's page → **Settings** → **Variables and Secrets** (or "Variables").
2. Add a variable named **exactly** `GEMINI_KEY`, paste your key as the value,
   choose **Encrypt** / **Secret**, and **Save / Deploy**.
   - The name must be `GEMINI_KEY` — that's what `worker.js` reads (`env.GEMINI_KEY`).

## Step 4 — Copy the Worker URL
On the Worker page you'll see its URL, like:
```
https://aishik-bot.<your-subdomain>.workers.dev
```
Copy it.

## Step 5 — Point the website at the Worker
1. Open **`js/chatbot.js`**, find near the top:
   ```js
   var LLM_ENDPOINT = "";
   ```
   Set it to your Worker URL:
   ```js
   var LLM_ENDPOINT = "https://aishik-bot.<your-subdomain>.workers.dev";
   ```
2. In **`worker.js`**, the `ALLOWED_ORIGINS` list already includes
   `https://aishik-ks.github.io`. If your site URL differs, edit that list and re-Deploy the Worker.
3. Re-upload the changed `js/chatbot.js` to your GitHub repo (or the whole `deploy/` folder).
   **Bump the cache tag** on the chatbot script in every HTML file, e.g. `chatbot.js?v=3` → `?v=4`,
   so browsers fetch the new file. (Ask Claude to do this if unsure.)

Done — the bot now answers with Gemini, grounded in the profile inside `worker.js`.
If the Worker is ever down or over quota, the site automatically uses the offline answers.

---

## Keeping it safe & cheap
- **Free tier, no billing** = no possible charge. If you later add billing, set a budget cap.
- `ALLOWED_ORIGINS` limits who the Worker answers (deters casual abuse; not bulletproof since
  the `Origin` header can be faked by non-browsers — fine for a portfolio).
- `MAX_MESSAGE` (800 chars) caps request size. `maxOutputTokens` caps reply length.
- Want hard rate-limiting per visitor? Cloudflare's dashboard has **Rate limiting rules**, or add
  Workers KV — optional; not needed to launch.

## Updating the bot's knowledge
Edit the `SYSTEM_PROMPT` string in `worker.js` (keep it in sync with `about.md`) and re-Deploy
the Worker. No website change needed for prompt tweaks.

## Switching model / provider
- Different Gemini model: change `MODEL` (e.g. `gemini-2.5-flash`).
- Prefer Claude/OpenAI/OpenRouter instead? The shape is the same — swap the `fetch` URL, headers,
  and request/response mapping in `worker.js`. Ask Claude and it'll rewrite the Worker for that provider.
