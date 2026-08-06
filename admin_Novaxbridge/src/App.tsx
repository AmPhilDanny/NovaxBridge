import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import AdminDashboard from '@/pages/AdminDashboard';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

function setMeta(name: string, content?: string) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`) as HTMLElement | null;
  if (!el) {
    el = document.createElement('meta');
    if (name.startsWith('og:') || name.startsWith('twitter:')) {
      el.setAttribute('property', name);
    } else {
      el.setAttribute('name', name);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function MetaUpdater() {
  const { config } = useSiteSettings();
  useEffect(() => {
    const m = config.meta;
    if (!m?.title) return;
    document.title = m.title;
    setMeta('description', m.description);
    setMeta('keywords', m.keywords);
    setMeta('author', m.author);
    setMeta('theme-color', m.theme_color);
    setMeta('og:title', m.title);
    setMeta('og:description', m.description);
    setMeta('og:image', m.og_image_url);
    setMeta('twitter:title', m.title);
    setMeta('twitter:description', m.description);
    setMeta('twitter:image', m.og_image_url);
  }, [config]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <MetaUpdater />
          <Navbar />
          <main className="flex-grow pt-24">
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  );
}
