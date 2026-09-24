import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/src/components/layout/SiteHeader';
import { SiteFooter } from '@/src/components/layout/SiteFooter';
import { ArrowLeft, CheckCircle2, Ban, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: "Terms and Conditions — Resurox",
  description: "Terms and conditions governing the use of Resurox's resume analysis workbench, deterministic scoring, and BYO AI provider features.",
};

export default function TermsPage() {
  const lastUpdated = "September 19, 2026";

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1B19] font-serif selection:bg-[#7A1F1F] selection:text-white flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Breadcrumb Navigation */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#1C1B19]/70 hover:text-[#7A1F1F] transition-colors no-underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </Link>
        </div>

        {/* Page Header */}
        <header className="border-b-2 border-[#1C1B19] pb-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#7A1F1F]">
              [ LEGAL TERMS & ACCEPTABLE USE ]
            </span>
            <span className="font-mono text-xs text-[#1C1B19]/60">
              Last Updated: {lastUpdated}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-extrabold text-[#1C1B19] tracking-tight leading-tight mb-3">
            Terms & Conditions
          </h1>

          <p className="font-serif italic text-base sm:text-lg text-[#1C1B19]/75 leading-relaxed">
            Please review these Terms & Conditions (&ldquo;Terms&rdquo;) carefully before using the Resurox platform, hosted applications, and analysis services operated by Resurox (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;).
          </p>
        </header>

        {/* Legal Disclaimer Box */}
        <div className="mb-10 p-5 border-2 border-[#7A1F1F] bg-[#7A1F1F]/5 shadow-[3px_3px_0px_#7A1F1F] flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-[#7A1F1F] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#7A1F1F]">
              Legal Review Notice (Draft Agreement)
            </h2>
            <p className="font-serif text-xs text-[#1C1B19]/80 leading-relaxed">
              This document is a technical and operational draft representing the current functionality, limitations, and user agreements of the Resurox service. It is provided for transparency and must be reviewed, adapted, and validated by qualified legal counsel prior to formal corporate or commercial enforcement.
            </p>
          </div>
        </div>

        {/* Terms Sections */}
        <div className="space-y-10">

          {/* Section 1: Acceptance of Terms */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 1.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Acceptance of Terms
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              By accessing, browsing, uploading files to, or otherwise utilizing Resurox (the &ldquo;Service&rdquo;), you acknowledge that you have read, understood, and agree to be bound by these Terms and our accompanying{' '}
              <Link href="/privacy" className="text-[#7A1F1F] underline font-medium hover:text-[#1C1B19]">
                Privacy Policy
              </Link>
              . If you do not agree to all provisions of these Terms, you must immediately discontinue using the Service.
            </p>
          </section>

          {/* Section 2: Description of Service & AI Nature */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 2.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Description of Service & Educational Purpose
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              Resurox provides an automated candidate evaluation workbench that pairs deterministic rubric-based mathematical scoring with large language model (LLM) semantic extraction. The Service evaluates user-submitted resume files against user-submitted job descriptions to generate score breakdowns, evidence coverage assessments, and recruiter margin notes.
            </p>
            <div className="border border-[#1C1B19]/30 bg-white/40 p-4 space-y-2">
              <div className="font-mono text-xs font-bold uppercase text-[#7A1F1F]">
                Advisory Disclaimer: No Guarantee of Employment
              </div>
              <p className="font-serif text-xs sm:text-sm text-[#1C1B19]/80 leading-relaxed">
                The scores, verdicts, and suggestions produced by Resurox are purely educational and analytical assessments for informational purposes. Resurox does not make hiring decisions, does not guarantee job interviews, offers, or career outcomes, and cannot guarantee that any prospective employer or automated applicant tracking system (ATS) will reach the same conclusions.
              </p>
            </div>
          </section>

          {/* Section 3: Allowed & Prohibited Uses */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 3.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Permitted & Prohibited Use
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              You are granted a non-exclusive, revocable, personal license to use the Service for lawful resume evaluation and career preparation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="border border-[#1C1B19]/30 bg-white/40 p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#2F5233] mb-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2F5233]" />
                  <span>Permitted Uses</span>
                </div>
                <ul className="list-disc list-outside ml-4 space-y-1.5 font-serif text-xs text-[#1C1B19]/80">
                  <li>Evaluating your own personal resume and target job descriptions.</li>
                  <li>Reviewing match gaps and evidence coverage to improve resume clarity.</li>
                  <li>Supplying your own personal AI provider API credentials for inference.</li>
                </ul>
              </div>

              <div className="border border-[#1C1B19]/30 bg-white/40 p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#8B2E2E] mb-2">
                  <Ban className="w-4 h-4 text-[#8B2E2E]" />
                  <span>Prohibited Activities</span>
                </div>
                <ul className="list-disc list-outside ml-4 space-y-1.5 font-serif text-xs text-[#1C1B19]/80">
                  <li>Uploading files containing malware, malicious macros, or exploits.</li>
                  <li>Automated scraping, denial-of-service, or programmatic rate limit abuse.</li>
                  <li>Uploading third-party personal documents without lawful authorization.</li>
                  <li>Attempting to reverse-engineer, decompile, or compromise backend APIs.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4: Accounts, Registration & Sessions */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 4.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Accounts & Registration
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              Resurox does not require account creation, passwords, or profile registrations. Access is provided on an ephemeral, per-session basis. You are solely responsible for maintaining the confidentiality of any third-party API keys (such as OpenRouter, OpenAI, or Google Gemini keys) entered into your browser.
            </p>
          </section>

          {/* Section 5: User Content & Intellectual Property */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 5.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                User Content & Intellectual Property
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              <strong>Your Content Remains Yours:</strong> You retain complete ownership and all intellectual property rights to the resume documents, text, and job descriptions you submit to Resurox. You grant us only the limited, temporary license to process such content in volatile memory for the express purpose of generating your evaluation report.
            </p>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              <strong>Resurox Intellectual Property:</strong> The software, algorithms, scoring formulas, visual design, editorial markup components, typography layout, and trademarks of Resurox are the exclusive intellectual property of Resurox and its licensors.
            </p>
          </section>

          {/* Section 6: Fees, Payments & Refunds */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 6.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Payments, Subscriptions & Fees
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              Resurox is currently provided free of charge under a server-managed AI model. We do not process payments, bill subscriptions, or charge fees for core workbench analysis. Any usage costs incurred with external AI providers are billed directly by those respective service providers under your separate agreement with them.
            </p>
          </section>

          {/* Section 7: Disclaimers & Limitation of Liability */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 7.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Disclaimers & Limitation of Liability
              </h2>
            </div>
            <div className="border-2 border-[#1C1B19] bg-[#F7F5F0] p-6 shadow-[3px_3px_0px_#1C1B19] space-y-3 font-serif text-xs sm:text-sm text-[#1C1B19]/85 leading-relaxed">
              <p>
                <strong>&ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WARRANTY DISCLAIMER:</strong> THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT.
              </p>
              <p>
                <strong>LIMITATION OF LIABILITY:</strong> TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL Resurox, ITS MAINTAINERS, AFFILIATES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, EMPLOYMENT OPPORTUNITIES, OR BUSINESS REPUTATION, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
              </p>
              <p>
                TO THE EXTENT PERMITTED BY LAW, OUR TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE GREATER OF FIFTY US DOLLARS ($50.00 USD) OR THE AMOUNT YOU PAID TO US (WHICH IS $0.00).
              </p>
            </div>
          </section>

          {/* Section 8: Termination & Service Modifications */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 8.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Termination & Access Restriction
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              We reserve the right, without prior notice or liability, to suspend, terminate, or restrict access to the Service (including IP-based rate limiting or blocking) for any user who violates these Terms, submits abusive payloads, or endangers application availability.
            </p>
          </section>

          {/* Section 9: Governing Law & Jurisdiction */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 9.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Governing Law & Jurisdiction
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              These Terms and any disputes arising out of or relating to your use of Resurox shall be governed by and construed in accordance with the laws of <code className="font-mono text-xs bg-[#1C1B19]/10 px-1.5 py-0.5">[COUNTRY / STATE]</code>, without regard to its conflict of law principles. Any legal suit, action, or proceeding shall be instituted exclusively in the competent courts of <code className="font-mono text-xs bg-[#1C1B19]/10 px-1.5 py-0.5">[JURISDICTION / CITY]</code>.
            </p>
          </section>

          {/* Section 10: Changes to Terms */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 10.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Modifications to Terms
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              We may revise these Terms from time to time to reflect changes in our technology, regulatory requirements, or feature scope. Revised terms will become effective immediately upon posting to this URL with an updated &ldquo;Last Updated&rdquo; date stamp. Continued use of the Service after any modification constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* Section 11: Contact Information */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 11.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Contact & Legal Inquiries
              </h2>
            </div>
            <div className="border-2 border-[#1C1B19] bg-white/50 p-6 space-y-3">
              <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
                If you have questions regarding these Terms or wish to submit legal inquiries, please contact:
              </p>
              <div className="font-mono text-xs space-y-2 text-[#1C1B19]">
                <div><strong>Entity:</strong> Resurox</div>
                <div><strong>Location:</strong> Jharkhand, India</div>
                <div>
                  <strong>Legal Inquiries:</strong>{' '}
                  <a href="mailto:subrato213432@gmail.com" className="text-[#7A1F1F] underline hover:text-[#1C1B19]">
                    subrato213432@gmail.com
                  </a>
                </div>
                <div>
                  <strong>Contact Desk:</strong>{' '}
                  <Link href="/contact" className="text-[#7A1F1F] underline hover:text-[#1C1B19]">
                    /contact
                  </Link>
                </div>
                <div>
                  <strong>GitHub Repository:</strong>{' '}
                  <a
                    href="https://github.com/Srijal-io/Resurox"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#7A1F1F] underline hover:text-[#1C1B19]"
                  >
                    github.com/Srijal-io/Resurox
                  </a>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

