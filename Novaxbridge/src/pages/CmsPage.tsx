import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { ArrowLeft, Loader2, Clock, Calendar, FileText } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

interface PageData {
  slug: string;
  title: string;
  content_html: string;
  created_at: string;
  updated_at: string;
}

export default function CmsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) {
      setError('No page slug specified');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPage() {
      try {
        const res = await fetch(`${API_BASE}/pages/${encodeURIComponent(slug!)}`);
        if (res.status === 404) {
          if (!cancelled) setError('Page not found');
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled && json?.data) {
          setPage(json.data);
        }
      } catch {
        if (!cancelled) setError('Failed to load page');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPage();
    return () => { cancelled = true; };
  }, [slug]);

  // Scroll to heading if URL has hash
  useEffect(() => {
    if (page && window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [page]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          <p className="text-sm text-muted-foreground">Loading page...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <FileText className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-2">Page Not Found</h1>
          <p className="text-muted-foreground max-w-md">
            The page you're looking for doesn't exist or hasn't been published yet.
          </p>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-secondary hover:text-secondary/80 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    );
  }

  const sanitizedHtml = DOMPurify.sanitize(page.content_html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'pre', 'code',
      'span', 'div', 'hr', 'sub', 'sup',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style', 'width', 'height', 'id'],
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-background to-muted/20">
      {/* Breadcrumb bar */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-secondary transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
          <span className="text-xs text-muted-foreground/60 capitalize">{page.slug.replace(/-/g, ' ')}</span>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <article className="bg-card rounded-xl border shadow-sm p-8 md:p-12">
          {/* Header */}
          <header className="mb-10 pb-8 border-b">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary leading-tight mb-4">
              {page.title}
            </h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Published {formatDate(page.created_at)}
              </span>
              {page.updated_at !== page.created_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Updated {formatDate(page.updated_at)}
                </span>
              )}
            </div>
          </header>

          {/* Rendered content */}
          <div
            ref={contentRef}
            className="cms-content prose prose-lg max-w-none
              prose-headings:text-primary prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-2
              prose-p:text-foreground/80 prose-p:leading-relaxed prose-p:mb-4
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:my-4 prose-ul:space-y-2
              prose-li:text-foreground/80 prose-li:marker:text-secondary
              prose-a:text-secondary prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-secondary prose-blockquote:bg-muted/30 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
              prose-code:text-sm prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-4
              prose-img:rounded-lg prose-img:shadow-md"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        </article>
      </div>
    </div>
  );
}

