"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";

interface Project {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  image: string;
  year: string;
}

const projects: Project[] = [
  {
    id: 1,
    title: "DaApp",
    description: "En fullstack applikasjon for prosjektstyring med real-time oppdateringer.",
    technologies: ["React", "Node.js", "MongoDB", "Socket.io"],
    image: "/project1.jpg",
    year: "2024"
  },
  {
    id: 2,
    title: "Cloud System",
    description: "Skalerbar cloud-løsning for dataanalyse med høy ytelse.",
    technologies: ["Docker", "Kubernetes", "Redis", "Kafka"],
    image: "/project2.jpg",
    year: "2023"
  },
  {
    id: 3,
    title: "Fintech API",
    description: "Sikker og rask API for finansielle transaksjoner med komplett logging.",
    technologies: ["Spring Boot", "PostgreSQL", "RabbitMQ", "JWT"],
    image: "/project3.jpg",
    year: "2023"
  }
];

const ProjectsSection = () => {
  const timelineRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleScroll = () => {
      const projects = document.querySelectorAll('.project-card');
      
      projects.forEach((project) => {
        const rect = project.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom >= 0;
        
        if (isVisible) {
          project.classList.add('opacity-100', 'translate-y-0');
          project.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check on load
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <section className="py-24 bg-white min-h-screen" id="projects">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row">
          {/* Timeline */}
          <div className="md:w-1/3 lg:w-1/4 mb-12 md:mb-0">
            <div ref={timelineRef} className="sticky top-24">
              <h2 className="text-4xl font-bold mb-6">Prosjekter</h2>
              <p className="text-gray-600 mb-8">
                En oversikt over mine mest relevante prosjekter, organisert etter år.
              </p>
              
              <div className="space-y-6">
                {['2024', '2023', '2022'].map((year) => (
                  <div key={year} className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-black mr-3"></div>
                    <span className="text-lg font-medium">{year}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Projects */}
          <div className="md:w-2/3 lg:w-3/4 md:pl-12">
            <div className="space-y-24">
              {projects.map((project) => (
                <div 
                  key={project.id}
                  className="project-card transition-all duration-700 opacity-0 translate-y-10 grid md:grid-cols-2 gap-8"
                >
                  <div className="order-2 md:order-1">
                    <span className="text-sm text-gray-500 mb-2 block">{project.year}</span>
                    <h3 className="text-3xl font-bold mb-4">{project.title}</h3>
                    <p className="text-gray-700 mb-6">{project.description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-8">
                      {project.technologies.map((tech) => (
                        <span 
                          key={tech} 
                          className="bg-gray-100 px-3 py-1 rounded-full text-sm"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                    
                    <button className="group flex items-center font-medium">
                      <span>Se detaljer</span>
                      <svg 
                        className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" 
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
                    </button>
                  </div>
                  
                  <div className="relative h-72 md:h-auto order-1 md:order-2 overflow-hidden rounded-lg shadow-lg">
                    <div className="absolute inset-0 bg-black/10"></div>
                    <Image
                      src={project.image}
                      alt={project.title}
                      layout="fill"
                      objectFit="cover"
                      className="transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProjectsSection;