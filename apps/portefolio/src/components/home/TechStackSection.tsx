"use client";

import React, { useEffect, useState } from "react";

interface TechItem {
  name: string;
  category: "frontend" | "backend" | "devops" | "database";
  icon: string;
  proficiency: number; // 1-5
}

const techItems: TechItem[] = [
  { name: "Java", category: "backend", icon: "☕", proficiency: 5 },
  { name: "JavaScript", category: "frontend", icon: "🟨", proficiency: 5 },
  { name: "C#", category: "backend", icon: "🔷", proficiency: 4 },
  { name: "Python", category: "backend", icon: "🐍", proficiency: 4 },
  { name: "React", category: "frontend", icon: "⚛️", proficiency: 5 },
  { name: "Next.js", category: "frontend", icon: "▲", proficiency: 5 },
  { name: "NestJS", category: "backend", icon: "🧠", proficiency: 4 },
  { name: "Spring Boot", category: "backend", icon: "🍃", proficiency: 5 },
  { name: "Node Express", category: "backend", icon: "🟢", proficiency: 4 },
  { name: "MongoDB", category: "database", icon: "🍃", proficiency: 4 },
  { name: "Redis", category: "database", icon: "🔴", proficiency: 4 },
  { name: "Docker", category: "devops", icon: "🐳", proficiency: 5 },
  { name: "Kafka", category: "devops", icon: "📬", proficiency: 4 },
  { name: "RabbitMQ", category: "devops", icon: "🐰", proficiency: 4 },
];

const TechStackSection = () => {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [visibleItems, setVisibleItems] = useState<TechItem[]>(techItems);
  const [isInView, setIsInView] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.1 }
    );
    
    const element = document.getElementById('tech-stack-section');
    if (element) {
      observer.observe(element);
    }
    
    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, []);
  
  useEffect(() => {
    if (activeCategory === "all") {
      setVisibleItems(techItems);
    } else {
      setVisibleItems(techItems.filter(item => item.category === activeCategory));
    }
  }, [activeCategory]);
  
  const categories = [
    { id: "all", label: "Alle" },
    { id: "frontend", label: "Frontend" },
    { id: "backend", label: "Backend" },
    { id: "database", label: "Database" },
    { id: "devops", label: "DevOps" }
  ];
  
  return (
    <section 
      id="tech-stack-section" 
      className="py-24 bg-gray-50 min-h-screen"
    >
      <div className="container mx-auto px-6 md:px-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Tech Stack</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Verktøy og teknologier jeg bruker for å bygge skalerbare, robuste og brukervennlige applikasjoner.
          </p>
        </div>
        
        {/* Category filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-5 py-2 rounded-full transition-colors ${
                activeCategory === category.id
                  ? "bg-black text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
        
        {/* Tech items grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {visibleItems.map((item, index) => (
            <div
              key={item.name}
              className={`
                bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-all
                ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
              `}
              style={{ 
                transitionDelay: `${index * 0.05}s`,
                transitionDuration: '0.5s'
              }}
            >
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="text-xl font-bold mb-2">{item.name}</h3>
              
              <div className="flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-black rounded-full h-2"
                    style={{ width: `${(item.proficiency / 5) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500">{item.proficiency}/5</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechStackSection;