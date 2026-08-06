import { Hero } from "@/components/home/Hero";
import { Stats } from "@/components/home/Stats";
import { Mission } from "@/components/home/Mission";
import { Programs } from "@/components/home/Programs";
import { Mentorship } from "@/components/home/Mentorship";
import { Testimonials } from "@/components/home/Testimonials";
import { EnrollmentForm } from "@/components/home/EnrollmentForm";

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Mission />
      <Programs />
      <Mentorship />
      <Testimonials />
      <EnrollmentForm />
    </>
  );
}
