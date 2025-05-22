// src/components/projects/ProjectsGallery.tsx
"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import ProjectCard from "./ProjectCard";

// Sample project data - replace with your actual projects
const projects = [
  {
    id: 0,
    title: "NettMonitor",
    description: "Real-time domain monitoring tool that watches availability and sends notifications when domains become available for registration. Features WebSocket connection for live updates.",
    imageUrl: "https://via.placeholder.com/400x300?text=NettMonitor",
    duration: "Ongoing",
    tags: ["Next.js", "TypeScript", "WebSockets", "API Integration", "Tailwind CSS"],
    demoUrl: "/nettMonitor",
    githubUrl: "https://github.com/yourusername/nett-monitor"
  },
  {
    id: 1,
    title: "Movie App",
    description: "A movie browsing application with glassmorphism UI, featuring search and watchlist functionality.",
    imageUrl: "https://via.placeholder.com/400x300?text=Movie+App",
    duration: "3 months",
    tags: ["React", "TypeScript", "Tailwind CSS", "API Integration"],
    demoUrl: "https://movie-app-demo.vercel.app",
    githubUrl: "https://github.com/yourusername/movie-app"
  },
  {
    id: 2,
    title: "E-commerce Platform",
    description: "Full-stack e-commerce solution with user authentication, product management, and payment processing.",
    imageUrl: "https://via.placeholder.com/400x300?text=E-commerce",
    duration: "6 months",
    tags: ["Next.js", "MongoDB", "Stripe", "Redux"],
    demoUrl: "https://ecommerce-demo.vercel.app",
    githubUrl: "https://github.com/yourusername/ecommerce"
  },
  {
    id: 3,
    title: "Portfolio Website",
    description: "Personal portfolio website with modern design, animations, and responsive layout.",
    imageUrl: "https://via.placeholder.com/400x300?text=Portfolio",
    duration: "2 months",
    tags: ["Next.js", "Framer Motion", "Tailwind CSS"],
    demoUrl: "https://portfolio-demo.vercel.app",
    githubUrl: "https://github.com/yourusername/portfolio"
  },
  {
    id: 4,
    title: "Task Management App",
    description: "Collaborative task management tool with real-time updates and team collaboration features.",
    imageUrl: "https://via.placeholder.com/400x300?text=Task+App",
    duration: "4 months",
    tags: ["React", "Firebase", "Redux", "Material UI"],
    demoUrl: "https://task-app-demo.vercel.app",
    githubUrl: "https://github.com/yourusername/task-app"
  },
  {
    id: 5,
    title: "Weather Dashboard",
    description: "Interactive weather dashboard with location-based forecasts and historical data visualization.",
    imageUrl: "https://via.placeholder.com/400x300?text=Weather+App",
    duration: "1 month",
    tags: ["React", "D3.js", "Weather API", "Styled Components"],
    demoUrl: "https://weather-app-demo.vercel.app",
    githubUrl: "https://github.com/yourusername/weather-app"
  }
];

export default function ProjectsGallery() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const cardWidth = container.querySelector('div')?.clientWidth || 400;
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
    
    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
    
    // Update button states after scrolling
    setTimeout(checkScrollButtons, 400);
  };

  return (
    <div className="relative w-full">
      {/* Glassmorphism container */}
      <div className="relative rounded-3xl bg-white/30 backdrop-blur-md p-8 border border-white/20 shadow-lg overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">My Projects</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`p-2 rounded-full ${
                canScrollLeft 
                ? 'bg-white/50 hover:bg-white/80 text-gray-800' 
                : 'bg-white/20 text-gray-400 cursor-not-allowed'
              } transition-colors`}
              aria-label="Scroll left"
            >
              <ArrowLeft size={20} />
            </button>
            <button 
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`p-2 rounded-full ${
                canScrollRight 
                ? 'bg-white/50 hover:bg-white/80 text-gray-800' 
                : 'bg-white/20 text-gray-400 cursor-not-allowed'
              } transition-colors`}
              aria-label="Scroll right"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
        
        {/* Scrollable projects container */}
        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-6 pb-4 -mx-4 px-4 scrollbar-hide snap-x"
          onScroll={checkScrollButtons}
        >
          {projects.map((project) => (
            <div key={project.id} className="snap-center">
              <ProjectCard
                title={project.title}
                description={project.description}
                imageUrl={project.imageUrl}
                duration={project.duration}
                tags={project.tags}
                demoUrl={project.demoUrl}
                githubUrl={project.githubUrl}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}