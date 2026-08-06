import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export function Testimonials() {
  const testimonials = [
    {
      name: "Amara Okeke",
      role: "Software Engineer at Google",
      content: "SkillBridge Africa was the turning point in my career. The curriculum was tough but exactly what I needed to pass my interviews at top tech firms.",
      image: "https://storage.googleapis.com/dala-prod-public-storage/generated-images/7906a63a-02a9-4967-a8cf-69c79663b9f3/testimonial-woman-7c8ca9ca-1782681820813.webp"
    },
    {
      name: "David Mensah",
      role: "Data Analyst at Flutterwave",
      content: "The mentorship I received was invaluable. My mentor helped me build a portfolio that actually got noticed by hiring managers in Lagos.",
      image: "https://storage.googleapis.com/dala-prod-public-storage/generated-images/7906a63a-02a9-4967-a8cf-69c79663b9f3/testimonial-man-eab5aa17-1782681819854.webp"
    }
  ];

  return (
    <section id="testimonials" className="py-24 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">Success Stories</h2>
          <p className="text-lg text-muted-foreground">
            Hear from our graduates who have successfully bridged the gap and are now thriving in the tech ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {testimonials.map((t, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative bg-background p-10 rounded-3xl border border-border flex flex-col md:flex-row gap-8 items-center md:items-start"
            >
              <div className="shrink-0 relative">
                <Quote className="absolute -top-4 -left-4 w-8 h-8 text-secondary/20" />
                <img 
                  src={t.image} 
                  alt={t.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-secondary/20"
                />
              </div>
              <div>
                <p className="text-lg italic text-muted-foreground mb-6 leading-relaxed">
                  "{t.content}"
                </p>
                <div>
                  <h4 className="font-bold text-primary">{t.name}</h4>
                  <p className="text-sm text-secondary font-medium">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
