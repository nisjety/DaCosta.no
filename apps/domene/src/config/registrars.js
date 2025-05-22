// src/config/registrars.js
// Defines registrar purchase URL generators

/**
 * URL generators for domain registrars
 * Each function accepts a domain name and returns a URL
 */
const registrarLinks = {
    // Major registrars
    GoDaddy: (domain) => `https://www.godaddy.com/domainsearch/find?domainToCheck=${domain}`,
    Namecheap: (domain) => `https://www.namecheap.com/domains/registration/results/?domain=${domain}`,
    Google: (domain) => `https://domains.google.com/registrar/search?searchTerm=${domain}`,
    NetworkSolutions: (domain) => `https://www.networksolutions.com/domain-name-registration/index.jsp?domainToCheck=${domain}`,
    
    // Other popular registrars
    NameSilo: (domain) => `https://www.namesilo.com/domain/search-domains?query=${domain}`,
    Hover: (domain) => `https://www.hover.com/domains/results?q=${domain}`,
    DreamHost: (domain) => `https://www.dreamhost.com/domains/search/?domain=${domain}`,
    Bluehost: (domain) => `https://www.bluehost.com/domains/search?domain=${domain}`,
    HostGator: (domain) => `https://www.hostgator.com/domains-search?domain=${domain}`,
    
    // International registrars
    Gandi: (domain) => `https://www.gandi.net/en/domain/check/${domain}`,
    OVH: (domain) => `https://www.ovh.com/world/domains/prices/?search=${domain}`,
    
    // Default fallback
    Default: (domain) => `https://domains.google.com/registrar/search?searchTerm=${domain}`
  };
  
  module.exports = registrarLinks;