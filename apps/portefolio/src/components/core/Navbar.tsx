"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* -----------------------------------------
   Data
------------------------------------------ */
const NAV_LINKS = [
  { href: "/home", label: "Hjem" },
  { href: "/about", label: "Om meg" },
  { href: "/projectsDashboard", label: "Prosjekter" },
  { href: "/contact", label: "Kontakt" },
];

const EMAIL = "post@dacosta.no";

/* -----------------------------------------
   Navbar
------------------------------------------ */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  /* ───── Scroll listener ───── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 sm:top-4 z-40 flex justify-center px-2 sm:px-4">
      <nav
        className={cn(
          /* Base styling med glassmorphism */
          "relative backdrop-blur-md after:content-[''] after:absolute after:left-0 after:top-0 after:h-[1px] after:w-full after:bg-gradient-to-r after:from-transparent after:via-black/30 after:to-transparent after:pointer-events-none",
          "w-full max-w-5xl px-3 py-3 md:px-8 lg:px-11 flex items-center justify-between shadow-md border border-black/10 transition-all duration-300",
          "sm:rounded-xl text-black",
          // Conditional styling based on scroll position
          scrolled
            ? "bg-grey/80 shadow-lg" // Darker when scrolled
            : "bg-grey/50" // More transparent initially
        )}
      >
        {/* Logo */}
        <Link 
          href="/" 
          className="text-lg sm:text-xl md:text-2xl font-semibold whitespace-nowrap tracking-tight transition-transform hover:scale-105"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          DaCosta
          <span className="text-[rgb(var(--color-primary-light))]">.</span>
          <span className="hidden xs:inline">no</span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex gap-10 lg:gap-12">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <NavLink href={href} label={label} />
            </li>
          ))}
        </ul>

        {/* CTA */}
        <EmailCTA />

        {/* Mobilmeny */}
        <MobileMenu />
      </nav>
    </header>
  );
}

/* -----------------------------------------
   Nav-lenke med streker + slide - adjusted for dark navbar
------------------------------------------ */
function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className={cn(
        "nav-text group relative inline-block overflow-hidden text-base font-medium transition-colors duration-300",
        "tracking-wide text-black hover:text-black/80" // Dark text on light navbar
      )}
    >
      <span className="before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-current before:origin-left before:scale-x-0 before:transition-transform before:duration-300 group-hover:before:scale-x-100 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-current after:origin-left after:scale-x-0 after:transition-transform after:duration-300 group-hover:after:scale-x-100 relative">
        {/* Tekstslide */}
        <span className="block translate-y-0 transition-transform duration-300 group-hover:-translate-y-full">
          {label}
        </span>
        <span className="absolute left-0 top-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
          {label}
        </span>
      </span>
    </a>
  );
}

/* -----------------------------------------
   CTA: Kopier e‑post - adjusted for dark navbar
------------------------------------------ */
function EmailCTA() {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const content = copied ? (
    <span className="flex items-center gap-1">
      Kopiert
      <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  ) : hovered ? (
    "Kopier"
  ) : (
    EMAIL
  );

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={copyEmail}
      className={cn(
        "nav-text relative hidden sm:inline-flex items-center justify-center w-40 overflow-hidden px-1 py-2 text-sm md:text-base font-medium transition-all duration-300",
        "tracking-wide bg-white/80 text-black hover:bg-white/60 active:bg-white/50 border border-black/10 rounded-md backdrop-blur-sm shadow-md"
      )}
    >
      {content}
    </button>
  );
}

/* -----------------------------------------
   Mobile menu with responsive animations
------------------------------------------ */
function MobileMenu() {
  const [open, setOpen] = useState(false);
  
  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);
  
  // Close menu when pressing escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <>
      <button 
        onClick={() => setOpen(!open)} 
        aria-label={open ? 'Lukk meny' : 'Åpne meny'} 
        aria-expanded={open}
        className="md:hidden ml-2 p-2 rounded-md text-black hover:bg-black/5 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {open ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>

      <div 
        className={cn(
          "fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside className={cn(
        "fixed top-0 right-0 bottom-0 w-[80%] max-w-sm z-30 flex flex-col items-center justify-center gap-8 bg-[#ebeaea]/95 backdrop-blur-xl transition-transform duration-300 md:hidden shadow-xl border-l border-white/10",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <button 
          onClick={() => setOpen(false)}
          aria-label="Lukk meny" 
          className="absolute top-4 right-4 p-2 text-black hover:bg-black/5 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="flex flex-col items-center gap-8 py-8">
          {NAV_LINKS.map(({ href, label }, index) => (
            <a 
              key={href} 
              href={href} 
              onClick={() => setOpen(false)} 
              className="nav-text text-2xl text-black font-medium hover:text-black/70 tracking-wide transition-transform hover:scale-105"
              style={{
                transitionDelay: `${index * 50}ms`,
                animation: open ? `fadeSlideIn 500ms ${index * 50}ms forwards` : 'none',
                opacity: 0,
                transform: 'translateY(20px)'
              }}
            >
              {label}
            </a>
          ))}
  
          <button 
            onClick={() => { navigator.clipboard.writeText(EMAIL); setOpen(false); }} 
            className="nav-text mt-6 px-8 py-3 border border-black/10 bg-white text-black rounded-md hover:bg-white/80 tracking-wide shadow-md backdrop-blur-sm transition-all hover:scale-105"
            style={{
              animation: open ? 'fadeSlideIn 500ms 300ms forwards' : 'none',
              opacity: 0,
              transform: 'translateY(20px)'
            }}
          >
            {EMAIL}
          </button>
        </div>
      </aside>
      
      {/* Add animation keyframes */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}