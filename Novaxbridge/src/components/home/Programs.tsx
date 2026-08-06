import { motion } from 'framer-motion';
import { Code, Database, Layout, Cloud, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Programs() {
  const programs = [
    {
      title: "Full-Stack Web Development",
      description: "Master React, Node.js, and modern web architecture to build scalable applications.",
      icon: <Code className="w-6 h-6" />,
      duration: "24 Weeks",
      level: "Intermediate",
      color: "blue"
    },
    {
      title: "Data Science & AI",
      description: "Learn Python, machine learning, and data visualization to solve complex problems.",
      icon: <Database className="w-6 h-6" />,
      duration: "20 Weeks",
      level: "Beginner Friendly",
      color: "orange"
    },
    {
      title: "UI/UX Product Design",
      description: "Design intuitive digital experiences using Figma, user research, and prototyping.",
      icon: <Layout className="w-6 h-6" />,
      duration: "12 Weeks",
      level: "All Levels",
      color: "pink"
    },
    {
      title: "Cloud Infrastructure",
      description: "Deploy and manage applications on AWS, Azure, and Google Cloud Platform.",
      icon: <Cloud className="w-6 h-6" />,
      duration: "16 Weeks",
      level: "Advanced",
      color: "cyan"
    }
  ];

  return (
    <section id="programs" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">Our Programs</h2>
            <p className="text-lg text-muted-foreground">
              Intensive, project-based tracks designed to get you job-ready in months, not years.
            </p>
          </div>
          <Button variant="ghost" className="text-secondary font-bold hover:bg-secondary/10">
            View Catalog <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {programs.map((program, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-border/50 hover:border-secondary transition-colors group">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary mb-4 group-hover:bg-secondary group-hover:text-white transition-colors">
                    {program.icon}
                  </div>
                  <Badge variant="secondary" className="w-fit mb-2">
                    {program.level}
                  </Badge>
                  <CardTitle className="text-xl">{program.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {program.description}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between items-center border-t pt-4">
                  <span className="text-xs font-medium text-muted-foreground">
                    Duration: {program.duration}
                  </span>
                  <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent text-primary hover:text-secondary">
                    Apply Now
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
