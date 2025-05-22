// src/components/projects/ProjectsLayout.tsx
"use client";

import { useState } from "react";
import ProjectsGallery from "./ProjectsGallery";

// Categories for filtering projects (optional)
const categories = [
  { id: "all", name: "All Projects" },
  { id: "web", name: "Web Development" },
  { id: "mobile", name: "Mobile Apps" },
  { id: "design", name: "UI/UX Design" },
];

export default function ProjectsLayout() {
  const [activeCategory, setActiveCategory] = useState("all");

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Background */}
      <div className="relative h-[50vh] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
        <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] opacity-20"></div>
        <div className="container mx-auto h-full flex flex-col justify-center items-center px-4 text-white relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-center">My Projects</h1>
          <p className="text-xl md:text-2xl max-w-2xl text-center">
            A showcase of my work, side projects, and explorations in design and development.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        {/* Filter Categories (Optional) */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-800"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Projects Gallery with Glassmorphism */}
        <ProjectsGallery />

        {/* Additional Projects Info */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-semibold mb-4">Want to see more?</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            These are just highlights of my work. Check out my GitHub profile for more projects,
            experiments, and contributions to open source.
          </p>
          <a
            href="https://github.com/yourusername"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            View My GitHub
          </a>
        </div>
      </div>
    </div>
  );
}