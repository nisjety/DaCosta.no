// filepath: /Users/imadacosta/Desktop/DaCosta.no/apps/portefolio/src/components/home/herosection.tsx
"use client";

import React, { useEffect, useRef, useState, useLayoutEffect, CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Define types for MatrixText props
interface MatrixTextProps {
  text: string;
  revealText?: string;
  className?: string;
  style?: CSSProperties;
}

// Matrix text effect component
const MatrixText: React.FC<MatrixTextProps> = ({ text, revealText, className, style }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [displayedText, setDisplayedText] = useState(text);
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,./<>?';
  const animationRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (isHovering) {
      // Start the matrix effect and eventually show the reveal text
      let iteration = 0;
      let currentText = text;
      const finalText = revealText || text;
      const maxIterations = 10; // Number of scrambles before settling

      if (animationRef.current) {
        clearInterval(animationRef.current);
      }

      animationRef.current = setInterval(() => {
        if (iteration >= maxIterations) {
          // Slowly replace with the final text
          if (currentText === finalText) {
            if (animationRef.current) clearInterval(animationRef.current);
            return;
          }

          // Replace one character at a time with the final text
          const nextText = currentText
            .split('')
            .map((char: string, index: number) => {
              if (finalText[index] === undefined) return '';

              // 25% chance to fix this character in this iteration
              if (Math.random() < 0.25 || currentText[index] === finalText[index]) {
                return finalText[index];
              }

              return char;
            })
            .join('');

          currentText = nextText;
          setDisplayedText(currentText);

          // If we're close to the final text, slow down
          if (
            currentText.split('').filter((char: string, i: number) => char === finalText[i])
              .length > finalText.length * 0.7
          ) {
            if (animationRef.current) clearInterval(animationRef.current);
            animationRef.current = setInterval(() => {
              const nextText = currentText
                .split('')
                .map((char: string, index: number) => {
                  if (finalText[index] === undefined) return '';
                  if (Math.random() < 0.3 || currentText[index] === finalText[index]) {
                    return finalText[index];
                  }
                  return char;
                })
                .join('');

              currentText = nextText;
              setDisplayedText(currentText);

              if (currentText === finalText) {
                if (animationRef.current) clearInterval(animationRef.current);
              }
            }, 100);
          }
        } else {
          // Random scramble phase
          const nextText = text
            .split('')
            .map((_: string, index: number) => {
              // Keep spaces as spaces
              if (text[index] === ' ') return ' ';
              // Randomly choose to replace with a random character
              return Math.random() < 0.5
                ? characters[Math.floor(Math.random() * characters.length)]
                : text[index];
            })
            .join('');

          currentText = nextText;
          setDisplayedText(currentText);
          iteration += 1;
        }
      }, 50);
    } else {
      // Reset to original text when not hovering
      if (animationRef.current) clearInterval(animationRef.current);
      setDisplayedText(text);
    }

    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [isHovering, text, revealText, characters]);

  return (
    <span
      className={cn('cursor-default transition-colors', className)}
      style={style}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <span className="inline-block relative">
        {displayedText}
        {isHovering && (
          <motion.span
            className="absolute bottom-0 left-0 h-[1px] bg-[#222222]/40"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5 }}
          />
        )}
      </span>
    </span>
  );
};

export default function HeroSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const exclRef = useRef<HTMLSpanElement>(null);

  const [progress, setProgress] = useState(0); // scroll-driven 0 → 1
  const [pinned, setPinned] = useState(true); // stay fixed until scroll complete
  const [dotPosition, setDotPosition] = useState({ x: 24, y: 41 });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!wrapperRef.current) return;
      const { top } = wrapperRef.current.getBoundingClientRect();
      const pct = Math.min(Math.max(-top / window.innerHeight, 0), 1);
      setProgress(pct);
      setPinned(pct < 1);
    };
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    let updateDotPos: () => void;
    const timer = setTimeout(() => {
      updateDotPos = () => {
        if (!exclRef.current) return;
        const r = exclRef.current.getBoundingClientRect();
        const cx = r.left + r.width * 0.5;
        const cy = r.top + r.height * 0.73;
        setDotPosition({
          x: (cx / window.innerWidth) * 100,
          y: (cy / window.innerHeight) * 100,
        });
      };
      updateDotPos();
      window.addEventListener('resize', updateDotPos);
      document.fonts.ready.then(updateDotPos);
    }, 300);

    return () => {
      clearTimeout(timer);
      if (updateDotPos) window.removeEventListener('resize', updateDotPos);
    };
  }, [isLoaded]);

  const dotScale = 1 + progress * 220;
  const fade = Math.max(1 - progress * 1.5, 0);

  return (
    <section ref={wrapperRef} className="bg-white relative h-[200vh]">
      <div className={cn('inset-0 overflow-hidden', pinned ? 'fixed' : 'relative')}>
        <div className="absolute inset-0 -z-10 home-hero-section" />

        <div
          className="absolute w-3 h-3 bg-white rounded-full"
          style={{
            left: `${dotPosition.x}%`,
            top: `${dotPosition.y}%`,
            transform: `translate(-50%,-50%) scale(${dotScale})`,
            transformOrigin: 'center',
            transition: 'transform 0.1s linear',
            opacity: 0.9,
          }}
        />

        {/* Main Hero Section - Now centered with flex justify-center and items-center */}
        <div 
          className="relative min-h-screen flex flex-col justify-center items-center px-8 md:px-16 lg:px-24" 
          style={{ opacity: fade }}
        >
          <AnimatePresence>
            {isLoaded && (
              <div className="max-w-4xl relative mx-auto w-full">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-[#7b7b7b] mb-6 uppercase tracking-wide text-sm font-light"
                >
                  Backend Utvikler
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                  className="text-[#222222] font-light tracking-tight text-8xl md:text-9xl lg:text-[25rem] leading-[0.9]"
                >
                  Hei
                  <span ref={exclRef} className="inline-block relative">
                    <span className="relative z-10"></span>
                    <span className="absolute opacity-0" aria-hidden="true">.</span>
                  </span>
                </motion.h1>

                <motion.h2
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="text-[#222222] text-4xl md:text-5xl lg:text-6xl font-light mb-4 tracking-tight"
                  style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}
                >
                  Ima her, velkommen.
                </motion.h2>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.4 }}
                  className="text-[#7b7b7b] mb-8 max-w-2xl"
                >
                  <MatrixText
                    text="Jeg bygger det usynlige som får alt til å fungere."
                    revealText="Backend - er der jeg sitter."
                    className="relative w-full text-xl md:text-2xl lg:text-3xl font-light tracking-tight"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  />
                  <span className="block mt-1 text-[#7b7b7b]/80 text-lg md:text-xl lg:text-2xl italic">
                    &quot;Less code, more impact.&quot;
                  </span>
                </motion.div>

                <motion.a
                  href="#projects"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.6 }}
                  whileHover={{
                    scale: 1.03,
                    backgroundColor: '#222222',
                    transition: { duration: 0.2 },
                  }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 nav-text px-8 py-3 bg-[#222222] text-white rounded-md transition-all duration-300 shadow-sm"
                >
                  Finn ut mer...
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </motion.a>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 1, delay: 0.8 }}
                  className="absolute top-0 right-0 p-6 rounded-xl shadow-sm border border-gray-100"
                  style={{
                    width: '180px',
                    background: 'rgba(255, 255, 255, 1)',
                  }}
                >
                  <div className="space-y-3">
                    <div>
                      <div className="text-[#7b7b7b] text-xs uppercase tracking-wider mb-1">Prosjekter</div>
                      <div className="text-[#222222] text-2xl font-semibold">3+</div>
                    </div>
                    <div>
                      <div className="text-[#7b7b7b] text-xs uppercase tracking-wider mb-1">Alder</div>
                      <div className="text-[#222222] text-2xl font-semibold">28</div>
                    </div>
                    <div>
                      <div className="text-[#7b7b7b] text-xs uppercase tracking-wider mb-1">Tech Stack</div>
                      <div className="text-[#222222] text-2xl font-semibold">14</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Profile Image - Adjusted for better positioning with centered content */}
          <div
            className="absolute right-0 bottom-0 top-0 flex items-center pr-10 lg:pr-20 pointer-events-none"
            style={{ 
              opacity: fade,
              maxWidth: '100%',
              width: '100%',
              justifyContent: 'flex-end'
            }}
          >
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: isLoaded ? 1 : 0, x: isLoaded ? 0 : 40 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="relative w-9/12 md:w-7/12 lg:w-5/12 h-full"
            >
              <Image src="/profile.png" alt="profil" fill priority className="object-contain object-right" />
            </motion.div>
          </div>

          <motion.div
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex flex-col items-center text-[#7b7b7b]"
            initial={{ opacity: 0 }}
            animate={{
              opacity: isLoaded ? [0.5, 1, 0.5] : 0,
              y: isLoaded ? [0, 10, 0] : 0,
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: 'easeInOut',
              delay: 1.5,
            }}
          >
            <p className="text-sm uppercase tracking-widest mb-2 font-light">Scroll</p>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </motion.div>
        </div>
      </div>

      <div id="projects" className="h-screen flex items-center justify-center bg-white text-[#222222]">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 100,
            damping: 20,
            delay: 0.2,
          }}
          className="text-5xl md:text-6xl font-bold text-center"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Mine prosjekter
        </motion.h2>
      </div>
    </section>
  );
}
