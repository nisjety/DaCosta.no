// src/grammar/services/ConfidenceManager.js
const ConfidenceManagerInterface = require('../interfaces/ConfidenceManagerInterface');

class ConfidenceManager extends ConfidenceManagerInterface {
  constructor(options = {}) {
    super();
    // Default thresholds (can be overridden)
    this.thresholds = {
      high: options.highThreshold || 0.85,
      medium: options.mediumThreshold || 0.75,
      low: options.lowThreshold || 0.65,
      verifyWithGpt: options.verifyThreshold || 0.60,
      hideBelow: options.hideThreshold || 0.50
    };

    // Base confidence scores by issue type
    this.baseConfidenceScores = {
      spacing: 0.95,
      punctuation: 0.85,
      article_error: 0.82,
      definite_form_error: 0.80,
      compound_word_error: 0.80,
      verb_conjugation: 0.75,
      noun_declension: 0.72,
      word_order_error: 0.70,
      passive_voice: 0.65,
      style_formality: 0.60,
      unknown: 0.50
    };

    // Context factors (positive or negative adjustments)
    this.contextFactors = {
      inQuote: -0.05,
      inHeading: -0.10,
      inList: -0.05,
      dialectSpecific: -0.15,
      technicalTerm: -0.20,
      properNoun: -0.25,
      multipleDetections: 0.15,
      confirmedByUser: 0.30,
      confirmedByGpt: 0.20
    };

    // Display categories for user-defined preferences
    this.displayCategories = {
      critical: ['article_error', 'compound_word_error', 'word_order_error'],
      standard: ['definite_form_error', 'verb_conjugation', 'noun_declension', 'punctuation'],
      all: ['passive_voice', 'style_formality']
    };

    // Statistics for adaptive thresholding
    this.statistics = {
      total: 0,
      accepted: 0,
      rejected: 0,
      byType: {}
    };
  }

  calculateConfidence(issue, context = {}) {
    if (!issue || !issue.type) return 0;
    const baseScore =
      issue.confidenceScore ||
      this.baseConfidenceScores[issue.type] ||
      this.baseConfidenceScores.unknown;

    let adjustments = 0;
    // Apply all context adjustments (both negative and positive)
    for (const [factor, value] of Object.entries(this.contextFactors)) {
      if (context[factor]) {
        adjustments += value;
      }
    }

    // Source-based adjustments
    if (issue.source === 'gpt') {
      adjustments += 0.10;
    } else if (issue.source === 'rule_based' && this.statistics.byType[issue.type]) {
      const typeStats = this.statistics.byType[issue.type];
      if (typeStats.total > 10) {
        const acceptanceRate = typeStats.accepted / typeStats.total;
        adjustments += (acceptanceRate - 0.5) * 0.2;
      }
    }

    // Severity adjustments
    if (issue.severity === 'high') adjustments += 0.05;
    else if (issue.severity === 'low') adjustments -= 0.05;

    const finalScore = Math.max(0, Math.min(1, baseScore + adjustments));
    return finalScore;
  }

  getDisplayDecision(issue, userLevel = 'standard') {
    if (!issue) return 'hide';
    const confidence = issue.confidenceScore;
    if (confidence >= this.thresholds.high) return 'show';
    if (confidence >= this.thresholds.medium) return 'suggest';
    if (confidence >= this.thresholds.verifyWithGpt) return 'verify';
    if (confidence < this.thresholds.hideBelow) return 'hide';
    if (userLevel === 'minimal' && !this.displayCategories.critical.includes(issue.type)) return 'hide';
    if (userLevel === 'standard' &&
        !this.displayCategories.critical.includes(issue.type) &&
        !this.displayCategories.standard.includes(issue.type)) {
      return 'hide';
    }
    return 'suggest';
  }

  filterIssues(issues, options = {}) {
    if (!Array.isArray(issues)) return { show: [], suggest: [], verify: [], hide: [] };
    const userLevel = options.userLevel || 'standard';
    const result = { show: [], suggest: [], verify: [], hide: [] };

    const issuesWithConfidence = issues.map(issue => {
      if (!issue.confidenceScore) {
        const context = options.context || {};
        issue.confidenceScore = this.calculateConfidence(issue, context);
      }
      return issue;
    });

    for (const issue of issuesWithConfidence) {
      const decision = this.getDisplayDecision(issue, userLevel);
      result[decision].push(issue);
    }
    return result;
  }

  updateStatistics(issue, accepted) {
    if (!issue || !issue.type) return;
    this.statistics.total++;
    if (accepted) this.statistics.accepted++;
    else this.statistics.rejected++;

    if (!this.statistics.byType[issue.type]) {
      this.statistics.byType[issue.type] = { total: 0, accepted: 0, rejected: 0 };
    }
    const typeStats = this.statistics.byType[issue.type];
    typeStats.total++;
    if (accepted) typeStats.accepted++;
    else typeStats.rejected++;

    this.adjustThresholds();
  }

  adjustThresholds() {
    if (this.statistics.total < 100) return;
    const overallAcceptanceRate = this.statistics.accepted / this.statistics.total;
    if (overallAcceptanceRate < 0.4 && this.thresholds.medium < 0.9) {
      this.thresholds.medium += 0.02;
      this.thresholds.low += 0.02;
      this.thresholds.verifyWithGpt += 0.02;
    }
    if (overallAcceptanceRate > 0.8 && this.thresholds.medium > 0.6) {
      this.thresholds.medium -= 0.01;
      this.thresholds.low -= 0.01;
      this.thresholds.verifyWithGpt -= 0.01;
    }
  }

  formatOutput(categorizedIssues, options = {}) {
    const results = [];
    if (categorizedIssues.show && Array.isArray(categorizedIssues.show)) {
      categorizedIssues.show.forEach(issue => {
        results.push({
          ...issue,
          confidenceLevel: 'high',
          presentationType: 'error',
          icon: '🔴'
        });
      });
    }
    if (options.showOptionalSuggestions !== false && 
        categorizedIssues.suggest && Array.isArray(categorizedIssues.suggest)) {
      categorizedIssues.suggest.forEach(issue => {
        results.push({
          ...issue,
          confidenceLevel: 'medium',
          presentationType: 'warning',
          icon: '🟠'
        });
      });
    }
    if (options.includeVerificationIssues === true && 
        categorizedIssues.verify && Array.isArray(categorizedIssues.verify)) {
      categorizedIssues.verify.forEach(issue => {
        results.push({
          ...issue,
          confidenceLevel: 'low',
          presentationType: 'info',
          needsVerification: true,
          icon: '🔵'
        });
      });
    }
    return results;
  }
}

module.exports = ConfidenceManager;
