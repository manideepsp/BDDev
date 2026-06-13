# Staged CI/CD (dormant)

These workflows are **set aside** — they live here instead of `.github/workflows/`
so GitHub does NOT run them yet. The Fly.io backend deploy config
(`backend/Dockerfile`, `backend/fly.toml`) and `DEPLOYMENT.md` remain in place.

## To re-activate later

```bash
mkdir -p .github/workflows
git mv deploy/staged/ci.yml .github/workflows/ci.yml
git mv deploy/staged/fly-deploy.yml .github/workflows/fly-deploy.yml
git commit -m "ci: re-activate workflows"
```

Then add the `FLY_API_TOKEN` GitHub secret and the `NEXT_PUBLIC_API_URL`
Vercel env var as described in `DEPLOYMENT.md`.
