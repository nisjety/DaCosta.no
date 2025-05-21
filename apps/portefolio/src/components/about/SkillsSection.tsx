'use client';

import React from 'react';

export default function SkillsSection() {
  const skills = [
    { name: 'JavaScript', level: 90 },
    { name: 'TypeScript', level: 85 },
    { name: 'Node.js', level: 88 },
    { name: 'React', level: 82 },
    { name: 'Next.js', level: 80 },
    { name: 'Express', level: 85 },
    { name: 'MongoDB', level: 75 },
    { name: 'Python', level: 70 },
  ];

  return (
    <>
      <h2 className="text-2xl font-bold mb-8 text-center">Tekniske ferdigheter</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {skills.map((skill) => (
          <div key={skill.name} className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="font-medium text-sm">{skill.name}</span>
              <span className="text-sm text-gray-500">{skill.level}%</span>
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-black h-full" 
                style={{ width: `${skill.level}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Docker', 'Git', 'CI/CD', 'RESTful APIs', 'GraphQL', 'AWS', 'Microservices', 'TDD'].map((tool) => (
          <div key={tool} className="text-center p-3 border border-gray-200 rounded-lg">
            <p className="text-sm font-medium">{tool}</p>
          </div>
        ))}
      </div>
    </>
  );
}