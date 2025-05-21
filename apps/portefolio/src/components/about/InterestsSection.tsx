'use client';

import React from 'react';

export default function InterestsSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 w-full">
      <div>
        <h2 className="font-bold text-lg mb-3">INTERESSER</h2>
        <p className="text-gray-800">
          Ima er lidenskapelig opptatt av teknologi, koding og systemdesign. Han bruker mye av fritiden på å utforske nye språk, rammeverk og bygge egne prosjekter som utfordrer og utvikler ferdighetene hans.
        </p>
      </div>
      
      <div>
        <h2 className="font-bold text-lg mb-3">FRITID</h2>
        <p className="text-gray-800">
          Ved siden av teknologien liker han å trene, reise og utforske nye matkulturer. Ima har også interesse for kunst, design og fotografering, og finner inspirasjon i visuell kreativitet.
        </p>
      </div>
    </div>
  );
}