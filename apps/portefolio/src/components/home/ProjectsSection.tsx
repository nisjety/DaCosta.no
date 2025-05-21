"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

// Define the Project interface
interface Project {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  image: string;
  year: string;
}

// Define the component
export default function ProjectsSection() {
  // Define projects array inside the component using useMemo to prevent recreating on each render
  const projectsData = React.useMemo<Project[]>(() => [
    {
      id: 1,
      title: "Portefolio",
      description:
        "En fullstack side, bygget med Next.js og Tailwind CSS, og viser mine prosjekter.",
      technologies: ["Next.js", "Tailwind", "React", "docker", "TypeScript", "Self-hosted with collify"],
      image: "/projects/portefolio.jpg",
      year: "2025",
    },
    {
      id: 2,
      title: "Qualai System",
      description: "Sammarbeid med Prokom for å lage en Skalerbar multi-løsning som sjekker netsider for forbedringer, wcag og ytelse.",
      technologies: ["Docker", "mongo", "Redis", "Kafka", "python", "FastAPI", "nodejs", "rabbitMQ", "websockets", "pupeteer", "scrapy"],
      image: "/projects/qualai.jpg",
      year: "2025",
    },
    {
      id: 3,
      title: "bybud",
      description:
        "En applicasjon for å bestille budtjenester av pakker, bygget med Spring Boot og React.",
      technologies: ["Spring Boot", "mongodb", "kafka", "JWT", "redis", "docker", "java", "javascript", "react"],
      image: "/projects/bybud.jpg",
      year: "2024",
    },
  ], []);

  // Initialize state AFTER defining projects
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeYear, setActiveYear] = useState(projectsData[0].year);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update active slide on scroll with better debounce and hold handling
  useEffect(() => {
    const onScroll = () => {
      // If an animation is currently running, prevent scrolling by returning early
      if (isAnimating) return;

      if (!containerRef.current) return;

      const containerTop = containerRef.current.offsetTop;
      const relY = window.scrollY - containerTop;
      const scrollPercent = relY / window.innerHeight;
      const idx = Math.floor(scrollPercent);
      
      // Add a threshold to prevent accidental transitions
      // Only update when we're at least 20% into a new section
      const fractionalPart = scrollPercent - idx;
      const shouldUpdate = (fractionalPart < 0.2 || fractionalPart > 0.8);
      
      if (idx >= 0 && idx < projectsData.length && idx !== activeIndex && shouldUpdate) {
        // Set animating to true to prevent further scrolling
        setIsAnimating(true);
        
        // Update the active index
        setActiveIndex(idx);
        setActiveYear(projectsData[idx].year);
        
        // Re-enable scrolling after animation completes (1.5s covers most animations)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        scrollTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false);
        }, 1500);
      }
    };

    window.addEventListener("scroll", onScroll);
    // Initial check to set correct active slide
    setTimeout(onScroll, 100);
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [activeIndex, projectsData, isAnimating]);

  // Effect to disable scrolling during animations
  useEffect(() => {
    // Save the original overflow style
    const originalStyle = window.getComputedStyle(document.body).overflow;
    
    if (isAnimating) {
      // Disable scrolling by setting overflow to hidden
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable scrolling
      document.body.style.overflow = originalStyle;
    }
    
    // Cleanup function to restore original overflow when component unmounts
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isAnimating]);

  // linger last slide by 80vh
  const extraHoldVh = 80;
  const totalHeightVh = projectsData.length * 100 + extraHoldVh;

  return (
    <section
      id="projects"
      className="bg-gradient-to-b from-white to-gray-50"
    >
      <div
        ref={containerRef}
        className="container mx-auto px-6 md:px-12 flex flex-col md:flex-row py-24"
      >
        {/* TIMELINE SIDEBAR */}
        <aside className="md:w-1/3 lg:w-1/4 mb-12 md:mb-0">
          <div className="sticky top-24 space-y-8">
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-black to-gray-600"
            >
              Prosjekter
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-gray-600"
            >
              En oversikt over mine mest relevante prosjekter, organisert etter år.
            </motion.p>

            <div className="relative">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-black to-gray-300" />
              <div className="space-y-8">
                {projectsData.map((p, i) => (
                  <motion.div
                    key={`${p.year}-${p.id}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                    className="flex items-center group cursor-pointer transition-all duration-300"
                    onClick={() => {
                      if (containerRef.current && !isAnimating) {
                        // Set animating state to true to prevent scrolling
                        setIsAnimating(true);
                        
                        window.scrollTo({
                          top:
                            containerRef.current.offsetTop +
                            i * window.innerHeight,
                          behavior: "smooth",
                        });
                        
                        setActiveIndex(i);
                        setActiveYear(p.year);
                        
                        // Re-enable scrolling after animation
                        if (scrollTimeoutRef.current) {
                          clearTimeout(scrollTimeoutRef.current);
                        }
                        
                        scrollTimeoutRef.current = setTimeout(() => {
                          setIsAnimating(false);
                        }, 1500);
                      }
                    }}
                  >
                    <div
                      className={`h-5 w-5 rounded-full mr-3 z-10 transition-all duration-300 shadow-md ${
                        activeYear === p.year
                          ? "bg-black scale-125"
                          : "bg-gray-400 group-hover:bg-gray-600"
                      }`}
                    />
                    <span
                      className={`text-lg font-medium transition-all duration-300 ${
                        activeYear === p.year
                          ? "text-black scale-105"
                          : "text-gray-500 group-hover:text-gray-700"
                      }`}
                    >
                      {p.year}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* FULL-HEIGHT SLIDES */}
        <div className="md:w-2/3 lg:w-3/4 md:pl-12">
          <div
            className="relative perspective-1000"
            style={{ height: `${totalHeightVh}vh`, perspective: "1000px" }}
          >
            {projectsData.map((project, idx) => (
              <div
                key={project.id}
                className="sticky top-0 h-screen w-full relative"
                style={{ zIndex: idx + 1 }}
              >
                <motion.div
                  initial={{ 
                    opacity: 0, 
                    x: 400, 
                    rotateY: 30,
                    z: -200
                  }}
                  animate={
                    activeIndex === idx
                      ? { 
                          opacity: 1, 
                          x: 0, 
                          rotateY: 0,
                          z: 0,
                          transition: { 
                            duration: 1, 
                            ease: [0.16, 1, 0.3, 1], // Custom easing (cubicBezier)
                            opacity: { duration: 0.5 },
                            delay: 0.2,  // Small delay before entering
                            onComplete: () => {
                              // Animation is complete, allow scrolling again
                              setTimeout(() => {
                                setIsAnimating(false);
                              }, 300); // Small extra buffer after main animation
                            }
                          }
                        }
                      : idx < activeIndex
                        ? { 
                            opacity: 0.2, 
                            x: -400, 
                            rotateY: -30,
                            z: -200,
                            transition: { 
                              duration: 1.2,  // Longer exit animation
                              ease: "easeIn",
                              delay: 0.3  // Hold before leaving
                            }
                          }
                        : { 
                            opacity: 0.5, 
                            x: 400, 
                            rotateY: 30,
                            z: -200,
                            transition: { 
                              duration: 0.8, 
                              ease: "easeOut" 
                            }
                          }
                  }
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                             grid grid-cols-1 md:grid-cols-2 h-5/6 w-full max-w-4xl
                             rounded-2xl overflow-hidden shadow-2xl transform-gpu
                             transition-all duration-700"
                  style={{
                    backgroundColor: "white",
                    transformStyle: "preserve-3d",
                    boxShadow: activeIndex === idx 
                      ? "0 20px 50px rgba(0,0,0,0.3)" 
                      : "0 10px 30px rgba(0,0,0,0.2)"
                  }}
                >
                  {/* LEFT: Text Content */}
                  <motion.div 
                    className="flex flex-col justify-center p-8 md:p-12 bg-white relative overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: activeIndex === idx ? 1 : 0,
                      transition: { 
                        duration: 0.8,
                        delay: activeIndex === idx ? 0.3 : 0 
                      }
                    }}
                  >
                    <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-gradient-to-br from-gray-100 to-transparent opacity-50" />
                    <motion.span
                      initial={{ opacity: 0, y: 50, x: -20 }}
                      animate={
                        activeIndex === idx
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 50, x: -20 }
                      }
                      transition={{ 
                        type: "spring", 
                        stiffness: 100, 
                        damping: 12,
                        delay: 0.4 
                      }}
                      className="text-sm text-gray-500 mb-2 z-10"
                    >
                      {project.year}
                    </motion.span>

                    <motion.h3
                      initial={{ opacity: 0, y: 60, x: -20 }}
                      animate={
                        activeIndex === idx
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 60, x: -20 }
                      }
                      transition={{ 
                        type: "spring", 
                        stiffness: 100, 
                        damping: 12,
                        delay: 0.5 
                      }}
                      className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-black to-gray-700"
                    >
                      {project.title}
                    </motion.h3>

                    <motion.p
                      initial={{ opacity: 0, y: 60, x: -20 }}
                      animate={
                        activeIndex === idx
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 60, x: -20 }
                      }
                      transition={{ 
                        type: "spring", 
                        stiffness: 80, 
                        damping: 12,
                        delay: 0.6 
                      }}
                      className="text-gray-700 mb-8"
                    >
                      {project.description}
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, y: 60, x: -20 }}
                      animate={
                        activeIndex === idx
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 60, x: -20 }
                      }
                      transition={{ 
                        type: "spring", 
                        stiffness: 70, 
                        damping: 12,
                        delay: 0.7 
                      }}
                      className="flex flex-wrap gap-2 mb-8"
                    >
                      {project.technologies.map((tech, techIdx) => (
                        <motion.span
                          key={tech}
                          initial={{ opacity: 0, scale: 0.5, y: 20 }}
                          animate={
                            activeIndex === idx
                              ? { opacity: 1, scale: 1, y: 0 }
                              : { opacity: 0, scale: 0.5, y: 20 }
                          }
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            delay: 0.8 + techIdx * 0.05,
                          }}
                          className="bg-gray-100 px-4 py-2 rounded-full text-sm shadow-sm hover:shadow-md transition-all duration-300 hover:bg-gray-200"
                        >
                          {tech}
                        </motion.span>
                      ))}
                    </motion.div>

                    <motion.button
                      initial={{ opacity: 0, y: 60, x: -20 }}
                      animate={
                        activeIndex === idx
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 60, x: -20 }
                      }
                      transition={{ 
                        type: "spring", 
                        stiffness: 60, 
                        damping: 12,
                        delay: 0.9 + (project.technologies.length * 0.03) 
                      }}
                      className="group inline-flex items-center font-medium relative overflow-hidden rounded-lg px-6 py-3 bg-black text-white shadow-lg hover:shadow-xl transition-all duration-300 w-fit"
                    >
                      <span className="relative z-10">Se detaljer</span>
                      <svg
                        className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1 relative z-10"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                      <div className="absolute top-0 left-0 w-full h-full bg-gray-700 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                    </motion.button>
                  </motion.div>

                  {/* RIGHT: Image */}
                  <div className="relative h-full w-full overflow-hidden">
                    <motion.div
                      initial={{ scale: 1.3, filter: "brightness(0.7) blur(5px)" }}
                      animate={
                        activeIndex === idx 
                          ? { 
                              scale: 1, 
                              filter: "brightness(1) blur(0px)",
                              transition: {
                                duration: 1.2,
                                ease: [0.16, 1, 0.3, 1], // Custom easing
                                delay: 0.2
                              }
                            } 
                          : { 
                              scale: 1.3, 
                              filter: "brightness(0.7) blur(5px)",
                              transition: {
                                duration: 1,
                                ease: "easeInOut",
                                delay: 0
                              }
                            }
                      }
                      className="h-full w-full"
                    >
                      <Image
                        src={project.image}
                        alt={project.title}
                        fill
                        priority
                        className="object-cover transition-all duration-700 hover:scale-105"
                      />
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-br from-black/40 to-transparent"
                        initial={{ opacity: 0.9 }}
                        animate={{
                          opacity: activeIndex === idx ? 0.6 : 0.9,
                          transition: { duration: 1.5, delay: 0.3 }
                        }}
                      />
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            ))}

            {/* extra hold so the last slide lingers ~120vh */}
            <div className="h-[120vh]" />
          </div>
        </div>
      </div>
    </section>
  );
}