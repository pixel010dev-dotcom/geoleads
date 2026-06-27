import type { MetadataRoute } from 'next';
import { getAllCitySlugs, getAllNicheSlugs, getAllComboSlugs } from '@/lib/cities-data';

const BLOG_SLUGS = [
  'como-extrair-leads-google-maps',
  'prospeccao-b2b-whatsapp',
  'crm-para-pequenas-empresas',
  'marketing-digital-para-corretores',
  'enriquecimento-de-leads',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://geoleads-production.up.railway.app';

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.4 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.4 },
  ];

  const cityPages = getAllCitySlugs().map(slug => ({
    url: `${baseUrl}/cidade/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const nichePages = getAllNicheSlugs().map(slug => ({
    url: `${baseUrl}/nicho/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const comboPages = getAllComboSlugs().map(({ nicho, cidade }) => ({
    url: `${baseUrl}/nicho/${nicho}/${cidade}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const blogPages = BLOG_SLUGS.map(slug => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...cityPages, ...nichePages, ...comboPages, ...blogPages];
}
