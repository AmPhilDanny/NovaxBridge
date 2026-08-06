import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSiteSettings } from '@/hooks/useSiteSettings';

function scrollTo(id: string) {
  const el = document.getElementById(id.replace('#', ''));
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

export function Hero() {
  const { config } = useSiteSettings();
  const { hero } = config;

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-background">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20 text-xs font-bold mb-6">
              <Sparkles className="w-3 h-3" />
              {hero.badge || "Empowering Africa's Tech Future"}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-primary leading-[1.1] mb-6">
              {hero.title || 'Bridging the Gap to Your '}<span className="text-secondary">{hero.title_highlight || 'Tech Career'}</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
              {hero.subtitle || 'SkillBridge Africa provides the intensive training, industry-recognized skills, and mentorship you need to land your dream job in the global tech economy.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="text-base px-8 h-14"
                onClick={() => scrollTo(hero.primary_cta_action || '#programs')}
              >
                {hero.primary_cta_text || 'Browse Programs'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-base px-8 h-14"
                onClick={() => scrollTo(hero.secondary_cta_action || '#mission')}
              >
                {hero.secondary_cta_text || 'Our Mission'}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50">
              <img 
                src={hero.hero_image_url || 'https://storage.googleapis.com/dala-prod-public-storage/generated-images/7906a63a-02a9-4967-a8cf-69c79663b9f3/tech-classroom-africa-9fb85669-1782681819989.webp'}
                alt="Hero"
                className="w-full aspect-video object-cover"
              />
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-secondary/20 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-accent/20 rounded-full blur-3xl animate-pulse" />
            
            <div className="absolute -bottom-4 right-4 bg-background p-4 rounded-xl shadow-lg border border-border flex items-center gap-3 z-20">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-muted border-2 border-background" />
                ))}
              </div>
              <p className="text-xs font-medium">Joined by 1000+ graduates</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
