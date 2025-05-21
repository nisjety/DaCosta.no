'use client';

import React, { useState } from 'react';

export default function ContactContent() {
  const [showPhone, setShowPhone] = useState(false);
  
  return (
    <div className="grid md:grid-cols-3 gap-8 px-4 md:px-8 pb-16 w-full max-w-4xl">
      {/* Left column - JOBBFORESPØRSLER */}
      <div className="booking-section">
        <h2 className="text-xs uppercase mb-6 font-semibold tracking-wider text-gray-700">JOBBFORESPØRSLER:</h2>
        <p className="mb-2 text-lg">Ima Da Costa</p>
        <p className="mb-2 text-lg">Oslo, Norge</p>
      </div>
      
      {/* Right column - KONTAKT */}
      <div className="contact-section text-left md:text-right col-span-2">
        <h2 className="text-xs uppercase mb-6 font-semibold tracking-wider text-gray-700">KONTAKT:</h2>
        <p className="mb-2 text-lg">
          <a href="mailto:ima@dacosta.no" className="hover:underline transition-colors hover:text-black">
            ima@dacosta.no
          </a>
        </p>
        <p 
          className="mb-2 text-lg cursor-pointer transition-colors hover:text-black"
          onMouseEnter={() => setShowPhone(true)}
          onMouseLeave={() => setShowPhone(false)}
        >
          {showPhone ? '+47 123 45 678' : '••• •• •• •••'}
        </p>
        
        <div className="mt-16">
          <h2 className="text-xs uppercase mb-6 font-semibold tracking-wider text-gray-700">SOSIALE MEDIER:</h2>
          <p className="mb-2 text-lg">
            <a href="https://github.com/imadacosta" target="_blank" rel="noopener noreferrer" className="hover:underline transition-colors hover:text-black">
              GitHub
            </a>
          </p>
          <p className="mb-2 text-lg">
            <a href="https://linkedin.com/in/imadacosta" target="_blank" rel="noopener noreferrer" className="hover:underline transition-colors hover:text-black">
              LinkedIn
            </a>
          </p>
          <p className="mb-2 text-lg">
            <a href="https://instagram.com/imadacosta" target="_blank" rel="noopener noreferrer" className="hover:underline transition-colors hover:text-black">
              Instagram
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}