import React from 'react';
import { Metadata } from "next";
import ProjectsLayout from "@/components/projects/ProjectsLayout";
import Navbar from "@/components/core/Navbar";
import Footer from "@/components/core/Footer";

export const metadata: Metadata = {
  title: "Ima Da Costa | IT-Utvikler",
  description: "Mine prosjekter som IT-utvikler",
};

export default function ProjectsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-between p-8 bg-white text-[rgb(var(--foreground-rgb))]">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center pt-10 pb-12">
        </div>
        <ProjectsLayout />
      </main>
      <Footer />
    </div>
  );
}
