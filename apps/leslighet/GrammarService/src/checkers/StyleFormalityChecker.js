// src/checkers/StyleFormalityChecker.js
/**
 * Checks for style formality issues in text
 */
class StyleFormalityChecker {
  constructor(repository = null) {
    this.repository = repository;
    
    // Default patterns if repository doesn't provide any
    this.formalPatterns = [
      /\bDe\b(?!\s+(?:som|er|har|var))/i,
      /\bDeres\b/i,
      /\bformelt\b/i,
      /\bhøflig\b/i
    ];
    
    this.informalPatterns = [
      /\bdu\b(?!\s+(?:som|er|har|var))/i,
      /\bdeg\b/i,
      /\bditt?\b/i,
      /\buformelt\b/i,
      /\bslang\b/i
    ];
  }

  async check(text, dialect, options = {}) {
    if (!text) return [];

    const issues = [];
    
    // Try to get patterns from repository
    try {
      if (this.repository && typeof this.repository.getFormalityPatterns === 'function') {
        const formalPatterns = this.repository.getFormalityPatterns('formal');
        const informalPatterns = this.repository.getFormalityPatterns('informal');
        
        if (formalPatterns && formalPatterns.length > 0) {
          this.formalPatterns = formalPatterns;
        }
        
        if (informalPatterns && informalPatterns.length > 0) {
          this.informalPatterns = informalPatterns;
        }
      }
    } catch (error) {
      console.error('Error getting formality patterns from repository:', error);
    }
    
    // Skip text in quotes for analysis
    const textWithoutQuotes = text.replace(/"[^"]*"/g, '');
    
    // Look for formal address 'De' (capitalized) and informal address 'du'
    const hasCapitalizedDe = /\bDe\b(?!\s+(?:som|er|har|var))/i.test(textWithoutQuotes);
    const hasLowercaseDu = /\bdu\b(?!\s+(?:som|er|har|var))/i.test(textWithoutQuotes);
    
    // When both are present, they represent mixed formality already
    if (hasCapitalizedDe && hasLowercaseDu) {
      // Add mixed formality level issue
      issues.push({
        type: 'style_formality',
        position: 0,
        issue: 'Mixed formality levels',
        explanation: 'Text mixes formal and informal language styles inconsistently.',
        severity: 'low',
        isInformational: true
      });
      
      // Add inconsistent address forms issue
      issues.push({
        type: 'style_formality',
        position: 0,
        issue: 'Inconsistent address forms',
        explanation: 'Mixing formal "De" and informal "du" is inconsistent.',
        severity: 'medium',
        isInformational: true
      });
      
      return issues;
    }
    
    // Count formal and informal markers for other cases
    let formalCount = 0;
    let informalCount = 0;
    
    for (const pattern of this.formalPatterns) {
      const matches = textWithoutQuotes.match(pattern);
      if (matches) {
        formalCount += matches.length;
      }
    }
    
    for (const pattern of this.informalPatterns) {
      const matches = textWithoutQuotes.match(pattern);
      if (matches) {
        informalCount += matches.length;
      }
    }

    // Check for mixed formal and informal language styles
    if (formalCount >= 1 && informalCount >= 2) {
      issues.push({
        type: 'style_formality',
        position: 0,
        issue: 'Mixed formality levels',
        explanation: 'Text mixes formal and informal language styles inconsistently.',
        severity: 'low',
        isInformational: true
      });
    }
    
    return issues;
  }
}

module.exports = StyleFormalityChecker;