"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";

interface TechItem {
  name: string;
  category: "frontend" | "backend" | "devops" | "database";
  logo: string;
}

const techItems: TechItem[] = [
  { name: "JavaScript", category: "frontend", logo: "/logos/javascript.svg" },
  { name: "TypeScript", category: "frontend", logo: "/logos/typescript.svg" },
  { name: "HTML",       category: "frontend", logo: "/logos/html.svg" },
  { name: "CSS",        category: "frontend", logo: "/logos/css.svg" },
  { name: "Tailwind CSS",category: "frontend", logo: "/logos/tailwindcss.svg" },
  { name: "React",      category: "frontend", logo: "/logos/React.svg" },
  { name: "C#",         category: "backend",  logo: "/logos/c-sharp.svg" },
  { name: "Java",       category: "backend",  logo: "/logos/Java.svg" },
  { name: "Node.js",    category: "backend",  logo: "/logos/Nodejs.svg" },
  { name: "Python",     category: "backend",  logo: "/logos/python.svg" },
  { name: "Flask",      category: "backend",  logo: "/logos/flask.svg" },
  { name: "Next.js",    category: "frontend", logo: "/logos/Nextjs.svg" },
  { name: "NestJS",     category: "backend",  logo: "/logos/NestJS.svg" },
  { name: "Spring",     category: "backend",  logo: "/logos/Spring.svg" },
  { name: "Express",    category: "backend",  logo: "/logos/express.svg" },
  { name: "REST API",   category: "backend",  logo: "/logos/rest.svg" },
  { name: "MongoDB",    category: "database", logo: "/logos/MongoDB.svg" },
  { name: "Redis",      category: "database", logo: "/logos/Redis.svg" },
  { name: "PostgreSQL", category: "database", logo: "/logos/postgresql.svg" },
  { name: "MySQL",      category: "database", logo: "/logos/MySQL.svg" },
  { name: "AWS",        category: "devops",  logo: "/logos/aws.svg" },
  { name: "Github",     category: "devops",   logo: "/logos/github.svg" },
  { name: "bitbucket",  category: "devops",   logo: "/logos/bitbucket.svg" },
  { name: "Docker",     category: "devops",   logo: "/logos/Docker.svg" },
  { name: "Kafka",      category: "devops",   logo: "/logos/Kafka.svg" },
  { name: "RabbitMQ",   category: "devops",   logo: "/logos/rabbitmq.svg" },
];

export default function TechStackSection() {
  // State for filtering and display
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [visibleItems, setVisibleItems] = useState<TechItem[]>(techItems);
  const [loopItems, setLoopItems] = useState<TechItem[]>([]);
  
  // Scroll and animation state
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const [currentPosition, setCurrentPosition] = useState(0);
  
  // Refs for DOM elements and tracking state
  const containerRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const currentPosRef = useRef(currentPosition);

  // Update position with transform and state
  const setPosition = useCallback((pos: number): void => {
    if (!marqueeRef.current) return;
    
    // Update both the state and the ref for immediate access
    setCurrentPosition(pos);
    currentPosRef.current = pos;
    
    // Apply the transform directly
    marqueeRef.current.style.transform = `translateX(${pos}px)`;
  }, []);

  // Filter items based on selected category
  useEffect(() => {
    const filteredItems = activeCategory === "all"
      ? techItems
      : techItems.filter((t) => t.category === activeCategory);
    setVisibleItems(filteredItems);
    // Reset position when category changes
    setPosition(0);
  }, [activeCategory, setPosition]);

  // Build loopItems so that the container is always filled
  useEffect(() => {
    const buildLoop = () => {
      if (!containerRef.current || visibleItems.length === 0) return;
      const containerWidth = containerRef.current.clientWidth;
      // card width 112px + gap 24px = 136px
      const perItem = 112 + 24;
      // how many items fit in view
      const needed = Math.ceil(containerWidth / perItem) + 1;
      // how many times to replicate visibleItems
      const repCount = Math.ceil(needed / visibleItems.length) || 1;
      const extended = Array(repCount).fill(visibleItems).flat();
      // mirror it for seamless scroll
      setLoopItems([...extended, ...extended]);
    };

    buildLoop();
    window.addEventListener("resize", buildLoop);
    return () => window.removeEventListener("resize", buildLoop);
  }, [visibleItems]);

  // Main animation effect for auto-scrolling
  useEffect(() => {
    const marqueeElement = marqueeRef.current;
    if (!marqueeElement) return;

    let lastTimestamp = 0;
    
    // Animation loop for smooth scrolling
    const animate = (timestamp: number): void => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      // Calculate time elapsed since last frame
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      
      // Only move if not paused or hovered
      if (!isPaused && !isHovered) {
        // Calculate position based on time for smoother animation
        const newPosition = currentPosRef.current - scrollSpeed * (elapsed / 16);
        setPosition(newPosition);
        
        // Reset position for infinite loop when needed
        const marqueeWidth = marqueeElement.scrollWidth / 2;
        if (newPosition <= -marqueeWidth) {
          setPosition(newPosition + marqueeWidth);
        }
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    // Clean up animation on unmount or when dependencies change
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPaused, isHovered, scrollSpeed, setPosition]);

  // Handle mouse wheel scrolling
  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;

    const handleWheel = (e: WheelEvent): void => {
      if (!isHovered) return;
      
      e.preventDefault();
      
      // Use deltaX for horizontal scrolling, or deltaY if no horizontal scroll
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const scrollAmount = delta * 2; // Adjust sensitivity
      
      const newPosition = currentPosRef.current - scrollAmount;
      setPosition(newPosition);
      
      // Handle infinite loop boundaries
      if (marqueeRef.current) {
        const marqueeWidth = marqueeRef.current.scrollWidth / 2;
        if (newPosition <= -marqueeWidth) {
          setPosition(newPosition + marqueeWidth);
        } else if (newPosition > 0) {
          setPosition(newPosition - marqueeWidth);
        }
      }
    };

    containerElement.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      containerElement.removeEventListener('wheel', handleWheel);
    };
  }, [isHovered, setPosition]);

  // Handle speed changes
  const increaseSpeed = useCallback(() => {
    setScrollSpeed(prev => {
      const newSpeed = Math.min(prev + 0.5, 4);
      console.log('Speed increased to:', newSpeed);
      return newSpeed;
    });
  }, []);

  const decreaseSpeed = useCallback(() => {
    setScrollSpeed(prev => {
      const newSpeed = Math.max(prev - 0.5, 0.5);
      console.log('Speed decreased to:', newSpeed);
      return newSpeed;
    });
  }, []);

  // Handle category change
  const handleCategoryChange = useCallback((categoryId: string) => {
    console.log('Category changed to:', categoryId);
    setActiveCategory(categoryId);
  }, []);

  // Handle pause/play toggle
  const togglePause = useCallback((): void => {
    setIsPaused(prev => {
      console.log('Pause toggled to:', !prev);
      return !prev;
    });
  }, []);

  // Handle container mouse enter/leave
  const handleContainerMouseEnter = (): void => {
    setIsHovered(true);
  };

  const handleContainerMouseLeave = (): void => {
    setIsHovered(false);
  };

  // Category list for filter buttons
  const categories = [
    { id: "all",       label: "Alle" },
    { id: "frontend",  label: "Frontend" },
    { id: "backend",   label: "Backend" },
    { id: "database",  label: "Database" },
    { id: "devops",    label: "DevOps" },
  ];

  return (
    <section id="tech-stack-section" className="py-16 bg-white">
      <div className="container mx-auto px-6 md:px-12">
        <h2 className="text-black text-3xl md:text-4xl font-bold text-center mb-8">
          Teknologistakk
        </h2>

        {/* Category filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-5 py-2 text-sm rounded-full transition-all duration-200 cursor-pointer select-none ${
                activeCategory === cat.id
                  ? "bg-gray-800 text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:shadow-sm"
              }`}
              type="button"
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Marquee slider */}
      <div 
        className="relative h-[20vh] flex items-center justify-center overflow-hidden bg-white py-6"
      >
        {/* Enhanced top and bottom borders with subtle fade */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        
        <div
          ref={containerRef}
          className="w-[80vw] overflow-hidden relative mb-4"
          onMouseEnter={handleContainerMouseEnter}
          onMouseLeave={handleContainerMouseLeave}
        >
          <div 
            ref={marqueeRef}
            className="flex gap-6 whitespace-nowrap py-2 transition-transform duration-300 ease-linear"
          >
            {loopItems.map((tech, idx) => (
              <div
                key={`${tech.name}-${idx}`}
                className={`flex-shrink-0 w-28 h-28 bg-white border border-gray-100 rounded-lg flex flex-col items-center justify-center p-2 hover:shadow-md transition-all duration-300 hover:border-gray-200 ${
                  (isPaused || isHovered) ? '' : 'opacity-80'
                } hover:opacity-100`}
              >
                <div className="w-10 h-10 relative mb-2">
                  <Image
                    src={tech.logo}
                    alt={`${tech.name} logo`}
                    fill
                    className={`object-contain transition-all duration-300 ${
                      (isPaused || isHovered) ? '' : 'grayscale'
                    } hover:grayscale-0`}
                  />
                </div>
                <span className="text-xs font-medium text-gray-400 hover:text-gray-900 transition-colors duration-300">
                  {tech.name}
                </span>
              </div>
            ))}
          </div>
          {/* Enhanced fading effects on left and right sides */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white via-white/90 to-transparent pointer-events-none z-10"></div>
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white via-white/90 to-transparent pointer-events-none z-10"></div>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex justify-center gap-4 items-center mt-6">
        {/* Pause/Play button */}
        <button 
          onClick={togglePause} 
          type="button"
          className="text-gray-600 hover:text-gray-900 hover:scale-110 transition-all p-2 border border-gray-200 rounded-full cursor-pointer select-none"
          aria-label={isPaused ? "Play" : "Pause"}
        >
          {isPaused ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>

        <div className="text-xs text-gray-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Hover og rull for å bla
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        
        <div className="flex border border-gray-200 rounded-md overflow-hidden">
          <button 
            onClick={increaseSpeed}
            type="button"
            className="px-3 py-1 text-xs bg-white hover:bg-gray-50 transition-colors text-gray-500 cursor-pointer select-none"
          >
            Raskere
          </button>
          <button 
            onClick={decreaseSpeed}
            type="button"
            className="px-3 py-1 text-xs bg-white hover:bg-gray-50 border-l border-gray-200 transition-colors text-gray-500 cursor-pointer select-none"
          >
            Saktere
          </button>
        </div>
      </div>
    </section>
  );
}