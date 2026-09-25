import React from 'react';
import Link from 'next/link';
import { Logo } from '../ui/Logo';
import { VersionBadge } from '../ui/VersionBadge';
import { Button } from '../ui/Button';
import { APP_URL } from '../../config';

export function SiteHeader({ className = '' }) {
  return (
    <header className={`border-b border-[#1C1B19]/20 bg-[#F7F5F0] sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left Branding: Logo + Wordmark + Version Badge */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link href="/" className="flex items-center gap-2 text-inherit no-underline">
            <Logo size={52} showWordmark={true} priority={true} />
          </Link>
          <VersionBadge />
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center space-x-8 font-mono text-xs font-bold uppercase tracking-wider text-[#1C1B19]/70">
          <Link href="/#how-it-works" className="hover:text-[#7A1F1F] transition-colors">
            How It Works
          </Link>
          <Link href="/#report-showcase" className="hover:text-[#7A1F1F] transition-colors">
            The Report
          </Link>
          <Link href="/#evidence-compare" className="hover:text-[#7A1F1F] transition-colors">
            Evidence
          </Link>
          <Link href="/privacy" className="hover:text-[#7A1F1F] transition-colors">
            Privacy
          </Link>
          <Link href="/contact" className="hover:text-[#7A1F1F] transition-colors">
            Contact
          </Link>
          <Link href="/#faq" className="hover:text-[#7A1F1F] transition-colors">
            FAQ
          </Link>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-3">
          <a
            href="https://github.com/Srijal-io/Resurox"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#1C1B19] border border-[#1C1B19]/30 hover:border-[#1C1B19] hover:bg-[#1C1B19]/5 px-3.5 py-2 transition-colors no-underline"
          >
            <svg className="w-3.5 h-3.5 fill-current text-[#7A1F1F]" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <span>Star on GitHub</span>
          </a>
          <Button variant="outline" href={APP_URL} className="px-4 py-2">
            TRY NOW
          </Button>
        </div>
      </div>
    </header>
  );
}
