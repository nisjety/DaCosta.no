"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

const HeroSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);

    const handleScroll = () => {
      if (!dotRef.current || !sectionRef.current) return;

      const scrollPosition = window.scrollY;
      const viewportHeight = window.innerHeight;

      const progress = Math.min(Math.max(scrollPosition / (viewportHeight * 0.8), 0), 1);

      if (dotRef.current) {
        const scale = 1 + progress * 50;
        dotRef.current.style.transform = `scale(${scale})`;

        const heroContent = document.getElementById("hero-content");
        if (heroContent) {
          heroContent.style.opacity = `${1 - progress * 2}`;
        }
      }

      if (progress > 0.5) {
        document.getElementById("projects-section")?.classList.add("active");
      } else {
        document.getElementById("projects-section")?.classList.remove("active");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const techStack = [
    "Next.js", "NestJS", "React", "Redis", 
    "Docker", "Kafka", "RabbitMQ", "Spring Boot", 
    "Node Express", "MongoDB"
  ];

  return (
    <div ref={sectionRef} className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black to-slate-900"></div>

      <div className="absolute inset-0 flex justify-end items-center opacity-80 pr-10 lg:pr-20">
        <div className="relative w-9/12 md:w-7/12 lg:w-5/12 h-screen">
          <Image
            src="/profile.png"
            alt="Ima Da Costa"
            layout="fill"
            objectFit="contain"
            objectPosition="right center"
            priority
            className={`transition-opacity duration-1000 ${isVisible ? "opacity-100" : "opacity-0"}`}
          />
        </div>
      </div>

      <div className="absolute right-8 md:right-16 top-1/2 transform -translate-y-1/2 z-20 flex flex-col space-y-6">
        {[
          { id: "hero", label: "Hjem" },
          { id: "projects", label: "Prosjekter" },
          { id: "tech-stack-section", label: "Tech Stack" }
        ].map((section) => (
          <div key={section.id} className="group flex items-center" onClick={() => scrollToSection(section.id)}>
            <div
              className="w-3 h-3 bg-white/40 rounded-full cursor-pointer group-hover:bg-white group-hover:scale-125 transition-all duration-300"
              title={section.label}
            ></div>
            <span className="ml-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm">
              {section.label}
            </span>
          </div>
        ))}
      </div>

      <div id="hero-content" className="relative z-10 min-h-screen px-8 md:px-16 lg:px-24 flex flex-col justify-center">
        <div className={`transition-all duration-1000 delay-300 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
          <h3 className="text-gray-300 text-xl md:text-2xl mb-2">Hei, jeg heter</h3>
          <h1 className="text-white text-5xl md:text-7xl lg:text-8xl font-bold mb-4">
            Ima Da Costa
            <span className="inline-block ml-2 relative">
              <div
                ref={dotRef}
                className="dot-animation bg-white w-3 h-3 rounded-full absolute"
                style={{
                  bottom: "10.rem",
                  left: "10.rem",
                  transformOrigin: "center"
                }}
              ></div>
            </span>
          </h1>
          <h2 className="text-gray-200 text-xl md:text-3xl lg:text-4xl mb-8 max-w-2xl">
            Jeg bygger systemer som fungerer — fra idé til produksjon.
          </h2>

          <div className="flex flex-col md:flex-row mb-10">
            <div className="mb-8 md:mb-0 md:mr-16">
              <h3 className="text-gray-400 text-lg mb-3">Språk jeg bruker:</h3>
              <p className="text-white text-xl">Java, JavaScript, Python, C#</p>
            </div>
            <div>
              <h3 className="text-gray-400 text-lg mb-3">Spesialitet:</h3>
              <p className="text-white text-xl">Backend-systemer med fokus på ytelse, skalerbarhet og drift.</p>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-gray-400 text-lg mb-4">Tech stack:</h3>
            <div className="flex flex-wrap gap-3">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="tech-item bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div className="flex mt-16">
            <div className="mr-12">
              <h3 className="text-4xl text-white font-bold">3</h3>
              <p className="text-gray-400">prosjekter fullført</p>
            </div>
            <div>
              <h3 className="text-4xl text-white font-bold">+1</h3>
              <p className="text-gray-400">bidrag i prosject sammenheng</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-white flex flex-col items-center">
        <p className="mb-2 text-sm">Scroll ned</p>
        <svg className="animate-bounce w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      <div id="projects-section" className="clip-circle absolute inset-0 bg-white z-20">
        <div className="p-8 md:p-16 lg:p-24 h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-5xl md:text-6xl font-bold mb-8">Mine prosjekter</h2>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto">
              Her er et utvalg av mine nyeste prosjekter. Scroll videre for å se mer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
