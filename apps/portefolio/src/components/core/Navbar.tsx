"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* -----------------------------------------
   Data
------------------------------------------ */
const NAV_LINKS = [
  { href: "#hero", label: "Hjem" },
  { href: "#about", label: "Om meg" },
  { href: "#projects", label: "Prosjekter" },
  { href: "#contact", label: "Kontakt" },
];

const EMAIL = "post@dacosta.no";

/* -----------------------------------------
   Navbar
------------------------------------------ */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  /* ───── Scroll listener → gir hvit pill ───── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll(); // init
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-4 z-40 flex justify-center">
      <nav
        className={cn(
          "w-full max-w-5xl px-6 py-1 md:px-10 flex items-center justify-between rounded-full shadow-sm border transition-colors duration-300",
          scrolled
            ? "backdrop-blur bg-white/80 border-black/10 text-black"
            : "bg-black/5 border-white/20 text-white"
        )}
      >
        {/* Logo */}
        <Link
          href="/"
          className="text-lg md:text-xl font-bold whitespace-nowrap"
        >
          DaCosta
          <span className={scrolled ? "text-blue-500" : "text-blue-400"}>.</span>
          no
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex gap-10 lg:gap-12">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <NavLink href={href} label={label} scrolled={scrolled} />
            </li>
          ))}
        </ul>

        {/* CTA */}
        <EmailCTA scrolled={scrolled} />

        {/* Mobilmeny */}
        <MobileMenu scrolled={scrolled} />
      </nav>
    </header>
  );
}

/* -----------------------------------------
   Nav-lenke med hvite streker + tekst-slide
------------------------------------------ */
function NavLink({
  href,
  label,
  scrolled,
}: {
  href: string;
  label: string;
  scrolled: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group relative inline-block overflow-hidden text-base font-medium transition-colors duration-300",
        scrolled ? "text-black hover:text-neutral-600" : "text-white hover:text-blue-300"
      )}
    >
      {/* Streker */}
      <span
        className="
          before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:content-[''] before:bg-current before:origin-left before:scale-x-0 before:transition-transform before:duration-300 group-hover:before:scale-x-100
          after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:content-[''] after:bg-current after:origin-left after:scale-x-0 after:transition-transform after:duration-300 group-hover:after:scale-x-100
          relative
        "
      >
        {/* Tekstslide (fra bunn → topp) */}
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
   CTA: Kopier e-post (fast bredde)
------------------------------------------ */
function EmailCTA({ scrolled }: { scrolled: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  /* håndter kopiering */
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop – kan evt. vise feilmld.
    }
  };

  const content = copied ? (
    <span className="flex items-center gap-1">
      Kopiert
      <svg
        className="w-4 h-4 text-green-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
      /* w-44 (~176px) sørger for at knappen ikke endrer størrelse */
      className={cn(
        "relative inline-flex items-center justify-center w-44 overflow-hidden rounded-full px-5 py-2.5 text-sm md:text-base font-medium transition-colors duration-300",
        scrolled
          ? "bg-black text-white hover:bg-neutral-800"
          : "bg-white/20 text-white hover:bg-white/30"
      )}
    >
      {content}
    </button>
  );
}

/* -----------------------------------------
   Mobile menu (uendret funksjonelt, men har
   fått Navbar-linken med samme hover-effekt)
------------------------------------------ */
function MobileMenu({ scrolled }: { scrolled: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* hamburger */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Åpne meny"
        className="md:hidden ml-2"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke={scrolled ? "currentColor" : "#fff"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {open ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* fullskjermsmeny */}
      <aside
        className={cn(
          "fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-black/95 transition-transform duration-300 md:hidden",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className="text-3xl text-white font-semibold hover:text-blue-300"
          >
            {label}
          </a>
        ))}

        <button
          onClick={() => {
            navigator.clipboard.writeText(EMAIL);
            setOpen(false);
          }}
          className="mt-4 px-8 py-3 border border-white/20 text-white rounded-full hover:bg-white/20"
        >
          {EMAIL}
        </button>
      </aside>
    </>
  );
}