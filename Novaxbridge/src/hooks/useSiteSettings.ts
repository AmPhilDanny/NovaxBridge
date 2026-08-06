import { useSWR } from './useSWR';

export interface SiteConfig {
  brand: {
    site_name: string;
    tagline: string;
    logo_url: string;
    favicon_url: string;
  };
  hero: {
    badge: string;
    title: string;
    title_highlight: string;
    subtitle: string;
    hero_image_url: string;
    primary_cta_text: string;
    primary_cta_action: string;
    secondary_cta_text: string;
    secondary_cta_action: string;
  };
  nav: {
    links: { name: string; href: string }[];
  };
  footer: {
    description: string;
    columns: { title: string; links: { name: string; href: string }[] }[];
    newsletter_enabled: boolean;
    newsletter_placeholder: string;
    copyright_text: string;
  };
  social: {
    twitter: string;
    linkedin: string;
    github: string;
    facebook: string;
    instagram: string;
  };
  meta: {
    title: string;
    description: string;
    keywords: string;
    author: string;
    og_image_url: string;
    theme_color: string;
  };
  admin_panel_url: string;
  main_site_url: string;
  api_keys: Record<string, { api_key: string; enabled: boolean }>;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

const DEFAULT_CONFIG: SiteConfig = {
  brand: {
    site_name: 'SkillBridge Africa',
    tagline: 'Empowering the next generation of African tech talent',
    logo_url: '',
    favicon_url: '',
  },
  hero: {
    badge: 'Empowering Africa\'s Tech Future',
    title: 'Bridging the Gap to Your ',
    title_highlight: 'Tech Career',
    subtitle:
      'SkillBridge Africa provides the intensive training, industry-recognized skills, and mentorship you need to land your dream job in the global tech economy.',
    hero_image_url:
      'https://storage.googleapis.com/dala-prod-public-storage/generated-images/7906a63a-02a9-4967-a8cf-69c79663b9f3/tech-classroom-africa-9fb85669-1782681819989.webp',
    primary_cta_text: 'Browse Programs',
    primary_cta_action: '#programs',
    secondary_cta_text: 'Our Mission',
    secondary_cta_action: '#mission',
  },
  nav: {
    links: [
      { name: 'Marketplace', href: '/marketplace' },
      { name: 'Talent', href: '/talent' },
      { name: 'Projects', href: '/projects' },
      { name: 'Jobs', href: '/jobs' },
      { name: 'Academy', href: '/academy' },
      { name: 'Programs', href: '/#programs' },
    ],
  },
  footer: {
    description:
      'Empowering the next generation of African tech talent through intensive bridging programs and mentorship.',
    columns: [
      {
        title: 'Programs',
        links: [
          { name: 'Web Development', href: '#' },
          { name: 'Data Science', href: '#' },
          { name: 'UI/UX Design', href: '#' },
          { name: 'Cloud Computing', href: '#' },
        ],
      },
      {
        title: 'Community',
        links: [
          { name: 'Mentorship', href: '#' },
          { name: 'Events', href: '#' },
          { name: 'Success Stories', href: '#' },
          { name: 'Partner With Us', href: '#' },
        ],
      },
    ],
    newsletter_enabled: true,
    newsletter_placeholder: 'Email address',
    copyright_text: '\u00A9 {year} SkillBridge Africa. All rights reserved.',
  },
  social: {
    twitter: '#',
    linkedin: '#',
    github: '#',
    facebook: '#',
    instagram: '#',
  },
  meta: {
    title: 'Fhinovax Novax',
    description: 'Fhinovax Novax Generated Project',
    keywords: 'Fhinovax Novax, AI, web development, generated project, React, Vite, Nextjs',
    author: 'Fhinovax Novax',
    og_image_url: '/fhinovax.webp',
    theme_color: '#ffffff',
  },
  admin_panel_url: 'http://localhost:4000/',
  main_site_url: 'http://localhost:3000',
  api_keys: {},
};

function mergeDeep(target: SiteConfig, source: Partial<SiteConfig>): SiteConfig {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof SiteConfig)[]) {
    const val = source[key];
    if (val !== undefined && typeof val === 'object' && !Array.isArray(val)) {
      (result as Record<string, unknown>)[key] = { ...(target[key] as Record<string, unknown>), ...val };
    } else if (val !== undefined) {
      (result as Record<string, unknown>)[key] = val;
    }
  }
  return result;
}

export function useSiteSettings() {
  const { data, isValidating } = useSWR({
    key: 'site-config',
    fetcher: async () => {
      const res = await fetch(`${API_BASE}/site-config`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.data) throw new Error('Empty config');
      return mergeDeep(structuredClone(DEFAULT_CONFIG), json.data as Partial<SiteConfig>);
    },
    initialData: DEFAULT_CONFIG,
    onError: () => { /* keep defaults silently */ },
  });

  return { config: data, isValidating };
}
