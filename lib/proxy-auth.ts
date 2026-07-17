// AGG-48: the shared secret the Vercel proxy attaches when forwarding to the
// backend, so the backend can tell a request genuinely came THROUGH the proxy
// (vs. a direct hit on api.aggrai.com forging x-aggrai-* identity/consent
// headers). The backend trusts those forwarded headers only when this is present
// and valid. Returns {} when AGGRAI_PROXY_SECRET is unset, so enabling it is a
// safe, ordered rollout: set the secret in VERCEL first (proxy starts sending
// it), then in Fly (backend starts enforcing).
export function proxyAuthHeaders(): Record<string, string> {
  const s = process.env.AGGRAI_PROXY_SECRET;
  return s ? { "x-aggrai-proxy-secret": s } : {};
}
