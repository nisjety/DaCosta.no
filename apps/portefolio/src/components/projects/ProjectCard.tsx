// src/components/projects/ProjectCard.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface ProjectCardProps {
  title: string;
  description: string;
  imageUrl: string;
  duration: string;
  tags: string[];
  demoUrl?: string;
  githubUrl?: string;
}

export default function ProjectCard({
  title,
  description,
  imageUrl,
  duration,
  tags,
  demoUrl,
  githubUrl,
}: ProjectCardProps) {
  return (
    <div className="flex-shrink-0 w-80 md:w-96 bg-white/20 backdrop-blur-lg rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border border-white/10">
      <div className="relative h-48 w-full overflow-hidden">
        <Image
          src={imageUrl || "https://via.placeholder.com/400x300"}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 400px"
          unoptimized={imageUrl.startsWith("http")}
        />
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{duration}</p>
        <p className="text-gray-700 mb-4">{description}</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag, index) => (
            <span 
              key={index} 
              className="px-3 py-1 bg-white/30 backdrop-blur-sm rounded-full text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="flex gap-4 mt-4">
          {demoUrl && (
            <Link 
              href={demoUrl} 
              target="_blank" 
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
            >
              Demo <ArrowUpRight size={16} />
            </Link>
          )}
          
          {githubUrl && (
            <Link 
              href={githubUrl} 
              target="_blank" 
              className="flex items-center gap-1 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Code <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}