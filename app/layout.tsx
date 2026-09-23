import type { Metadata, Viewport } from "next";
import { Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import { JsonLd } from "@/components/JsonLd";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "600", "700"],
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resurox.app';

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Resurox — AI Resume Analyzer & ATS Job Description Matcher",
    template: "%s | Resurox",
  },
  description: "Evidence-backed resume analysis tool with deterministic scoring, requirement matrix matching, and factual ATS candidate feedback.",
  keywords: [
    "resume analyzer",
    "ATS resume checker",
    "resume vs job description match",
    "resume feedback tool",
    "Resurox",
    "AI candidate evaluation",
    "deterministic resume scoring",
  ],
  authors: [{ name: "Resurox Team", url: baseUrl }],
  creator: "Resurox",
  publisher: "Resurox",
  alternates: {
    canonical: baseUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', sizes: 'any', type: 'image/png' },
      { url: '/branding/resurox-mark.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "Resurox",
    title: "Resurox — AI Resume & Job Fit Analyzer",
    description: "EDIT • ANALYZE • ADVANCE — Objective, evidence-backed candidate evaluation and ATS job match.",
    images: [{ url: '/branding/resurox-logo.png', width: 1024, height: 1024, alt: 'Resurox Logo' }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Resurox — AI Resume & Job Fit Analyzer",
    description: "Evidence-backed manuscript resume analysis with deterministic scoring and requirement matching.",
    images: ['/branding/resurox-logo.png'],
  },
};

import { CookieConsent } from "@/components/CookieConsent";
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <JsonLd />
      </head>
      <body className="min-h-full flex flex-col bg-[#F7F5F0] text-[#1C1B19] font-serif">
        {children}
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
