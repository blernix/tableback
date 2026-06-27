import { z } from 'zod';

const RESERVED_SLUGS = [
  'dashboard', 'login', 'signup', 'admin', 'embed', 'api',
  'cgv', 'cookies', 'legal', 'privacy',
  'favicon.ico', 'manifest.json', 'robots.txt', 'sitemap.xml',
  '_next', '_vercel', 'public', 'static',
];

export const updateRestaurantSlugSchema = z.object({
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .refine((s) => !RESERVED_SLUGS.includes(s), 'This slug is reserved')
    .refine(
      (s) => !s.startsWith('dashboard-') && !s.startsWith('admin-') && !s.startsWith('api-'),
      'This slug prefix is reserved'
    ),
});

export const checkSlugAvailabilityParam = z.object({
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]{3,50}$/, 'Invalid slug format'),
});
