import { Link } from 'react-router-dom';
import { Rocket, Twitter, Linkedin, Github, Mail, Facebook, Instagram } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter size={20} />,
  linkedin: <Linkedin size={20} />,
  github: <Github size={20} />,
  facebook: <Facebook size={20} />,
  instagram: <Instagram size={20} />,
};

const DEFAULT_COLUMNS = [
  {
    title: 'Company',
    links: [
      { name: 'About', href: '/pages/about' },
      { name: 'FAQ', href: '/pages/faq' },
      { name: 'Contact', href: '/pages/contact' },
      { name: 'Terms', href: '/pages/terms' },
      { name: 'Privacy', href: '/pages/privacy' },
    ],
  },
];

export function Footer() {
  const { config } = useSiteSettings();
  const { brand, footer: ft, social } = config;

  const copyright = ft.copyright_text.replace('{year}', String(new Date().getFullYear()));
  const columns = ft.columns.length > 0 ? ft.columns : DEFAULT_COLUMNS;

  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.site_name} className="w-6 h-6 object-contain" />
              ) : (
                <Rocket className="w-6 h-6 text-secondary" />
              )}
              <span className="text-xl font-bold tracking-tight">
                {brand.site_name || 'Novaxbridge'}
              </span>
            </div>
            <p className="text-sm text-primary-foreground/70 mb-6">
              {ft.description || 'Empowering the next generation of African tech talent.'}
            </p>
            <div className="flex gap-4">
              {Object.entries(SOCIAL_ICONS).map(([platform, icon]) => {
                const url = social[platform as keyof typeof social];
                if (!url || url === '#') return null;
                return (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">
                    {icon}
                  </a>
                );
              })}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-bold mb-4">{col.title}</h3>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                {col.links.map((link) => (
                  <li key={link.name}>
                    {link.href.startsWith('/pages/') ? (
                      <Link to={link.href} className="hover:text-secondary transition-colors">{link.name}</Link>
                    ) : (
                      <a href={link.href} className="hover:text-secondary transition-colors">{link.name}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="font-bold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><Link to="/pages/about" className="hover:text-secondary transition-colors">About</Link></li>
              <li><Link to="/pages/faq" className="hover:text-secondary transition-colors">FAQ</Link></li>
              <li><Link to="/pages/contact" className="hover:text-secondary transition-colors">Contact</Link></li>
              <li><Link to="/pages/terms" className="hover:text-secondary transition-colors">Terms</Link></li>
              <li><Link to="/pages/privacy" className="hover:text-secondary transition-colors">Privacy</Link></li>
            </ul>
          </div>

          {ft.newsletter_enabled && (
            <div>
              <h3 className="font-bold mb-4">Newsletter</h3>
              <p className="text-sm text-primary-foreground/70 mb-4">Stay updated with our latest news and program launches.</p>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder={ft.newsletter_placeholder || 'Email address'} 
                  className="bg-primary-foreground/10 border-none rounded-md px-3 py-2 text-sm w-full focus:ring-1 focus:ring-secondary"
                />
                <button className="bg-secondary text-secondary-foreground p-2 rounded-md hover:bg-secondary/90 transition-colors">
                  <Mail size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10 text-center text-xs text-primary-foreground/50">
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
