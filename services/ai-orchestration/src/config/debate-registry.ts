import { DebateConfiguration } from '../communication/a2a-protocol.js';

/**
 * Maps analysis domains to their debate triads.
 * Each domain uses a 3-agent debate cycle: Analyzer -> Challenger -> Synthesizer
 */
export const DEBATE_TRIADS: Record<string, DebateConfiguration> = {
  security: {
    maxRounds: 3,
    convergenceThreshold: 0.8,
    roles: {
      analyzer: 'security_analyzer',
      challenger: 'security_challenger',
      synthesizer: 'security_synthesizer'
    }
  },
  performance: {
    maxRounds: 2,
    convergenceThreshold: 0.8,
    roles: {
      analyzer: 'performance_analyzer',
      challenger: 'performance_challenger',
      synthesizer: 'performance_synthesizer'
    }
  },
  documentation: {
    maxRounds: 3,
    convergenceThreshold: 0.9,
    roles: {
      analyzer: 'doc_drafter',
      challenger: 'doc_challenger',
      synthesizer: 'doc_synthesizer'
    }
  },
  dependency: {
    maxRounds: 2,
    convergenceThreshold: 0.8,
    roles: {
      analyzer: 'dependency_analyzer',
      challenger: 'dependency_challenger',
      synthesizer: 'dependency_synthesizer'
    }
  },
  doc_quality: {
    maxRounds: 2,
    convergenceThreshold: 0.8,
    roles: {
      analyzer: 'doc_quality_analyzer',
      challenger: 'doc_quality_challenger',
      synthesizer: 'doc_quality_synthesizer'
    }
  }
};

/**
 * Get the debate configuration for a given analysis domain
 */
export function getDebateConfig(domain: string): DebateConfiguration | null {
  return DEBATE_TRIADS[domain.toLowerCase()] || null;
}

/**
 * Get all registered debate domains
 */
export function getRegisteredDomains(): string[] {
  return Object.keys(DEBATE_TRIADS);
}
