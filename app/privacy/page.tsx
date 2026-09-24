import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/src/components/layout/SiteHeader';
import { SiteFooter } from '@/src/components/layout/SiteFooter';
import { ArrowLeft, FileText, Database, Key, ExternalLink, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: "Privacy Policy — Resurox",
  description: "Learn how Resurox handles resume uploads, in-memory processing, BYO AI providers, and local browser storage.",
};

export default function PrivacyPage() {
  const lastUpdated = "September 19, 2026";

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1B19] font-serif selection:bg-[#7A1F1F] selection:text-white flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#1C1B19]/70 hover:text-[#7A1F1F] transition-colors no-underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </Link>
        </div>

        {/* Page Header Header */}
        <header className="border-b-2 border-[#1C1B19] pb-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#7A1F1F]">
              [ COMPLIANCE & DATA GOVERNANCE ]
            </span>
            <span className="font-mono text-xs text-[#1C1B19]/60">
              Last Updated: {lastUpdated}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-extrabold text-[#1C1B19] tracking-tight leading-tight mb-3">
            Privacy Policy
          </h1>

          <p className="font-serif italic text-base sm:text-lg text-[#1C1B19]/75 leading-relaxed">
            Transparent disclosure of how Resurox (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) processes resume documents, manages AI provider interactions, and safeguards user data.
          </p>
        </header>

        {/* Legal Disclaimer Box */}
        <div className="mb-10 p-5 border-2 border-[#7A1F1F] bg-[#7A1F1F]/5 shadow-[3px_3px_0px_#7A1F1F] flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-[#7A1F1F] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#7A1F1F]">
              Legal Review Notice (Draft Document)
            </h2>
            <p className="font-serif text-xs text-[#1C1B19]/80 leading-relaxed">
              This document is a technical draft outlining the actual operational data flows and architecture of the Resurox application. It is provided for informational transparency and must undergo formal legal review and customization by qualified legal counsel prior to formal corporate adoption.
            </p>
          </div>
        </div>

        {/* Policy Content Sections */}
        <div className="space-y-10">
          
          {/* Section 1: Overview & Core Philosophy */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 1.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Core Philosophy: Ephemeral & In-Memory
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              Resurox is architected as an on-demand, session-based manuscript evaluation engine. We believe your career documentation and resume contents belong exclusively to you. The application operates without user registration, accounts, or persistent cloud databases for document storage.
            </p>
          </section>

          {/* Section 2: Data We Collect */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 2.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Information We Collect & Process
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              We collect and process only the minimum information necessary to execute the resume markup, evidence audit, and score calculation requested by you:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="border border-[#1C1B19]/30 bg-white/40 p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#1C1B19] mb-2">
                  <FileText className="w-4 h-4 text-[#7A1F1F]" />
                  <span>Resume & Document Data</span>
                </div>
                <p className="font-serif text-xs text-[#1C1B19]/75 leading-relaxed">
                  Uploaded PDF and DOCX files (maximum 5MB) containing contact information, education, employment history, technical skills, and portfolio links.
                </p>
              </div>

              <div className="border border-[#1C1B19]/30 bg-white/40 p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#1C1B19] mb-2">
                  <Database className="w-4 h-4 text-[#7A1F1F]" />
                  <span>Target Job Descriptions</span>
                </div>
                <p className="font-serif text-xs text-[#1C1B19]/75 leading-relaxed">
                  Job posting text and requirement criteria pasted directly into the analysis workbench to compute alignment and evidence scores.
                </p>
              </div>

              <div className="border border-[#1C1B19]/30 bg-white/40 p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#1C1B19] mb-2">
                  <Key className="w-4 h-4 text-[#7A1F1F]" />
                  <span>AI Provider Configuration</span>
                </div>
                <p className="font-serif text-xs text-[#1C1B19]/75 leading-relaxed">
                  Your selected AI service provider (OpenRouter, Google Gemini, OpenAI), optional personal API keys, and preferred model identifiers stored locally in your browser.
                </p>
              </div>

              <div className="border border-[#1C1B19]/30 bg-white/40 p-4">
                <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#1C1B19] mb-2">
                  <ExternalLink className="w-4 h-4 text-[#7A1F1F]" />
                  <span>Public Profile Evidence</span>
                </div>
                <p className="font-serif text-xs text-[#1C1B19]/75 leading-relaxed">
                  If a public GitHub profile link is present on your resume, the server fetches public repository summaries (repo names, languages, and star counts) via the public GitHub API.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Why We Collect It */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 3.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Why We Process Your Data (Purpose)
              </h2>
            </div>
            <ul className="list-disc list-outside ml-6 space-y-2 font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              <li><strong>Extract & Structure Content:</strong> Converting raw document text into structured profiles (education, skills, work history).</li>
              <li><strong>Deterministic Fit Scoring:</strong> Evaluating claimed competencies against stated job requirements using objective, rule-based mathematical scoring algorithms.</li>
              <li><strong>Actionable Feedback:</strong> Generating candidate-specific recruiter margin notes, strength highlights, and concrete improvement suggestions.</li>
              <li><strong>Verification:</strong> Corroborating listed technical skills against public open-source project history where provided.</li>
            </ul>
          </section>

          {/* Section 4: Data Retention & Storage */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 4.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Data Retention & How Long It Is Kept
              </h2>
            </div>
            <div className="border-2 border-[#1C1B19] bg-[#F7F5F0] p-6 shadow-[3px_3px_0px_#1C1B19] space-y-3">
              <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
                <strong>Zero Persistent Document Storage:</strong> Uploaded resume files and job descriptions are held strictly in temporary server memory during active analysis (typically 5–30 seconds) and are not written to persistent disk databases, vector stores, or S3 cloud storage buckets.
              </p>
              <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
                <strong>Client-Side Session State:</strong> Generated evaluation results reside exclusively in your active web browser session. Closing or refreshing your browser tab clears the in-memory results.
              </p>
              <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
                <strong>Local Browser Storage:</strong> Any custom AI provider settings and API keys you save remain strictly within your browser&apos;s <code className="font-mono text-xs bg-[#1C1B19]/10 px-1.5 py-0.5">localStorage</code> until you manually overwrite them or clear your browser cache.
              </p>
            </div>
          </section>

          {/* Section 5: Third-Party Services & Subprocessors */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 5.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Third-Party Services & Subprocessors
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              To provide semantic parsing and natural language explanations, Resurox interfaces with the following third-party APIs during the active analysis request:
            </p>

            <div className="overflow-x-auto border border-[#1C1B19]/30 mt-3">
              <table className="w-full text-left font-serif text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1C1B19]/10 border-b border-[#1C1B19]/30 font-mono text-[11px] font-bold uppercase tracking-wider text-[#1C1B19]">
                    <th className="p-3">Third Party / Service</th>
                    <th className="p-3">Data Shared</th>
                    <th className="p-3">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C1B19]/15 bg-white/30">
                  <tr>
                    <td className="p-3 font-semibold">Third-Party AI Service Providers</td>
                    <td className="p-3">Extracted resume text, job requirements, prompt templates</td>
                    <td className="p-3">Text parsing, semantic classification, and explanation synthesis (e.g. Groq Cloud).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">GitHub REST API</td>
                    <td className="p-3">Public candidate GitHub username (if present in resume)</td>
                    <td className="p-3">Retrieving public repo metadata (no private repo data accessed).</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-serif italic text-xs text-[#1C1B19]/60">
              Note: Third-party AI provider API usage is subject to the respective terms and privacy policies of the configured server-side provider.
            </p>
          </section>

          {/* Section 6: Cookies & Tracking Technologies */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 6.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Cookies & Tracking Technologies
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              <strong>No Tracking Cookies:</strong> Resurox does not set marketing cookies, third-party advertising beacons, cross-site trackers, or commercial tracking scripts.
            </p>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              <strong>Local Storage:</strong> We use standard browser <code className="font-mono text-xs bg-[#1C1B19]/10 px-1.5 py-0.5">localStorage</code> strictly for functional client-side preferences (such as remembering your chosen AI provider, model preference, and API key).
            </p>
          </section>

          {/* Section 7: User Rights (Access & Deletion) */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 7.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Your Rights & Data Control
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              Under applicable data protection laws (including GDPR and CCPA/CPRA where applicable), users have rights regarding access, deletion, and control of their personal data:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2 font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              <li><strong>Right to Deletion:</strong> Because uploaded resumes are not retained in a database, no server-side records persist after your request finishes.</li>
              <li><strong>Right to Clear Client Data:</strong> You can purge all saved keys and preferences at any time by clearing your browser&apos;s site data/cache or updating settings in the workspace.</li>
              <li><strong>No Commercial Sale of Data:</strong> We do not sell, rent, monetize, or trade candidate personal information or resume contents to data brokers or recruitment aggregators.</li>
            </ul>
          </section>

          {/* Section 8: Children's Privacy */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 8.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Children&apos;s Privacy
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              Resurox is a career and resume evaluation service designed for working professionals, job seekers, and adult students. We do not knowingly collect, solicit, or maintain personal information from children under the age of 16 (or under 13 where mandated by local law). If you believe a minor has submitted personal information, please contact us immediately for assistance.
            </p>
          </section>

          {/* Section 9: Security Measures */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 9.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Security Safeguards
              </h2>
            </div>
            <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
              We employ standard transport encryption (HTTPS/TLS) for all data in transit between your browser, our application endpoints, and third-party AI APIs. File uploads are validated for MIME type, extension, and size limits (5MB) before processing.
            </p>
          </section>

          {/* Section 10: Contact Information */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1C1B19]/20 pb-2">
              <span className="font-mono text-xs font-bold text-[#7A1F1F]">§ 10.0</span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B19]">
                Contact & Inquiries
              </h2>
            </div>
            <div className="border-2 border-[#1C1B19] bg-white/50 p-6 space-y-3">
              <p className="font-serif text-sm sm:text-base text-[#1C1B19]/85 leading-relaxed">
                If you have questions, feedback, or concerns regarding this Privacy Policy or our operational data handling practices, please contact us at:
              </p>
              <div className="font-mono text-xs space-y-2 text-[#1C1B19]">
                <div><strong>Entity:</strong> Resurox</div>
                <div><strong>Location:</strong> Jharkhand, India</div>
                <div>
                  <strong>Privacy Contact:</strong>{' '}
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

