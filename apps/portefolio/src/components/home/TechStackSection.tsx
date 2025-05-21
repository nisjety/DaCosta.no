"use client";

import React, { useEffect, useState, useRef } from "react";
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
  { name: "Github",        category: "devops",   logo: "/logos/github.svg" },
  { name: "bitbucket",  category: "devops",   logo: "/logos/bitbucket.svg" },
  { name: "Docker",     category: "devops",   logo: "/logos/Docker.svg" },
  { name: "Kafka",      category: "devops",   logo: "/logos/Kafka.svg" },
  { name: "RabbitMQ",   category: "devops",   logo: "/logos/rabbitmq.svg" },
];

export default function TechStackSection() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [visibleItems, setVisibleItems] = useState<TechItem[]>(techItems);
  const [loopItems, setLoopItems] = useState<TechItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false); // Track hover state separately
  const [scrollSpeed, setScrollSpeed] = useState(2); // Default speed in pixels per frame
  const [scrollProgress, setScrollProgress] = useState(0); // For scroll bar position
  const [currentPosition, setCurrentPosition] = useState(0); // Track current position
  const containerRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const scrollBarContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingScrollBarRef = useRef(false);
  const isDraggingMarqueeRef = useRef(false);

  // Filter on category
  useEffect(() => {
    setVisibleItems(
      activeCategory === "all"
        ? techItems
        : techItems.filter((t) => t.category === activeCategory)
    );
  }, [activeCategory]);

  // Build loopItems so that 80vw is always filled
  useEffect(() => {
    const buildLoop = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      // card width 112px + gap 24px = 136px
      const perItem = 112 + 24;
      // how many items fit in view
      const needed = Math.ceil(containerWidth / perItem) + 1;
      // how many times to replicate visibleItems
      const repCount = Math.ceil(needed / visibleItems.length);
      const extended = Array(repCount).fill(visibleItems).flat();
      // mirror it for seamless scroll
      setLoopItems([...extended, ...extended]);
    };

    buildLoop();
    window.addEventListener("resize", buildLoop);
    return () => window.removeEventListener("resize", buildLoop);
  }, [visibleItems]);

  // Calculate normalized scroll progress based on current position
  const calculateScrollProgress = React.useCallback((position: number): number => {
    if (!marqueeRef.current || !containerRef.current) return 0;
    
    const totalWidth = marqueeRef.current.scrollWidth / 2;
    const containerWidth = containerRef.current.clientWidth;
    
    // Need to handle when position is negative (which is normal during scrolling)
    // Calculate what percentage through the content we are
    let normalizedPos = (Math.abs(position) % totalWidth) / (totalWidth - containerWidth);
    
    // Ensure the value is between 0 and 1
    normalizedPos = Math.max(0, Math.min(normalizedPos, 1));
    
    return normalizedPos * 100;
  }, []);

  // Set custom animation position with transform
  const setPosition = React.useCallback((pos: number): void => {
    if (!marqueeRef.current) return;
    
    // Store the current position for reference
    setCurrentPosition(pos);
    
    // Apply the transform directly
    marqueeRef.current.style.transform = `translateX(${pos}px)`;
    
    // Update the scroll bar indicator position
    setScrollProgress(calculateScrollProgress(pos));
  }, [calculateScrollProgress]);

  // Manual scroll control when hovering
  useEffect(() => {
    const marqueeElement = marqueeRef.current;
    if (!marqueeElement) return;

    // Track mouse position and movement for drag scrolling
    let startX = 0;
    let animationFrame: number;
    let lastTimestamp = 0;

    // Animation loop for smooth scrolling
    const animate = (timestamp: number): void => {
      // If we haven't recorded a timestamp yet, just save it and continue
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
        animationFrame = requestAnimationFrame(animate);
        return;
      }
      
      // Calculate time elapsed since last frame in ms
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      
      // Only move if not paused or dragging
      if (!isDraggingMarqueeRef.current && !isDraggingScrollBarRef.current && !isPaused && !isHovered) {
        // Calculate position based on time for smoother animation
        // Use the stored currentPosition instead of a local variable
        const newPosition = currentPosition - scrollSpeed * (elapsed / 16);
        setPosition(newPosition);
      }
      
      // Reset position for infinite loop when needed
      const marqueeWidth = marqueeElement.scrollWidth / 2;
      if (currentPosition <= -marqueeWidth) {
        setPosition(currentPosition + marqueeWidth);
      }
      
      animationFrame = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrame = requestAnimationFrame(animate);

    // Mouse event handlers for marquee
    const handleMouseDown = (e: MouseEvent): void => {
      if (!marqueeElement || isDraggingScrollBarRef.current) return;
      isDraggingMarqueeRef.current = true;
      startX = e.pageX;
      marqueeElement.style.cursor = 'grabbing';
      // Pause while dragging but don't change isPaused state
      lastTimestamp = 0;
    };

    const handleMouseUp = (): void => {
      isDraggingMarqueeRef.current = false;
      if (marqueeElement) {
        marqueeElement.style.cursor = 'grab';
      }
      // Reset timestamp for smooth continuation
      lastTimestamp = 0;
    };

    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDraggingMarqueeRef.current || isDraggingScrollBarRef.current) return;
      e.preventDefault();
      
      const x = e.pageX;
      const walk = (x - startX);
      startX = x;
      
      // Update position based on mouse movement
      setPosition(currentPosition + walk);
    };

    // Add all event listeners for marquee
    marqueeElement.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrame);
      marqueeElement.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isPaused, isHovered, scrollSpeed, currentPosition, setPosition]); // Include all dependencies

  // Handle scrollbar drag functionality
  useEffect(() => {
    const scrollBar = scrollBarRef.current;
    const scrollBarContainer = scrollBarContainerRef.current;
    if (!scrollBar || !scrollBarContainer || !marqueeRef.current) return;

    let startX = 0;
    let startScrollProgress = 0;

    const handleScrollBarMouseDown = (e: MouseEvent): void => {
      e.preventDefault();
      isDraggingScrollBarRef.current = true;
      startX = e.clientX;
      startScrollProgress = scrollProgress;
      document.body.style.cursor = 'grabbing';
    };

    const handleScrollBarContainerMouseDown = (e: MouseEvent): void => {
      if (e.target !== scrollBarContainer) return;
      
      const containerRect = scrollBarContainer.getBoundingClientRect();
      const clickPosition = (e.clientX - containerRect.left) / containerRect.width * 100;
      
      // Update scroll position directly
      setScrollProgress(clickPosition);
      updateMarqueePositionFromScrollBar(clickPosition);
    };

    const handleDocumentMouseMove = (e: MouseEvent): void => {
      if (!isDraggingScrollBarRef.current) return;
      
      const containerRect = scrollBarContainer.getBoundingClientRect();
      const deltaX = e.clientX - startX;
      const deltaPercent = (deltaX / containerRect.width) * 100;
      
      const newScrollProgress = Math.max(0, Math.min(100, startScrollProgress + deltaPercent));
      setScrollProgress(newScrollProgress);
      
      // Update carousel position based on scroll bar
      updateMarqueePositionFromScrollBar(newScrollProgress);
    };

    const handleDocumentMouseUp = (): void => {
      if (isDraggingScrollBarRef.current) {
        isDraggingScrollBarRef.current = false;
        document.body.style.cursor = '';
      }
    };

    const updateMarqueePositionFromScrollBar = (progress: number): void => {
      const marqueeElement = marqueeRef.current;
      if (!marqueeElement || !containerRef.current) return;
      
      const totalWidth = marqueeElement.scrollWidth / 2;
      const containerWidth = containerRef.current.clientWidth;
      
      // Calculate the new position based on scroll progress
      // When progress is 0, position should be 0
      // When progress is 100, position should be -(totalWidth - containerWidth)
      const newPosition = -((progress / 100) * (totalWidth - containerWidth));
      
      // Update position
      setCurrentPosition(newPosition);
      marqueeElement.style.transform = `translateX(${newPosition}px)`;
    };

    // Add event listeners
    scrollBar.addEventListener('mousedown', handleScrollBarMouseDown);
    scrollBarContainer.addEventListener('mousedown', handleScrollBarContainerMouseDown);
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      scrollBar.removeEventListener('mousedown', handleScrollBarMouseDown);
      scrollBarContainer.removeEventListener('mousedown', handleScrollBarContainerMouseDown);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [scrollProgress]);

  // Function to scroll in the desired direction when paused
  const scrollToDirection = (direction: 'left' | 'right'): void => {
    const marqueeElement = marqueeRef.current;
    if (!marqueeElement || !containerRef.current) return;
    
    const scrollAmount = direction === 'left' ? 300 : -300;
    const newPosition = currentPosition + scrollAmount;
    
    // Update the position state and apply transform
    setPosition(newPosition);
  };

  // Handle pause/play toggle
  const togglePause = (): void => {
    setIsPaused(prev => !prev);
  };

  // Handle card mouse enter/leave
  const handleCardMouseEnter = (): void => {
    setIsHovered(true);
  };

  const handleCardMouseLeave = (): void => {
    setIsHovered(false);
  };

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
              onClick={() => setActiveCategory(cat.id)}
              className={`px-5 py-2 text-sm rounded-full transition-all ${
                activeCategory === cat.id
                  ? "bg-gray-800 text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:shadow-sm"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Marquee slider in a centered box */}
      <div 
        className="relative h-[20vh] flex items-center justify-center overflow-hidden bg-white py-6"
      >
        {/* Enhanced top and bottom borders with subtle fade */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        
        <div
          ref={containerRef}
          className="w-[80vw] overflow-hidden relative mb-4"
        >
          <div 
            ref={marqueeRef}
            className="flex gap-6 whitespace-nowrap cursor-grab py-2 transition-transform duration-300 ease-linear"
          >
            {loopItems.map((tech, idx) => (
              <div
                key={`${tech.name}-${idx}`}
                className={`flex-shrink-0 w-28 h-28 bg-white border border-gray-100 rounded-lg flex flex-col items-center justify-center p-2 hover:shadow-md transition-all duration-300 hover:border-gray-200 ${(isPaused || isHovered) ? '' : 'opacity-80'} hover:opacity-100`}
                onMouseEnter={handleCardMouseEnter}
                onMouseLeave={handleCardMouseLeave}
              >
                <div className="w-10 h-10 relative mb-2">
                  <Image
                    src={tech.logo}
                    alt={`${tech.name} logo`}
                    fill
                    className={`object-contain transition-all duration-300 ${(isPaused || isHovered) ? '' : 'grayscale'} hover:grayscale-0`}
                  />
                </div>
                <span className="text-xs font-medium text-gray-400 hover:text-gray-900 transition-colors duration-300">{tech.name}</span>
              </div>
            ))}
          </div>
          {/* Enhanced fading effects on left and right sides */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white via-white/90 to-transparent pointer-events-none z-10"></div>
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white via-white/90 to-transparent pointer-events-none z-10"></div>
        </div>
      </div>

      {/* Visual scrolling hint and controls */}
      <div className="flex flex-col items-center gap-4 mt-2">
        {/* Visual scroll bar indicator - now draggable */}
        <div 
          ref={scrollBarContainerRef}
          className="w-[80vw] h-3 bg-gray-200 rounded-full overflow-hidden relative mb-4 cursor-pointer"
        >
          <div
            ref={scrollBarRef} 
            className="h-full bg-gray-500 absolute left-0 transition-all duration-150 ease-out rounded-full cursor-grab hover:bg-gray-600 active:cursor-grabbing"
            style={{ 
              width: `${Math.max(5, Math.min(20, 100 / (loopItems.length / 8)))}%`, 
              left: `${scrollProgress}%` 
            }}
          ></div>
        </div>
        
        {/* Controls row */}
        <div className="flex justify-center gap-4 items-center">
          {/* Direction controls */}
          <div className="flex gap-3">
            <button 
              onClick={() => scrollToDirection('left')} 
              className="text-gray-600 hover:text-gray-900 hover:scale-110 transition-all p-2 border border-gray-200 rounded-full"
              aria-label="Scroll left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Pause/Play button */}
            <button 
              onClick={togglePause} 
              className="text-gray-600 hover:text-gray-900 hover:scale-110 transition-all p-2 border border-gray-200 rounded-full"
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
            
            <button 
              onClick={() => scrollToDirection('right')} 
              className="text-gray-600 hover:text-gray-900 hover:scale-110 transition-all p-2 border border-gray-200 rounded-full"
              aria-label="Scroll right"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="text-xs text-gray-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            Dra for å bla
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button 
              onClick={() => setScrollSpeed(prev => Math.min(prev + 0.5, 4))} 
              className="px-3 py-1 text-xs bg-white hover:bg-gray-50 transition-colors text-gray-500"
            >
              Raskere
            </button>
            <button 
              onClick={() => setScrollSpeed(prev => Math.max(prev - 0.5, 0.5))} 
              className="px-3 py-1 text-xs bg-white hover:bg-gray-50 border-l border-gray-200 transition-colors text-gray-500"
            >
              Saktere
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}