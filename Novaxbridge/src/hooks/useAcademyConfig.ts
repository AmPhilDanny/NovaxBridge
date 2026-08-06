import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AcademyConfig {
  tutor_applications_enabled: boolean;
  academy_enabled: boolean;
  auto_approve_tutors: boolean;
  min_course_price: number;
  platform_fee_percent: number;
}

const DEFAULT_CONFIG: AcademyConfig = {
  tutor_applications_enabled: true,
  academy_enabled: true,
  auto_approve_tutors: false,
  min_course_price: 0,
  platform_fee_percent: 5,
};

const CACHE_KEY = 'academy_config';
let cachedConfig: AcademyConfig | null = null;

export function useAcademyConfig() {
  const [config, setConfig] = useState<AcademyConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cachedConfig) {
        if (!cancelled) {
          setConfig(cachedConfig);
          setLoading(false);
        }
        return;
      }

      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'academy_config')
          .maybeSingle();

        if (cancelled) return;

        if (data?.value && typeof data.value === 'object') {
          const merged = { ...DEFAULT_CONFIG, ...(data.value as Partial<AcademyConfig>) };
          cachedConfig = merged;
          setConfig(merged);
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { config, loading };
}
