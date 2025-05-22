// src/app/(projects)/nettMonitor/page.tsx
import React from 'react';
import { Metadata } from 'next';
import DomainMonitor from '@/components/projects/DomainMonitor';
import Navbar from "@/components/core/Navbar";
import Footer from "@/components/core/Footer";

export const metadata: Metadata = {
  title: 'Nett Monitor | Domene Overvåkning',
  description: 'Overvåk domenene dine og få varsler når de blir tilgjengelige',
};

export default function NettMonitorPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <DomainMonitor />
      </main>
      <Footer />
    </div>
  );
}