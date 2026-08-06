import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Palette, Globe, Image, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getBranding, updateBranding, type OrgBranding } from '../../lib/api';

export default function BrandingSettings() {
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [secondaryColor, setSecondaryColor] = useState('#6b7280');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [customCss, setCustomCss] = useState('');
  const [customDomain, setCustomDomain] = useState('');

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getBranding();
      const b = res.data;
      setBranding(b);
      if (b) {
        setLogoUrl(b.logo_url || '');
        setFaviconUrl(b.favicon_url || '');
        setPrimaryColor(b.primary_color || '#7c3aed');
        setSecondaryColor(b.secondary_color || '#6b7280');
        setAccentColor(b.accent_color || '#f59e0b');
        setFontFamily(b.font_family || 'Inter');
        setCustomCss(b.custom_css || '');
        setCustomDomain(b.custom_domain || '');
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateBranding({
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        font_family: fontFamily,
        custom_css: customCss || null,
        custom_domain: customDomain || null,
      });
      setBranding(result.data);
      toast.success('Branding saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">White-Label Branding</h2>
          <p className="text-sm text-gray-500">Customize your organization's look and feel</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand" className="flex items-center gap-1"><Palette className="w-3 h-3" /> Brand</TabsTrigger>
          <TabsTrigger value="domain" className="flex items-center gap-1"><Globe className="w-3 h-3" /> Domain</TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-1"><Image className="w-3 h-3" /> Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Colors</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                    <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} placeholder="#7c3aed" />
                  </div>
                </div>
                <div>
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                    <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} placeholder="#6b7280" />
                  </div>
                </div>
                <div>
                  <Label>Accent Color</Label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                    <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} placeholder="#f59e0b" />
                  </div>
                </div>
                <div>
                  <Label>Font Family</Label>
                  <Input value={fontFamily} onChange={e => setFontFamily(e.target.value)} placeholder="Inter" className="mt-1" />
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden" style={{ fontFamily }}>
                  <div className="p-4 text-white text-center" style={{ backgroundColor: primaryColor }}>
                    <p className="font-semibold">Primary Header</p>
                  </div>
                  <div className="p-4" style={{ backgroundColor: '#f9fafb' }}>
                    <div className="flex gap-2 mb-3">
                      <span className="px-3 py-1 rounded text-xs text-white" style={{ backgroundColor: primaryColor }}>Primary</span>
                      <span className="px-3 py-1 rounded text-xs text-white" style={{ backgroundColor: secondaryColor }}>Secondary</span>
                      <span className="px-3 py-1 rounded text-xs text-white" style={{ backgroundColor: accentColor }}>Accent</span>
                    </div>
                    <p className="text-sm text-gray-600">Sample body text in {fontFamily}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="domain" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Custom Domain</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Custom Domain URL</Label>
                <Input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="https://jobs.yourcompany.com" className="mt-1" />
                <p className="text-xs text-gray-400 mt-1">Point your domain's CNAME to your SkillBridge subdomain</p>
              </div>
              {branding?.logo_url && (
                <div className="p-3 rounded bg-gray-50 text-xs text-gray-500">
                  <p className="font-medium text-gray-700 mb-1">DNS Setup</p>
                  <code className="block">CNAME @ your-org.skillbridge.africa</code>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Logos & Assets</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Logo URL</Label>
                <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label>Favicon URL</Label>
                <Input value={faviconUrl} onChange={e => setFaviconUrl(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
              {logoUrl && (
                <div className="mt-2 p-3 rounded border bg-gray-50 inline-block">
                  <img src={logoUrl} alt="Logo preview" className="max-h-12" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Custom CSS</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={customCss} onChange={e => setCustomCss(e.target.value)} rows={6} className="font-mono text-xs" placeholder="/* Custom styles */" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
