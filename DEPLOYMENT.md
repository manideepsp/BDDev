# Deployment & CI/CD

KS Business deploys as two pieces:

- **Frontend (Next.js) → Vercel** — auto-deploys via Vercel's GitHub integration.
- **Backend (FastAPI) → Fly.io** — auto-deploys via GitHub Actions on every push to `main` that touches `backend/`.

The browser only ever talks to the Vercel domain. Next.js rewrites proxy
`/api/*` server-side to the Fly backend, so there are no CORS issues.

```
Browser ──► Vercel (Next.js) ──proxy /api/*──► Fly.io (FastAPI + SQLite + Qdrant)
```

---

## 1. Backend on Fly.io (one-time setup)

Install flyctl and log in:

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

From the `backend/` directory:

```bash
cd backend

# Claim the app name (matches `app` in fly.toml). Do NOT deploy yet.
fly launch --no-deploy --copy-config --name ks-business-backend --region iad

# Create the persistent volume for SQLite + the embedding model cache.
fly volumes create ks_data --size 1 --region iad

# Set runtime secrets (never commit these).
fly secrets set \
  GROQ_API_KEY=xxx \
  QDRANT_URL=https://your-cluster.qdrant.io \
  QDRANT_API_KEY=xxx \
  TAVILY_API_KEY=xxx        # optional

# First deploy.
fly deploy
```

Your backend is now at `https://ks-business-backend.fly.dev`. Verify:

```bash
curl https://ks-business-backend.fly.dev/health   # -> {"status":"ok"}
```

> **Memory:** `fly.toml` requests 1GB because `fastembed` + `onnxruntime`
> exceed the 256MB free allowance. This may incur a small charge. To stay
> fully free, drop Qdrant/embeddings and set `memory = "256mb"`.

### Continuous deploys (GitHub Actions)

`.github/workflows/fly-deploy.yml` redeploys the backend on every push to
`main` under `backend/`. It needs one secret:

```bash
fly tokens create deploy -x 999999h   # copy the token
```

Add it in GitHub: **Settings → Secrets and variables → Actions → New secret**
- Name: `FLY_API_TOKEN`
- Value: the token above

---

## 2. Frontend on Vercel (one-time setup)

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `frontend`.
3. Add an environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://ks-business-backend.fly.dev`
4. Deploy.

Vercel auto-redeploys on every push to `main`. `next.config.mjs` reads
`NEXT_PUBLIC_API_URL` to proxy `/api/*` to Fly; locally it falls back to
`http://localhost:8000`.

---

## 3. CI

`.github/workflows/ci.yml` runs on every push and PR:
- **frontend:** `tsc --noEmit` + `next build`
- **backend:** `compileall` + smoke-import of `main`

---

## Required secrets summary

| Where | Name | Purpose |
|-------|------|---------|
| Fly secrets | `GROQ_API_KEY` | LLM calls |
| Fly secrets | `QDRANT_URL`, `QDRANT_API_KEY` | Vector store (optional) |
| Fly secrets | `TAVILY_API_KEY` | Better web search (optional) |
| GitHub Actions | `FLY_API_TOKEN` | Auto-deploy backend |
| Vercel env | `NEXT_PUBLIC_API_URL` | Point frontend at backend |
