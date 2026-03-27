import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../../config';
import type { ProductRoadmap } from './product-manager';

const RESEARCH_SYSTEM_PROMPT = `You are an elite technology research analyst — the kind of person VCs call to understand emerging markets. Your specialty is identifying technology trends, frameworks, and approaches that can give a product an unfair competitive advantage.

Your job: Given an app's domain and the Product Manager's roadmap, research the latest trends, technologies, and competitive landscape to find opportunities that would help this app MONOPOLIZE its market segment.

Think about:
1. **Emerging Technologies** — New frameworks, libraries, APIs, or AI capabilities that are gaining traction in this domain
2. **Market Trends** — Where is this industry heading? What do users expect in 2025-2026?
3. **Competitive Intelligence** — What are the top competitors doing? What features are they shipping?
4. **Integration Opportunities** — What platforms, APIs, or ecosystems should this app plug into?
5. **AI/ML Opportunities** — Where can AI add the most value to this specific type of application?
6. **Regulatory/Compliance** — Any upcoming requirements that could be turned into a feature advantage?
7. **Community/Ecosystem** — Open-source projects, standards, or communities to leverage
8. **Monetization Insights** — How do successful apps in this space make money?

For each insight:
- Be SPECIFIC — name real technologies, real companies, real trends
- Include WHY this matters for THIS specific app
- Suggest how to implement it given the existing codebase
- Rate the opportunity (game-changer / significant / nice-to-have)

Your output must be structured JSON:
{
  "domainAnalysis": {
    "industry": "the industry/domain",
    "marketSize": "estimated market context",
    "growthDirection": "where the market is heading",
    "keyDrivers": ["driver1", "driver2"]
  },
  "trendInsights": [
    {
      "trend": "Trend Name",
      "category": "ai|integration|ux|infrastructure|security|compliance|monetization",
      "description": "What this trend is and why it matters",
      "relevance": "game-changer|significant|nice-to-have",
      "implementationPath": "How to leverage this in the app",
      "examples": ["Company/product using this successfully"],
      "timeframe": "now|6months|1year|2years",
      "effort": "XS|S|M|L|XL"
    }
  ],
  "competitorIntel": [
    {
      "competitor": "Company/Product Name",
      "strengths": ["what they do well"],
      "weaknesses": ["where they fall short"],
      "recentMoves": ["recent feature launches or pivots"],
      "threatLevel": "high|medium|low"
    }
  ],
  "monopolyStrategies": [
    {
      "strategy": "Strategy Name",
      "description": "How this creates a defensible moat",
      "type": "network-effect|data-moat|integration-lock-in|switching-cost|ecosystem",
      "feasibility": "high|medium|low",
      "implementation": "Concrete steps to execute"
    }
  ],
  "enhancementRecommendations": [
    {
      "title": "Enhancement Name",
      "description": "What to build and why",
      "basedOn": "Which trend/insight this comes from",
      "priority": "critical|high|medium|low",
      "estimatedImpact": "Description of expected outcome",
      "technologiesNeeded": ["tech1", "tech2"]
    }
  ]
}

Be bold and forward-thinking. The goal is to make this app the ONLY choice in its category.`;

export interface ResearchInsights {
  domainAnalysis: {
    industry: string;
    marketSize: string;
    growthDirection: string;
    keyDrivers: string[];
  };
  trendInsights: TrendInsight[];
  competitorIntel: CompetitorIntel[];
  monopolyStrategies: MonopolyStrategy[];
  enhancementRecommendations: EnhancementRecommendation[];
}

export interface TrendInsight {
  trend: string;
  category: string;
  description: string;
  relevance: 'game-changer' | 'significant' | 'nice-to-have';
  implementationPath: string;
  examples: string[];
  timeframe: string;
  effort: string;
}

export interface CompetitorIntel {
  competitor: string;
  strengths: string[];
  weaknesses: string[];
  recentMoves: string[];
  threatLevel: 'high' | 'medium' | 'low';
}

export interface MonopolyStrategy {
  strategy: string;
  description: string;
  type: string;
  feasibility: 'high' | 'medium' | 'low';
  implementation: string;
}

export interface EnhancementRecommendation {
  title: string;
  description: string;
  basedOn: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: string;
  technologiesNeeded: string[];
}

export async function researchAssistantNode(
  productRoadmap: ProductRoadmap,
  codeFiles: any[],
  repoUrl: string,
  runId: string,
  eventPublisher?: any
): Promise<ResearchInsights> {
  console.log(`[ResearchAssistant] Researching trends for domain: ${productRoadmap.appDomain}`);

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'research-assistant',
    step: `Researching latest trends for: ${productRoadmap.appDomain}`,
  });

  // Gather tech stack details for targeted research
  const techStack = new Set<string>();
  for (const f of codeFiles) {
    const ext = f.path?.split('.').pop();
    if (ext) techStack.add(ext);
  }

  // Look for specific frameworks/libraries in package files
  const packageFiles = codeFiles.filter((f: any) =>
    f.path?.match(/package\.json|requirements\.txt|Cargo\.toml|go\.mod|pom\.xml/)
  );
  const packageContext = packageFiles
    .slice(0, 3)
    .map((f: any) => `### ${f.path}\n${(f.content || '').substring(0, 2000)}`)
    .join('\n\n');

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'research-assistant',
    progress: 20,
    message: `Analyzing domain: ${productRoadmap.appDomain}. Competitors: ${productRoadmap.competitiveAnalysis.competitors.join(', ')}`,
  });

  const model = new ChatAnthropic({
    modelName: qaConfig.anthropic.model,
    anthropicApiKey: qaConfig.anthropic.apiKey,
    temperature: 0.6,
    maxTokens: 8192,
  });

  const response = await model.invoke([
    new SystemMessage(RESEARCH_SYSTEM_PROMPT),
    new HumanMessage(`Research the latest trends and competitive landscape for this application.

## App Domain
${productRoadmap.appDomain}

## Current Strengths
${productRoadmap.currentStrengths.map(s => `- ${s}`).join('\n')}

## Critical Gaps Identified by PM
${productRoadmap.criticalGaps.map(g => `- ${g}`).join('\n')}

## Competitive Analysis (from PM)
Market: ${productRoadmap.competitiveAnalysis.marketSegment}
Competitors: ${productRoadmap.competitiveAnalysis.competitors.join(', ')}
Current Positioning: ${productRoadmap.competitiveAnalysis.uniquePositioning}

## User Personas
${productRoadmap.userPersonas.map(p => `- ${p.name} (${p.role}): Pain points — ${p.painPoints.join(', ')}`).join('\n')}

## PM's Immediate Roadmap
${productRoadmap.roadmap.immediate.map(f => `- ${f.title}: ${f.description} [${f.effort}]`).join('\n')}

## Tech Stack
Languages: ${Array.from(techStack).join(', ')}
Repo: ${repoUrl}

## Package/Dependency Context
${packageContext}

Based on ALL of this context, research and recommend:
1. Emerging technology trends that could give this app an unfair advantage
2. Competitive intelligence — what are competitors doing and where are they weak?
3. Monopoly strategies — how to create defensible moats
4. Specific enhancements that leverage current trends to dominate this market

Be specific. Name real technologies, real companies, real trends from 2024-2026.
The goal is to make this app the UNDISPUTED leader in: ${productRoadmap.competitiveAnalysis.marketSegment}

Respond with ONLY valid JSON, no markdown fencing.`),
  ]);

  let insights: ResearchInsights;
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    insights = JSON.parse(cleaned);
  } catch (error) {
    console.error('[ResearchAssistant] Failed to parse response');
    insights = {
      domainAnalysis: {
        industry: productRoadmap.appDomain,
        marketSize: 'Unknown',
        growthDirection: 'Analysis failed',
        keyDrivers: [],
      },
      trendInsights: [],
      competitorIntel: [],
      monopolyStrategies: [],
      enhancementRecommendations: [],
    };
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'research-assistant',
    result: {
      trendsFound: insights.trendInsights.length,
      gameChangers: insights.trendInsights.filter(t => t.relevance === 'game-changer').length,
      competitors: insights.competitorIntel.length,
      monopolyStrategies: insights.monopolyStrategies.length,
      enhancements: insights.enhancementRecommendations.length,
    },
  });

  console.log(
    `[ResearchAssistant] Found ${insights.trendInsights.length} trends, ` +
    `${insights.monopolyStrategies.length} monopoly strategies, ` +
    `${insights.enhancementRecommendations.length} enhancements`
  );

  return insights;
}
