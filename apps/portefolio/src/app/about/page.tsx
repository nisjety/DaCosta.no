import React from "react";
import { Metadata } from "next";
import HeroSection from "@/components/about/HeroSection";
import AboutContent from "@/components/about/AboutContent";
import InterestsSection from "@/components/about/InterestsSection";
import SkillsSection from "@/components/about/SkillsSection";
import Navbar from "@/components/core/Navbar";
import Footer from "@/components/core/Footer";

export const metadata: Metadata = {
  title: "Ima Da Costa | IT-Utvikler",
  description: "Om meg som IT-utvikler med spesialisering innen backend",
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <section id="hero">
          <HeroSection />
        </section>
        <AboutContent />
        <InterestsSection />
        <SkillsSection />
      </main>
      <Footer />
    </>
  );
}