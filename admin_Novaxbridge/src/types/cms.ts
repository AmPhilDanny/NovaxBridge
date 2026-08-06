export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content_html: string;
  status: 'draft' | 'published';
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface CmsPageInput {
  slug: string;
  title: string;
  content_html?: string;
  status?: 'draft' | 'published';
}
