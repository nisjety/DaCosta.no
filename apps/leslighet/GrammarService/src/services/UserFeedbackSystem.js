// src/grammar/services/UserFeedbackSystem.js
const FeedbackInterface = require('../interfaces/FeedbackInterface');
const fs = require('fs').promises;
const path = require('path');

class UserFeedbackSystem extends FeedbackInterface {
  constructor(options = {}) {
    super();
    this.feedbackData = {
      issues: new Map(),
      trustScores: new Map(),
      ignoredIssues: new Set(),
      enhancedIssues: new Map()
    };
    
    this.config = {
      minThreshold: options.minThreshold || 3,
      trustedUserMultiplier: options.trustedUserMultiplier || 3,
      maxNegativeFeedback: options.maxNegativeFeedback || 5,
      feedbackDecayDays: options.feedbackDecayDays || 90,
      trustScoreThreshold: options.trustScoreThreshold || 10,
      autoLearnThreshold: options.autoLearnThreshold || 5,
      dataPath: options.dataPath || path.join(process.cwd(), 'data/feedback')
    };
    
    this.initializeFeedbackData();
    this.saveInterval = setInterval(() => this.saveFeedbackData(), 1000 * 60 * 30);
  }

  async initializeFeedbackData() {
    try {
      await fs.mkdir(this.config.dataPath, { recursive: true });
      const filePath = path.join(this.config.dataPath, 'feedback_data.json');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (exists) {
        const rawData = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(rawData);
        this.feedbackData.issues = new Map(data.issues || []);
        this.feedbackData.trustScores = new Map(data.trustScores || []);
        this.feedbackData.ignoredIssues = new Set(data.ignoredIssues || []);
        this.feedbackData.enhancedIssues = new Map(data.enhancedIssues || []);
        console.log(`Loaded feedback data: ${this.feedbackData.issues.size} issues, ${this.feedbackData.trustScores.size} users`);
      } else {
        await fs.writeFile(filePath, JSON.stringify({}), 'utf8');
        console.log('Created new feedback data file.');
      }
    } catch (error) {
      console.error('Error initializing feedback data:', error);
      this.feedbackData = { issues: new Map(), trustScores: new Map(), ignoredIssues: new Set(), enhancedIssues: new Map() };
    }
  }

  async processFeedback(issueId, accepted, suggestion, userId) {
    const feedback = {
      userId: userId || 'anonymous',
      action: accepted ? 'accept' : 'reject',
      modification: suggestion,
      timestamp: Date.now()
    };
    return this.addFeedback(issueId, feedback);
  }

  async addFeedback(issueFingerprint, feedback) {
    if (!issueFingerprint || !feedback) {
      return { success: false, error: 'Invalid feedback data' };
    }
    
    try {
      const userId = feedback.userId || 'anonymous';
      const trustScore = this.getTrustScore(userId);
      const isTrusted = trustScore >= this.config.trustScoreThreshold;
      if (!this.feedbackData.issues.has(issueFingerprint)) {
        this.feedbackData.issues.set(issueFingerprint, []);
      }
      const issueFeedback = this.feedbackData.issues.get(issueFingerprint);
      const newFeedback = {
        userId,
        action: feedback.action,
        timestamp: feedback.timestamp,
        modification: feedback.modification,
        isTrusted
      };
      issueFeedback.push(newFeedback);
      this.updateTrustScore(userId, feedback.action);
      const shouldUpdate = this.evaluateFeedbackThreshold(issueFingerprint);
      if (shouldUpdate) {
        this.enhanceGrammarAnalysis(issueFingerprint, issueFeedback);
      }
      if (this.shouldIgnoreIssue(issueFingerprint)) {
        this.feedbackData.ignoredIssues.add(issueFingerprint);
      }
      return { success: true, trustedUser: isTrusted, thresholdReached: shouldUpdate };
    } catch (error) {
      console.error('Error processing feedback:', error);
      return { success: false, error: error.message };
    }
  }

  shouldIgnoreIssue(issueFingerprint) {
    if (this.feedbackData.ignoredIssues.has(issueFingerprint)) return true;
    const feedback = this.feedbackData.issues.get(issueFingerprint) || [];
    if (feedback.length === 0) return false;
    const negativeCount = feedback.filter(f => f.action === 'reject' || f.action === 'ignore').length;
    const ratio = negativeCount / feedback.length;
    return feedback.length >= this.config.minThreshold &&
           negativeCount >= this.config.maxNegativeFeedback &&
           ratio > 0.7;
  }

  enhanceGrammarAnalysis(issueFingerprint, feedback) {
    if (!feedback || feedback.length === 0) return;
    const modifications = feedback.filter(f => f.action === 'modify' && f.modification).map(f => f.modification);
    if (modifications.length === 0) return;
    const modificationCounts = new Map();
    let maxCount = 0;
    let bestModification = null;
    for (const mod of modifications) {
      const count = (modificationCounts.get(mod) || 0) + 1;
      modificationCounts.set(mod, count);
      if (count > maxCount) {
        maxCount = count;
        bestModification = mod;
      }
    }
    if (bestModification && maxCount >= 2) {
      this.feedbackData.enhancedIssues.set(issueFingerprint, {
        suggestion: bestModification,
        confidenceScore: 0.9,
        source: 'user_feedback'
      });
    }
  }

  getTrustScore(userId) {
    if (!userId) return 0;
    return this.feedbackData.trustScores.get(userId) || 0;
  }

  updateTrustScore(userId, action) {
    if (!userId) return;
    const currentScore = this.feedbackData.trustScores.get(userId) || 0;
    const adjustment = (action === 'accept' || action === 'modify') ? 1 : 0.5;
    this.feedbackData.trustScores.set(userId, currentScore + adjustment);
  }

  generateFingerprint(issueType, issueText) {
    return `${issueType}:${issueText.toLowerCase().trim()}`;
  }

  async saveFeedbackData() {
    try {
      const filePath = path.join(this.config.dataPath, 'feedback_data.json');
      const serializedData = {
        issues: Array.from(this.feedbackData.issues.entries()),
        trustScores: Array.from(this.feedbackData.trustScores.entries()),
        ignoredIssues: Array.from(this.feedbackData.ignoredIssues),
        enhancedIssues: Array.from(this.feedbackData.enhancedIssues.entries())
      };
      await fs.writeFile(filePath, JSON.stringify(serializedData, null, 2), 'utf8');
      console.log('Feedback data saved successfully');
    } catch (error) {
      console.error('Error saving feedback data:', error);
    }
  }

  cleanup() {
    clearInterval(this.saveInterval);
    this.saveFeedbackData();
  }

  enhanceGrammarResults(issues) {
    if (!issues || !Array.isArray(issues)) return issues;
    return issues.map(issue => {
      const fingerprint = this.generateFingerprint(issue.type, issue.issue);
      if (this.feedbackData.ignoredIssues.has(fingerprint)) return null;
      const enhancement = this.feedbackData.enhancedIssues.get(fingerprint);
      if (enhancement) {
        return {
          ...issue,
          suggestion: enhancement.suggestion,
          confidenceScore: enhancement.confidenceScore,
          source: enhancement.source,
          userFeedbackEnhanced: true
        };
      }
      return issue;
    }).filter(Boolean);
  }

  applyFeedback(issues) {
    return this.enhanceGrammarResults(issues);
  }
}

module.exports = UserFeedbackSystem;
