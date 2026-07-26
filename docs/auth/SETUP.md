# aggrai — auth + email launch setup

Everything in **code** is done and deployed: `/signin` shows **Continue with Google**, **Continue with GitHub**, email/password, and **Forgot password?**; a shared `/auth/callback` completes every provider + the password‑recovery exchange; `/forgot` + `/reset-password` handle resets. What remains is **console + DNS setup only you can do** (it involves your Google/GitHub/Supabase accounts, secrets, and aggrai.com DNS — I don't touch those).

Do the steps in order. Est. 45–60 min, most of it waiting on DNS.

**Confirmed values (used below):**
- Supabase project URL: `https://kmkuajbtygqwbipcgxxa.supabase.co`
- Provider redirect URI (same for Google + GitHub): `https://kmkuajbtygqwbipcgxxa.supabase.co/auth/v1/callback`
- Site URL: `https://www.aggrai.com`
- App callback (your allow‑list): `https://www.aggrai.com/auth/callback`

> Note: this wires the providers **behind** the existing beta password wall. It does **not** drop the wall — that stays a separate, deliberate launch flip.

---

## 1) Google OAuth — Google Cloud Console

1. https://console.cloud.google.com → create/select a project (e.g. `aggrai`).
2. **APIs & Services → OAuth consent screen**: External. App name `aggrai`, your support email, app logo (optional), **Authorized domain** `aggrai.com`, links to `https://www.aggrai.com/terms` and `/privacy`. Scopes: `email`, `profile`, `openid`. Save. (You can keep it in "Testing" with yourself as a test user until launch; publish before going public to drop the "unverified app" screen.)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins:** `https://www.aggrai.com` and `https://aggrai.com`
   - **Authorized redirect URIs:** `https://kmkuajbtygqwbipcgxxa.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**.

## 2) GitHub OAuth — GitHub Developer settings

1. https://github.com/settings/developers → **OAuth Apps → New OAuth App**:
   - Application name: `aggrai`
   - Homepage URL: `https://www.aggrai.com`
   - Authorization callback URL: `https://kmkuajbtygqwbipcgxxa.supabase.co/auth/v1/callback`
2. Create → **Generate a new client secret**. Copy the **Client ID** + **secret**.

## 3) Enable the providers in Supabase

Dashboard → **Authentication → Providers**:
- **Google** → enable → paste Client ID + secret → Save.
- **GitHub** → enable → paste Client ID + secret → Save.

Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://www.aggrai.com`
- **Redirect URLs** (add each):
  - `https://www.aggrai.com/auth/callback`
  - `https://aggrai.com/auth/callback`
  - `http://localhost:3000/auth/callback` (local dev — optional)
  - `https://*.vercel.app/auth/callback` (preview deploys — optional)

## 4) Email deliverability — Resend + custom SMTP

Supabase's built‑in email is **test‑only** (~2–4/hr, spam‑prone). Real signup/reset email needs custom SMTP on a verified aggrai.com domain.

1. https://resend.com → sign up.
2. **Add domain** `aggrai.com`. Resend shows DNS records — add them where aggrai.com DNS lives (Cloudflare):
   - **DKIM** (`TXT`, e.g. host `resend._domainkey`)
   - **SPF / return‑path** (`MX` + `TXT` on the `send` subdomain Resend specifies)
   - **DMARC** (`TXT` at `_dmarc`, e.g. `v=DMARC1; p=none;`) — recommended
   Wait for Resend to show **Verified** (minutes–hours; Cloudflare is fast). If records are proxied (orange cloud), set them to **DNS only**.
3. Get SMTP creds: Resend → **API Keys** → create one (this is the SMTP password). SMTP host `smtp.resend.com`, port `465`, user `resend`.
4. Supabase → **Project Settings → Authentication → SMTP Settings** → enable **Custom SMTP**:
   - Host `smtp.resend.com` · Port `465` · Username `resend` · Password `<Resend API key>`
   - **Sender email** `no-reply@aggrai.com` (must be on the verified domain) · **Sender name** `aggrai`
   - Save. (Optionally raise Auth → Rate Limits for emails.)

## 5) Branded email templates

Supabase → **Authentication → Email Templates**:
- **Confirm signup** → paste [`email-confirm-signup.html`](./email-confirm-signup.html). Subject: `Confirm your aggrai account`
- **Reset password** → paste [`email-reset-password.html`](./email-reset-password.html). Subject: `Reset your aggrai password`
- Leave `{{ .ConfirmationURL }}` intact in both.

## 6) Email confirmation toggle

Supabase → **Authentication → Providers → Email** → **Confirm email**:
- **ON** (recommended) — verifies the address; the signin page already handles the "check your email, then sign in" flow. Google/GitHub users skip this (already verified by the provider).
- OFF — instant signup, no confirmation email (weaker; allows fake addresses).

---

## 7) Verify end‑to‑end (after 1–6)

On `https://www.aggrai.com/signin` (past the beta wall):
- [ ] You see **Continue with Google**, **Continue with GitHub**, the email form, and **Forgot password?**
- [ ] **Google**: click → consent → back to `/app`, signed in. Supabase → Auth → Users shows the account.
- [ ] **GitHub**: same.
- [ ] **Funnel**: for a signup that came from a share link (with analytics consent), the new `profiles` row has `anon_id` + `ref` filled.
- [ ] **Email signup**: sign up → branded confirm email arrives from `no-reply@aggrai.com` (inbox, not spam) → confirm → sign in.
- [ ] **Reset**: `/forgot` → branded reset email → link → `/reset-password` → set new password → signed in.
- [ ] **Paid + social**: pick **Pro**, then Continue with Google → lands on `/checkout`.

## Gotchas & notes

- **Beta wall:** users still need the beta password to reach `/signin`; `/auth/callback` is allow‑listed so the provider return isn't bounced. Open reset links in the same (beta‑authenticated) browser until the wall drops at launch.
- **Google "unverified app":** harmless for `email`/`profile` scopes while testing; publish/verify the consent screen before public launch.
- **Adding Apple (or Microsoft, etc.) later:** the code is provider‑agnostic. Add one entry to `OAUTH_PROVIDERS` in `app/signin/page.tsx` and enable the provider in Supabase — no new code path. (Apple also needs the $99/yr Apple Developer membership + a client‑secret JWT rotated every 6 months — worth doing alongside the iOS app, which requires that membership regardless.)
