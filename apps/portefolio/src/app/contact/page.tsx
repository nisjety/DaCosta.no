import React from 'react';
import { Metadata } from "next";
import ContactContent from '@/components/contact/ContactContent';
import Navbar from "@/components/core/Navbar";
import Footer from "@/components/core/Footer";

export const metadata: Metadata = {
  title: "Ima Da Costa | IT-Utvikler",
  description: "Contakt meg for spørsmål eller forespørseler",
};

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-between p-8 bg-white text-[rgb(var(--foreground-rgb))]">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center pt-24 pb-12">
          <h1 className="text-6xl md:text-7xl font-heading font-bold tracking-tight mb-12">KONTAKT</h1>
        </div>
        <ContactContent />
      </main>
      <Footer />
    </div>
  );
}