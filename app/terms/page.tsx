import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Terms of Service — aggrai",
  description: "The terms that govern your use of aggrai.",
};

const LAST_UPDATED = "23 May 2026";

export default function TermsPage() {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-3xl">
        <Link href="/" aria-label="aggrai" className="inline-block mb-10">
          <Logo height={28} gradientId="terms-logo" />
        </Link>

        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-white/40">Last updated: {LAST_UPDATED}</p>

        <article className="prose prose-invert prose-sm sm:prose-base max-w-none mt-10
          prose-headings:text-white prose-headings:font-semibold
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
          prose-p:text-white/70 prose-li:text-white/70
          prose-strong:text-white prose-a:text-teal-300 prose-a:no-underline hover:prose-a:underline">

          <p>
            Welcome to aggrai. These Terms of Service (&quot;Terms&quot;) govern your access
            to and use of aggrai (the &quot;Service&quot;), operated by aggrai (&quot;we&quot;, &quot;us&quot;).
            By creating an account or using the Service you agree to be bound by these
            Terms. If you do not agree, do not use the Service.
          </p>

          <h2>1. Eligibility</h2>
          <p>
            You must be at least 18 years old to create an account. By signing up you
            represent that you meet this requirement and that the information you
            provide is accurate.
          </p>

          <h2>2. Your account</h2>
          <p>
            You are responsible for safeguarding your account credentials and for all
            activity that occurs under your account. Notify us promptly at the email
            below if you suspect unauthorised access. You may not share your account or
            transfer it to anyone else.
          </p>

          <h2>3. The Service</h2>
          <p>
            aggrai lets you send a single question to multiple third-party AI models
            and view their responses side-by-side, together with a summary. The Service
            is offered in three tiers (Free, Pro, Premium) with different model
            catalogs and per-question limits. We may change available models, limits,
            or features at any time.
          </p>

          <h2>4. Third-party AI providers</h2>
          <p>
            Your questions are forwarded to the third-party AI providers you select
            (which may include Anthropic, OpenAI, Google, Meta, Mistral, and others)
            via the OpenRouter routing service. Their terms and privacy policies also
            apply to that processing. We do not control the content, accuracy, or
            availability of their models.
          </p>

          <h2>5. Acceptable use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>break the law, infringe anyone&apos;s rights, or harm others;</li>
            <li>generate content that is unlawful, abusive, harassing, sexual content
              involving minors, or that promotes violence or self-harm;</li>
            <li>attempt to reverse-engineer, scrape, or build a competing product
              from the Service;</li>
            <li>circumvent rate limits, tier limits, or access controls;</li>
            <li>interfere with the Service&apos;s operation (DDoS, malware, automated
              abuse);</li>
            <li>rely on outputs for medical, legal, financial, or other professional
              decisions without independent verification.</li>
          </ul>
          <p>
            We may suspend or terminate accounts that breach these rules, with or
            without notice.
          </p>

          <h2>6. AI output disclaimer</h2>
          <p>
            AI models can produce inaccurate, misleading, biased, or offensive
            content. <strong>You must independently verify any output before relying on
            it.</strong> The Service is provided as a research and comparison tool only;
            outputs do not constitute advice of any kind.
          </p>

          <h2>7. Your content</h2>
          <p>
            You retain ownership of the questions you submit (&quot;Inputs&quot;) and, as
            between you and us, of the responses returned to you (&quot;Outputs&quot;), subject
            to the rights of the third-party model providers. You grant us a limited
            licence to process Inputs and Outputs as needed to operate the Service.
          </p>
          <p>
            We may cache responses to common Inputs to make the Service faster and
            cheaper to operate; cached responses are not personalised and are shared
            with all users asking the same question.
          </p>

          <h2>8. Paid plans</h2>
          <p>
            Paid plans (Pro, Premium) are billed monthly. You may change or cancel
            your plan at any time; cancellations take effect at the end of the current
            billing period and no refunds are issued for partial periods. We may
            change pricing on 30 days&apos; notice.
          </p>

          <h2>9. Beta service</h2>
          <p>
            aggrai is currently in beta. Features may change, break, or be removed.
            We do not guarantee uninterrupted availability and may take the Service
            offline for maintenance at any time.
          </p>

          <h2>10. Intellectual property</h2>
          <p>
            All rights in the Service&apos;s software, branding, and design belong to us
            (or our licensors). Nothing in these Terms transfers any of those rights
            to you, except for a limited, revocable, non-transferable licence to use
            the Service in accordance with these Terms.
          </p>

          <h2>11. Termination</h2>
          <p>
            You may stop using the Service and delete your account at any time. We
            may suspend or terminate your access if you breach these Terms, for legal
            or security reasons, or if we discontinue the Service. On termination the
            licence in section 10 ends and we may delete your account data.
          </p>

          <h2>12. Disclaimer of warranties</h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of
            any kind, express or implied, including warranties of merchantability,
            fitness for a particular purpose, accuracy, or non-infringement, to the
            fullest extent permitted by law.
          </p>

          <h2>13. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, we will not be liable for any
            indirect, incidental, consequential, special, or exemplary damages, or
            for lost profits, revenues, data, or business opportunities, arising from
            your use of the Service. Our total liability for any claim arising under
            or relating to these Terms is capped at the greater of (a) the amount you
            paid us in the six months preceding the claim, or (b) £100.
          </p>
          <p>
            Nothing in these Terms limits liability that cannot be limited by
            applicable law (for example, liability for death or personal injury
            caused by negligence, or for fraud).
          </p>

          <h2>14. Indemnity</h2>
          <p>
            You agree to indemnify and hold us harmless from any claim arising out
            of your breach of these Terms, your misuse of the Service, or your
            violation of any third party&apos;s rights.
          </p>

          <h2>15. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be
            announced via the Service or by email. Continued use after the effective
            date constitutes acceptance.
          </p>

          <h2>16. Governing law</h2>
          <p>
            These Terms are governed by the laws of England and Wales. The courts of
            England and Wales have exclusive jurisdiction over any dispute arising
            from these Terms, save that consumers may also bring proceedings in
            their place of habitual residence.
          </p>

          <h2>17. Contact</h2>
          <p>
            Questions about these Terms? Email <a href="mailto:hello@aggrai.com">hello@aggrai.com</a>.
          </p>

          <hr className="my-10 border-white/10" />
          <p className="text-xs text-white/40">
            This document is a starting draft and should be reviewed by qualified legal
            counsel before relying on it in production.
          </p>
        </article>

        <div className="mt-10 flex items-center gap-4 text-sm">
          <Link href="/privacy" className="text-teal-300 hover:text-teal-200">
            Privacy Policy →
          </Link>
          <Link href="/" className="text-white/40 hover:text-white">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
