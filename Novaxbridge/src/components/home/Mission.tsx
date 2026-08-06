import { motion } from 'framer-motion';
import { Target, Users, Globe } from 'lucide-react';

export function Mission() {
  const values = [
    {
      icon: <Target className="w-6 h-6 text-secondary" />,
      title: "Skills-First Learning",
      description: "We focus on the exact technical skills global employers are looking for right now."
    },
    {
      icon: <Users className="w-6 h-6 text-secondary" />,
      title: "Vibrant Community",
      description: "Join a network of ambitious African techies, mentors, and industry experts."
    },
    {
      icon: <Globe className="w-6 h-6 text-secondary" />,
      title: "Global Opportunities",
      description: "We bridge the gap between African talent and the international tech marketplace."
    }
  ];

  return (
    <section id="mission" className="py-24 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">Our Mission</h2>
          <p className="text-lg text-muted-foreground">
            We believe that talent is universal, but opportunity is not. SkillBridge Africa exists to equalize that equation by providing world-class tech education tailored for the African context.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 }}
              viewport={{ once: true }}
              className="bg-background p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-6">
                {value.icon}
              </div>
              <h3 className="text-xl font-bold mb-4">{value.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {value.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 relative rounded-3xl overflow-hidden h-[400px]">
          <img 
            src="https://storage.googleapis.com/dala-prod-public-storage/generated-images/7906a63a-02a9-4967-a8cf-69c79663b9f3/connectivity-africa-tech-c0f24b73-1782681820051.webp" 
            alt="Connectivity in Africa"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-primary/60 flex items-center justify-center p-8 text-center">
            <div className="max-w-2xl">
              <h3 className="text-3xl font-bold text-white mb-6">Bridging Dreams to Reality</h3>
              <p className="text-white/90 text-lg">
                Since our inception, we have helped hundreds of students transition from non-tech backgrounds into high-paying software roles at top global companies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
