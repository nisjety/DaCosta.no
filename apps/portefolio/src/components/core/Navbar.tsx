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
  { href: "#projects", label: "Prosjekter" },
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
    <header className="fixed inset-x-0 top-4 z-40 flex justify-center">
      <nav
        className={cn(
          /* Base styling med glassmorphism - now darker for light backgrounds */
          "relative backdrop-blur-md after:content-[''] after:absolute after:left-0 after:top-0 after:h-[1px] after:w-full after:bg-gradient-to-r after:from-transparent after:via-black/30 after:to-transparent after:pointer-events-none",
          "w-full max-w-5xl px-1 py-1 md:px-11 flex items-center justify-between shadow-lg border border-black/10 transition-all duration-300",
          "rounded-xl text-white/90",
          // Conditional styling based on scroll position - darker backgrounds
          scrolled
            ? "bg-grey/60 text-black" // When scrolled, use dark background with white text
            : "bg-grey/50 text-black" // Initially slightly more transparent but still dark
        )}
      >
        {/* Logo */}
        <Link 
          href="/" 
          className="text-lg md:text-xl font-semibold whitespace-nowrap tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          DaCosta
          <span className="text-[rgb(var(--color-primary-light))]">.</span>
          no
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
        "tracking-wide text-black hover:text-black/80" // Always white text on dark navbar
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
        "nav-text relative inline-flex items-center justify-center w-40 overflow-hidden px-1 py-2 text-sm md:text-base font-medium transition-all duration-300",
        "tracking-wide bg-white/80 text-black hover:bg-white/50 onclik:bg-black/40 border border-white/10 rounded-md backdrop-blur-sm shadow-lg"
      )}
    >
      {content}
    </button>
  );
}

/* -----------------------------------------
   Mobile menu - adjusted for dark theme
------------------------------------------ */
function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label="Åpne meny" className="md:hidden ml-2 text-black">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {open ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>

      <aside className={cn(
        "fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-[#ebeaea]/95 backdrop-blur-xl transition-transform duration-300 md:hidden border-t border-white/10",
        open ? "translate-x-0" : "translate-x-full"
      )}>        
        {NAV_LINKS.map(({ href, label }) => (
          <a key={href} href={href} onClick={() => setOpen(false)} className="nav-text text-3xl text-black font-semibold hover:text-black/80 tracking-wide">
            {label}
          </a>
        ))}

        <button onClick={() => { navigator.clipboard.writeText(EMAIL); setOpen(false); }} className="nav-text mt-4 px-8 py-3 border border-white/20 bg-black/30 text-black rounded-md hover:bg-black/50 tracking-wide shadow-md backdrop-blur-sm">
          {EMAIL}
        </button>
      </aside>
    </>
  );
}