import React from 'react';
import { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import ProjectsSection from "@/components/home/ProjectsSection";
import TechStackSection from "@/components/home/TechStackSection";
import ContactSection from "@/components/home/ContactSection";
import Navbar from "@/components/core/Navbar";
import Footer from "@/components/core/Footer";

export const metadata: Metadata = {
  title: "Ima Da Costa | IT-Utvikler",
  description: "IT-utvikler med spesialisering innen backend",
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <section id="hero">
          <HeroSection />
        </section>
        <ProjectsSection />
        <TechStackSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}