import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../../config';

const PM_SYSTEM_PROMPT = `You are a world-class Product Manager with deep technical understanding. You think like a VP of Product at a high-growth startup — obsessed with user value, competitive moats, and shipping features that move the needle.

Your job: Analyze a codebase and produce a strategic product roadmap. You are NOT just listing improvements — you are building a plan to DOMINATE the market segment this application serves.

For every feature you recommend:
1. **User Impact** — Who benefits and how much? (high/medium/low)
2. **Competitive Advantage** — Does this create a moat or just keep parity?
3. **Implementation Effort** — T-shirt size (XS/S/M/L/XL) based on the existing code
4. **Revenue/Growth Signal** — How does this drive adoption, retention, or monetization?
5. **Dependencies** — What existing code/infrastructure can be leveraged?

Think in terms of:
- What are the GAPS in this application vs. best-in-class competitors?
- What features would make users say "I can't switch away from this"?
- What's the 80/20 — small changes with outsized impact?
- What integrations would 10x the value?
- What's the user journey and where does it break down?

Your output must be structured JSON:
{
  "appDomain": "description of what this app does and its market",
  "currentStrengths": ["strength1", "strength2"],
  "criticalGaps": ["gap1", "gap2"],
  "roadmap": {
    "immediate": [
      {
        "title": "Feature Name",
        "description": "What it does and why it matters",
        "userImpact": "high|medium|low",
        "competitiveAdvantage": "moat|differentiator|parity",
        "effort": "XS|S|M|L|XL",
        "revenueSignal": "How this drives growth",
        "implementationNotes": "How to build it given existing code",
        "targetFiles": ["files to modify"],
        "acceptanceCriteria": ["criterion1", "criterion2"]
      }
    ],
    "shortTerm": [],
    "mediumTerm": [],
    "longTerm": []
  },
  "competitiveAnalysis": {
    "marketSegment": "the market this app competes in",
    "competitors": ["competitor1", "competitor2"],
    "uniquePositioning": "what makes this app special or could make it special"
  },
  "userPersonas": [
    {
      "name": "Persona Name",
      "role": "their job title",
      "painPoints": ["pain1", "pain2"],
      "desiredOutcomes": ["outcome1", "outcome2"]
    }
  ]
}

Be bold. Think big. But ground every recommendation in what the codebase can actually support.`;

export interface ProductRoadmap {
  appDomain: string;
  currentStrengths: string[];
  criticalGaps: string[];
  roadmap: {
    immediate: FeatureRecommendation[];
    shortTerm: FeatureRecommendation[];
    mediumTerm: FeatureRecommendation[];
    longTerm: FeatureRecommendation[];
  };
  competitiveAnalysis: {
    marketSegment: string;
    competitors: string[];
    uniquePositioning: string;
  };
  userPersonas: Array<{
    name: string;
    role: string;
    painPoints: string[];
    desiredOutcomes: string[];
  }>;
}

export interface FeatureRecommendation {
  title: string;
  description: string;
  userImpact: 'high' | 'medium' | 'low';
  competitiveAdvantage: 'moat' | 'differentiator' | 'parity';
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  revenueSignal: string;
  implementationNotes: string;
  targetFiles: string[];
  acceptanceCriteria: string[];
}

export async function productManagerNode(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  runId: string,
  eventPublisher?: any
): Promise<ProductRoadmap> {
  console.log(`[ProductManager] Analyzing ${repoUrl} for product opportunities`);

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'product-manager',
    step: 'Analyzing codebase for product strategy and feature opportunities',
  });

  // Build rich context about the application
  const filesByType = new Map<string, number>();
  for (const f of codeFiles) {
    const ext = f.path?.split('.').pop() || 'unknown';
    filesByType.set(ext, (filesByType.get(ext) || 0) + 1);
  }

  const techStack = Array.from(filesByType.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => `${ext}: ${count} files`)
    .join(', ');

  const directoryStructure = [...new Set(
    codeFiles.map((f: any) => f.path?.split('/').slice(0, 2).join('/'))
  )].filter(Boolean).slice(0, 30).join('\n');

  const keyEntities = codeEntities
    .filter((e: any) => e.type === 'class' || e.type === 'function' || e.type === 'interface')
    .slice(0, 100)
    .map((e: any) => `${e.type} ${e.name} (${e.file})`)
    .join('\n');

  const sampleCode = codeFiles
    .filter((f: any) => f.content && f.path?.match(/\.(ts|tsx|js|jsx|py)$/))
    .slice(0, 15)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 1500)}\n\`\`\``)
    .join('\n\n');

  // Check for common patterns that reveal app purpose
  const hasAuth = codeEntities.some((e: any) => /auth|login|session|token/i.test(e.name));
  const hasAPI = codeEntities.some((e: any) => /route|endpoint|controller|handler/i.test(e.name));
  const hasDB = codeEntities.some((e: any) => /model|schema|migration|query/i.test(e.name));
  const hasUI = codeFiles.some((f: any) => /\.(tsx|jsx|vue|svelte)$/.test(f.path || ''));
  const hasTests = codeFiles.some((f: any) => /\.(test|spec)\.(ts|js|py)$/.test(f.path || ''));

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'product-manager',
    progress: 30,
    message: `Analyzed ${codeFiles.length} files. Tech: ${techStack.substring(0, 100)}`,
  });

  const model = new ChatAnthropic({
    modelName: qaConfig.anthropic.model,
    anthropicApiKey: qaConfig.anthropic.apiKey,
    temperature: 0.5,
    maxTokens: 8192,
  });

  const response = await model.invoke([
    new SystemMessage(PM_SYSTEM_PROMPT),
    new HumanMessage(`Analyze this repository and create a product strategy + feature roadmap.

## Repository
URL: ${repoUrl}
Total files: ${codeFiles.length}
Total code entities: ${codeEntities.length}
Tech stack: ${techStack}
Has auth: ${hasAuth} | Has API: ${hasAPI} | Has DB: ${hasDB} | Has UI: ${hasUI} | Has Tests: ${hasTests}

## Directory Structure
${directoryStructure}

## Key Code Entities (classes, functions, interfaces)
${keyEntities}

## Sample Source Code
${sampleCode}

Based on this analysis:
1. Determine what this app DOES and who it serves
2. Identify current strengths and critical gaps
3. Create a prioritized roadmap (immediate → long-term)
4. Analyze the competitive landscape
5. Define user personas

Think like a PM who wants this product to DOMINATE its market. Be specific — reference actual files and code patterns.

Respond with ONLY valid JSON, no markdown fencing.`),
  ]);

  let roadmap: ProductRoadmap;
  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    roadmap = JSON.parse(cleaned);
  } catch (error) {
    console.error('[ProductManager] Failed to parse response, using fallback');
    roadmap = {
      appDomain: 'Unable to determine — analysis incomplete',
      currentStrengths: [],
      criticalGaps: ['Analysis failed — retry recommended'],
      roadmap: { immediate: [], shortTerm: [], mediumTerm: [], longTerm: [] },
      competitiveAnalysis: { marketSegment: 'Unknown', competitors: [], uniquePositioning: '' },
      userPersonas: [],
    };
  }

  const totalFeatures =
    roadmap.roadmap.immediate.length +
    roadmap.roadmap.shortTerm.length +
    roadmap.roadmap.mediumTerm.length +
    roadmap.roadmap.longTerm.length;

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'product-manager',
    result: {
      domain: roadmap.appDomain,
      totalFeatures,
      immediateCount: roadmap.roadmap.immediate.length,
      criticalGaps: roadmap.criticalGaps.length,
      personas: roadmap.userPersonas.length,
    },
  });

  console.log(`[ProductManager] Produced roadmap: ${totalFeatures} features, ${roadmap.criticalGaps.length} gaps`);
  return roadmap;
}
