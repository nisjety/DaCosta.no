'use client';

import React from 'react';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="about-hero-section overflow-hidden">
      {/* Main container - responsive padding and flexible height */}
      <div className="flex justify-center items-center min-h-screen py-8 sm:py-12 md:py-16 px-4 md:px-6 lg:px-8">
        {/* Content wrapper - centered with max width and proper padding */}
        <div className="w-full max-w-screen mx-auto flex flex-col justify-center items-center relative">
          {/* Name label - responsive spacing and sizing */}
          <div className="w-full mb-6 sm:mb-8 md:mb-12">
            <p className="text-xs sm:text-sm md:text-sm text-neutral-500 font-medium tracking-wide text-center">
              Ima Da Costa
            </p>
          </div>
          
          {/* Decorative circles - responsive sizing and positioning */}
          <div className="absolute bottom-6 sm:bottom-8 md:bottom-10 right-1/3 md:right-1/4 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-full opacity-10 sm:opacity-15 md:opacity-20 mix-blend-screen"></div>
          <div className="absolute top-6 sm:top-8 md:top-10 left-1/4 sm:left-1/5 md:left-1/6 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white rounded-full opacity-10 sm:opacity-15 md:opacity-20 mix-blend-multiply"></div>
          
          {/* Main content div with image and text - fully responsive */}
          <div className="relative w-full h-[60vh] sm:h-[70vh] md:h-[70vh] flex flex-col md:flex-row justify-center items-center overflow-hidden">
            {/* Background image - responsive positioning */}
            <div className="absolute top-0 right-0 h-full w-full md:w-1/2 lg:w-3/5 opacity-30 md:opacity-100">
              <div className="relative w-full h-full">
                <Image 
                  className="object-cover object-center md:object-left transform scale-105 md:scale-110"
                  src="/images/typewriter.png" 
                  alt="Typewriter"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>
            
            {/* Text with responsive layout */}
            <h1 className="absolute left-[18vw] text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-light leading-tight tracking-tight text-white mix-blend-difference filter invert-1">
                En Løsningsorientert <br />
                <span className="font-light">utvikler med</span> <br />
                <span className="font-light">lidenskap </span> for <br />
                <span className="font-medium">teknologi og design</span><br />
                <span className="font-light">-basert i</span><br />
                <span className="italic font-semibold">Oslo, Norge.</span>
            </h1>
            
            {/* Scroll indicator - animated with bounce and fade effects */}
            <div className="absolute bottom-6 sm:bottom-8 md:bottom-10 left-1/2 transform -translate-x-1/2 text-black z-20 animate-bounce">
              <svg
                className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 opacity-75 hover:opacity-100 transition-opacity duration-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            
            {/* Custom animation styles */}
            <style jsx>{`
              @keyframes pulse {
                0%, 100% {
                  opacity: 0.7;
                }
                50% {
                  opacity: 1;
                }
              }
              
              .animate-bounce {
                animation: bounce 1.5s infinite;
              }
              
              @keyframes bounce {
                0%, 100% {
                  transform: translateX(-50%) translateY(0);
                }
                50% {
                  transform: translateX(-50%) translateY(-10px);
                }
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  );
}