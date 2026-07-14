import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Privacy Policy — aggrai",
  description: "How aggrai collects, uses, and protects your data.",
};

const LAST_UPDATED = "23 May 2026";

export default function PrivacyPage() {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-3xl">
        <Link href="/" aria-label="aggrai" className="inline-block mb-10">
          <Logo height={28} gradientId="privacy-logo" />
        </Link>

        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-white/40">Last updated: {LAST_UPDATED}</p>

        <article className="prose prose-invert prose-sm sm:prose-base max-w-none mt-10
          prose-headings:text-white prose-headings:font-semibold
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
          prose-p:text-white/70 prose-li:text-white/70
          prose-strong:text-white prose-a:text-teal-300 prose-a:no-underline hover:prose-a:underline">

          <p>
            This Privacy Policy explains how aggrai (&quot;we&quot;, &quot;us&quot;) collects, uses, and
            shares information when you use aggrai (the &quot;Service&quot;). By using the
            Service you agree to the practices described here.
          </p>

          <h2>1. Information we collect</h2>
          <p>We collect the following categories of data:</p>
          <ul>
            <li><strong>Account data</strong>: when you create an account, your email
              address and a securely hashed password (handled by our auth provider).</li>
            <li><strong>Questions and selections</strong>: the questions you ask, the
              AI models you choose, and the resulting responses.</li>
            <li><strong>Plan and billing</strong>: the tier you&apos;re on (Free, Pro, or
              Premium) and any related transactional records.</li>
            <li><strong>Technical &amp; analytics data</strong>: only with your consent,
              a pseudonymous per-browser id, your IP address, coarse device/browser type
              and approximate country — used to understand usage and catch errors. If you
              reject analytics we do not store these; we keep only anonymised operational
              records (see &ldquo;If you reject analytics&rdquo; below).</li>
            <li><strong>Cookies &amp; local storage</strong>: strictly-necessary cookies to
              keep you signed in and to remember your cookie choice, plus optional analytics
              — error monitoring and the pseudonymous usage identifiers above — that run
              only with your consent (see the table below). We do not use advertising or
              cross-site tracking cookies.</li>
          </ul>

          <div className="overflow-x-auto">
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-white/50">
                  <th className="py-2 pr-4 font-medium">Cookie / storage</th>
                  <th className="py-2 pr-4 font-medium">Purpose</th>
                  <th className="py-2 font-medium">Category</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-t border-white/10">
                  <td className="py-2 pr-4"><code>sb-*</code> (Supabase)</td>
                  <td className="py-2 pr-4">Keeps you signed in.</td>
                  <td className="py-2 whitespace-nowrap">Strictly necessary</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="py-2 pr-4"><code>aggrai_consent_v1</code></td>
                  <td className="py-2 pr-4">Remembers your cookie choice.</td>
                  <td className="py-2 whitespace-nowrap">Strictly necessary</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="py-2 pr-4">Sentry (error monitoring)</td>
                  <td className="py-2 pr-4">Reports crashes so we can fix them. Loads only after you Accept; manage it any time in Settings &rarr; Cookies &amp; tracking.</td>
                  <td className="py-2 whitespace-nowrap">Analytics (optional)</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="py-2 pr-4"><code>aggrai_anon_id</code> (local storage)</td>
                  <td className="py-2 pr-4">A pseudonymous per-browser id so we can tell anonymous visitors apart. Written only after you Accept; removed if you Reject.</td>
                  <td className="py-2 whitespace-nowrap">Analytics (optional)</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="py-2 pr-4"><code>aggrai_session_id</code> (session storage)</td>
                  <td className="py-2 pr-4">Groups your activity within a single browser tab. Written only after you Accept; cleared when the tab closes or you Reject.</td>
                  <td className="py-2 whitespace-nowrap">Analytics (optional)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4">
            <strong>If you reject analytics</strong>, we switch off the items marked
            &ldquo;optional&rdquo; above and clear their identifiers. We still process what
            we genuinely need to run aggrai: your account (to sign you in and provide your
            history), the questions you ask and the models you run — with their token and
            cost accounting — and a coarse country to choose a language variant. Those
            records carry no per-visitor id, IP address or device profile, and we rely on
            our legitimate interest in operating and securing the Service (and, for account
            data, on performing our contract with you). Signing in is unaffected by this
            choice.
          </p>

          <h2>2. How we use it</h2>
          <ul>
            <li>To provide and operate the Service (routing your question to the
              models you selected, returning their answers).</li>
            <li>To enforce tier limits and prevent abuse.</li>
            <li>To improve the Service — for example by caching responses to common
              questions so they load instantly for everyone, and by logging how
              our internal question classifier categorised your input so we can
              tune it over time.</li>
            <li>To respond to support requests submitted via our contact form
              (stored with your name, email and message until we&apos;ve replied).</li>
            <li>To respond to support requests and security incidents.</li>
            <li>To comply with legal obligations.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your personal data and we do <strong>not</strong> use your
            personal questions to train our own models.
          </p>
          <p className="text-sm text-white/40">
            <em>Note</em>: your recent comparisons are also kept in your browser tab&apos;s
            session storage so you can switch between them instantly. That data
            never leaves your device and is cleared when you close the tab.
          </p>

          <h2>3. Third-party AI providers</h2>
          <p>
            When you submit a question, the question text and your model selection are
            forwarded to the third-party AI providers you chose, via the OpenRouter
            routing service. Each provider processes that question under its own
            privacy policy. Avoid submitting confidential or personally identifying
            information in your questions.
          </p>
          <p>Current providers may include:</p>
          <ul>
            <li>Anthropic (Claude) — <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer">privacy policy</a></li>
            <li>OpenAI (GPT) — <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noreferrer">privacy policy</a></li>
            <li>Google (Gemini) — <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">privacy policy</a></li>
            <li>Meta (Llama) — <a href="https://www.llama.com/use-policy" target="_blank" rel="noreferrer">use policy</a></li>
            <li>Mistral — <a href="https://mistral.ai/terms" target="_blank" rel="noreferrer">terms</a></li>
            <li>OpenRouter — <a href="https://openrouter.ai/privacy" target="_blank" rel="noreferrer">privacy policy</a></li>
          </ul>

          <h2>4. Service providers we use</h2>
          <p>
            We rely on a small number of trusted providers to run the Service. These
            providers process data on our behalf only as required to deliver their
            service:
          </p>
          <ul>
            <li><strong>Supabase</strong> — account authentication and database.</li>
            <li><strong>Vercel</strong> — application hosting and edge runtime.</li>
            <li><strong>Cloudflare</strong> — DNS and tunnel.</li>
            <li><strong>Sentry</strong> — error monitoring.</li>
            <li><strong>OpenRouter</strong> — AI model routing (see section 3).</li>
            <li><strong>Stripe</strong> — payments (when paid plans are enabled).</li>
          </ul>

          <h2>5. Caching of common questions</h2>
          <p>
            To keep the Service fast and affordable we cache the responses to common
            example questions and reuse them across users. Cached responses are not
            tied to your account and do not include any personal identifiers.
          </p>

          <h2>6. Data retention</h2>
          <ul>
            <li>Account data is retained for as long as your account is active.
              On account deletion it is removed within 30 days, except where we
              must retain it to comply with legal obligations.</li>
            <li>Cached example responses are retained for up to 24 hours and refreshed
              periodically.</li>
            <li>Operational logs (errors, abuse signals) are retained for up to 90 days.</li>
          </ul>

          <h2>7. Security</h2>
          <p>
            We use reasonable technical and organisational measures to protect your
            data: HTTPS in transit, password hashing via our auth provider, access
            controls, and regular updates. No system is perfectly secure; we cannot
            guarantee absolute security.
          </p>

          <h2>8. Your rights</h2>
          <p>
            Depending on your jurisdiction you may have the right to access, correct,
            export, or delete the personal data we hold about you, and to object to
            or restrict certain processing. You can download a copy of your data or
            permanently delete your account yourself at any time from{" "}
            <a href="/settings">Settings &rarr; Privacy &amp; data</a>. To exercise these
            rights another way, email
            <a href="mailto:privacy@aggrai.com"> privacy@aggrai.com</a>. We may need to verify
            your identity before responding.
          </p>

          <h2>9. International transfers</h2>
          <p>
            Our infrastructure providers operate globally; your data may be
            transferred to and processed in countries other than your own,
            including the United States and the European Union. Where required,
            transfers rely on standard contractual clauses or equivalent safeguards.
          </p>

          <h2>10. Children</h2>
          <p>
            The Service is not intended for children under 18. We do not knowingly
            collect data from children. If you believe a child has provided us with
            personal data, contact us and we will delete it.
          </p>

          <h2>11. Changes to this policy</h2>
          <p>
            We may update this policy as the Service evolves. Material changes will
            be announced via the Service or by email; the &quot;Last updated&quot; date at
            the top of the page always reflects the current version.
          </p>

          <h2>12. Contact</h2>
          <p>
            Questions, requests, or complaints? Email
            <a href="mailto:privacy@aggrai.com"> privacy@aggrai.com</a>.
          </p>

          <hr className="my-10 border-white/10" />
          <p className="text-xs text-white/40">
            This document is a starting draft and should be reviewed by qualified
            legal counsel before relying on it in production.
          </p>
        </article>

        <div className="mt-10 flex items-center gap-4 text-sm">
          <Link href="/terms" className="text-teal-300 hover:text-teal-200">
            Terms of Service →
          </Link>
          <Link href="/" className="text-white/40 hover:text-white">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
