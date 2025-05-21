'use client';

import React from 'react';

export default function AboutContent() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12 w-full">
      {/* Left Column - First Row */}
      <div>
        <h2 className="font-bold text-lg mb-3">04 / 1997</h2>
        <p className="text-gray-800">
          Ima ble født i Angola i april 1997 og vokste opp i en familie der teknologi alltid var en sentral interesse. Han har hatt en naturlig nysgjerrighet for IT helt fra barndommen.
        </p>
      </div>
      
      {/* Right Column - First Row */}
      <div>
        <h2 className="font-bold text-lg mb-3">KARRIERE</h2>
        <p className="text-gray-800">
          Ima er nå på utkikk etter en rolle som backend-utvikler, der han kan jobbe med å utvikle skalerbare microservices, API-er og skybaserte løsninger. Han har erfaring med blant annet Node.js, Express.js, Python og MongoDB, og er alltid nysgjerrig på nye teknologier. Ima er kjent for sin evne til å tenke helhetlig, samarbeide effektivt i team og tilpasse seg raskt i et dynamisk arbeidsmiljø.
        </p>
      </div>
      
      {/* Left Column - Second Row */}
      <div>
        <h2 className="font-bold text-lg mb-3">UTDANNING</h2>
        <p className="text-gray-800">
          Ima studerte IT-programmering ved Høyskolen Kristiania i Oslo fra 2022 til 2025. Under studietiden jobbet han som teknisk support hos Telenor, hvor han utviklet sterke ferdigheter innen kundebehandling og teknisk problemløsning.
        </p>
      </div>
      
      {/* Right Column - Second Row */}
      <div>
        <h2 className="font-bold text-lg mb-3">ARBEID</h2>
        <p className="text-gray-800">
          Han spesialiserer seg på utvikling med Node.js, Next.js og Python, og har bygget robuste og ytelsesorienterte løsninger med fokus på pålitelighet og skalerbarhet.
        </p>
      </div>
    </div>
  );
}