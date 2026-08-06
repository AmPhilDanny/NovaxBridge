import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubscriptionManager from '../billing/SubscriptionManager';
import BrandingSettings from '../branding/BrandingSettings';

export default function SettingsPage() {
  return (
    <Tabs defaultValue="subscription">
      <TabsList>
        <TabsTrigger value="subscription">Subscription</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
      </TabsList>
      <TabsContent value="subscription" className="mt-4">
        <SubscriptionManager />
      </TabsContent>
      <TabsContent value="branding" className="mt-4">
        <BrandingSettings />
      </TabsContent>
    </Tabs>
  );
}
