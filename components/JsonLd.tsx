import React from 'react';

export function JsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-resume-analyzer-six-jet.vercel.app';

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Resurox',
    url: baseUrl,
    logo: `${baseUrl}/branding/resurox-logo.png`,
    description: 'Evidence-backed candidate evaluation and deterministic resume-vs-job-description scoring.',
  };

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Resurox',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Resurox',
    operatingSystem: 'All',
    applicationCategory: 'BusinessApplication',
    description: 'Evidence-backed resume analysis with deterministic scoring, requirement matching, and factual feedback.',
    url: baseUrl,
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      'Evidence-backed resume scoring',
      'ATS requirements matrix matching',
      'Multi-dimensional candidate evaluation',
      'Privacy-first document processing',
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
    </>
  );
}
