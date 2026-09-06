import { BentoCard } from "@/components/landing/bento-card";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { Register } from "@/components/landing/register";
import { TwoSides } from "@/components/landing/two-sides";
import { Walkthrough } from "@/components/landing/walkthrough";

/**
 * The landing page stays statically rendered. `Register` reads the database,
 * but nothing on this route touches the session, so Next can prerender the
 * whole page and rebuild it on this interval instead of on every request.
 */
export const revalidate = 300;

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <BentoCard />
        <Walkthrough />
        <TwoSides />
        <Register />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
