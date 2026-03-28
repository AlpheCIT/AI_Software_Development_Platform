import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qaConfig } from '../../config';
import { persistConversation } from '../persist-conversation';
import { throttledInvoke, createModel } from '../llm-throttle';
import { packageExistsInManifests } from './verification-helpers.js';

const UI_UX_SYSTEM_PROMPT = `You are a senior UI/UX auditor and accessibility specialist. Your job is to analyze React/frontend code for usability issues, accessibility violations, and UX anti-patterns.

Analyze the codebase for:

1. **Accessibility Issues (WCAG 2.1)**
   - Missing aria-labels on interactive elements
   - Missing alt text on images
   - Insufficient color contrast (check for hardcoded colors)
   - Missing keyboard navigation (no tabIndex, no onKeyDown)
   - Missing focus indicators
   - Form inputs without labels

2. **UX Anti-Patterns**
   - Missing loading states (API calls without spinners/skeletons)
   - Missing error boundaries
   - Missing empty states (no data → blank screen)
   - Missing confirmation dialogs for destructive actions
   - Inconsistent styling (mixing px and rem, multiple color systems)
   - Missing responsive breakpoints

3. **Component Quality**
   - Components over 200 lines (too complex)
   - Missing PropTypes or TypeScript types
   - Hardcoded strings instead of i18n
   - Inline styles vs design tokens
   - Missing memoization for expensive renders

4. **User Flow Issues**
   - Dead-end pages (no navigation back)
   - Missing breadcrumbs in deep navigation
   - Forms without validation feedback
   - Actions without success/error feedback
   - Missing tooltips on icon-only buttons

Output format — respond with ONLY valid JSON:
{
  "accessibilityIssues": [
    {
      "file": "path/to/file",
      "type": "missing-aria|missing-alt|color-contrast|keyboard-nav|focus-indicator|form-label",
      "element": "the element or component",
      "severity": "critical|high|medium|low",
      "wcagCriteria": "WCAG criteria violated",
      "fix": "specific fix"
    }
  ],
  "uxAntiPatterns": [
    {
      "file": "path/to/file",
      "pattern": "missing-loading|missing-error-boundary|missing-empty-state|missing-confirmation|inconsistent-styling|missing-responsive",
      "description": "what's wrong",
      "userImpact": "how users are affected",
      "fix": "how to fix"
    }
  ],
  "componentIssues": [
    {
      "file": "path/to/file",
      "component": "component name",
      "issue": "description",
      "severity": "critical|high|medium|low",
      "fix": "how to fix"
    }
  ],
  "userFlowIssues": [
    {
      "flow": "description of the user flow",
      "issue": "what breaks or is confusing",
      "affectedFiles": ["files"],
      "fix": "how to fix"
    }
  ],
  "suggestions": [
    {
      "title": "improvement title",
      "description": "what to do",
      "category": "accessibility|usability|performance|aesthetics",
      "effort": "XS|S|M|L|XL",
      "impact": "high|medium|low"
    }
  ],
  "accessibilityScore": 0-100,
  "uxScore": 0-100,
  "summary": "One-paragraph summary"
}`;

export interface UIAuditReport {
  accessibilityIssues: Array<{
    file: string;
    type: string;
    element: string;
    severity: string;
    wcagCriteria: string;
    fix: string;
  }>;
  uxAntiPatterns: Array<{
    file: string;
    pattern: string;
    description: string;
    userImpact: string;
    fix: string;
  }>;
  componentIssues: Array<{
    file: string;
    component: string;
    issue: string;
    severity: string;
    fix: string;
  }>;
  userFlowIssues: Array<{
    flow: string;
    issue: string;
    affectedFiles: string[];
    fix: string;
  }>;
  suggestions: Array<{
    title: string;
    description: string;
    category: string;
    effort: string;
    impact: string;
  }>;
  accessibilityScore: number;
  uxScore: number;
  summary: string;
}

export async function uiUxAnalystNode(
  codeFiles: any[],
  codeEntities: any[],
  repoUrl: string,
  runId: string,
  dbClient?: any,
  eventPublisher?: any
): Promise<UIAuditReport> {
  console.log(`[UIUXAnalyst] Auditing UI/UX for ${repoUrl}`);

  eventPublisher?.emit('qa:agent.started', {
    runId,
    agent: 'ui-ux-analyst',
    step: 'Analyzing React components for accessibility, UX patterns, and user flows',
  });

  // Find UI component files
  const componentFiles = codeFiles.filter((f: any) =>
    f.path?.match(/\.(tsx|jsx)$/) && f.content
  );

  const componentContext = componentFiles
    .slice(0, 25)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 2000)}\n\`\`\``)
    .join('\n\n');

  // CSS/style files
  const styleFiles = codeFiles.filter((f: any) =>
    f.path?.match(/\.(css|scss|less)$/) || f.path?.match(/theme|tokens|design/)
  );
  const styleContext = styleFiles
    .slice(0, 5)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 1500)}\n\`\`\``)
    .join('\n\n');

  // Route/navigation files
  const routeFiles = codeFiles.filter((f: any) =>
    f.content?.match(/Route|Router|navigate|Link|useNavigate/i) &&
    f.path?.match(/\.(tsx|jsx|ts|js)$/)
  );
  const routeContext = routeFiles
    .slice(0, 5)
    .map((f: any) => `### ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 1500)}\n\`\`\``)
    .join('\n\n');

  // Detect UI framework to reduce false positives about built-in a11y
  const hasChakra = packageExistsInManifests(codeFiles, '@chakra-ui/react');
  const hasMUI = packageExistsInManifests(codeFiles, '@mui/material');
  const hasAntD = packageExistsInManifests(codeFiles, 'antd');
  const hasRadix = packageExistsInManifests(codeFiles, '@radix-ui/react-dialog') ||
                   packageExistsInManifests(codeFiles, '@radix-ui/themes');
  const hasHeadlessUI = packageExistsInManifests(codeFiles, '@headlessui/react');

  let frameworkContext = '';
  if (hasChakra) {
    frameworkContext += '\nIMPORTANT: This project uses Chakra UI which provides built-in accessibility (FormControl/FormLabel auto-associates, Button has proper ARIA, Modal handles focus trap, etc.). Do NOT report missing ARIA labels for Chakra components that handle this automatically.\n';
  }
  if (hasMUI) {
    frameworkContext += '\nIMPORTANT: This project uses Material-UI (MUI) which provides built-in accessibility for most components (TextField has label association, Button/IconButton have ARIA support, Dialog handles focus trap). Do NOT report missing ARIA labels for MUI components.\n';
  }
  if (hasAntD) {
    frameworkContext += '\nIMPORTANT: This project uses Ant Design which provides built-in accessibility for form controls, modals, and interactive elements. Do NOT report missing ARIA labels for Ant Design components.\n';
  }
  if (hasRadix || hasHeadlessUI) {
    frameworkContext += '\nIMPORTANT: This project uses a headless UI library (Radix/Headless UI) that provides built-in accessibility. Do NOT report missing ARIA labels for these components.\n';
  }

  // Track which framework components are used
  const detectedFrameworks: string[] = [];
  if (hasChakra) detectedFrameworks.push('Chakra UI');
  if (hasMUI) detectedFrameworks.push('Material-UI');
  if (hasAntD) detectedFrameworks.push('Ant Design');
  if (hasRadix) detectedFrameworks.push('Radix UI');
  if (hasHeadlessUI) detectedFrameworks.push('Headless UI');

  eventPublisher?.emit('qa:agent.progress', {
    runId,
    agent: 'ui-ux-analyst',
    progress: 25,
    message: `Found ${componentFiles.length} UI components, ${styleFiles.length} style files, ${routeFiles.length} route files` +
      (detectedFrameworks.length > 0 ? `. UI frameworks: ${detectedFrameworks.join(', ')}` : ''),
  });

  const model = createModel({ temperature: 0.3, maxTokens: 8192 });

  const userMessage = `Audit this React frontend for accessibility, UX patterns, and user flow issues.

## Repository: ${repoUrl}
UI Components: ${componentFiles.length}
Style Files: ${styleFiles.length}
Route Files: ${routeFiles.length}
${detectedFrameworks.length > 0 ? `UI Frameworks: ${detectedFrameworks.join(', ')}` : ''}
${frameworkContext}
## React Components
${componentContext}

## Styles/Theme
${styleContext || '(none found)'}

## Routes/Navigation
${routeContext || '(none found)'}

## UI Entities
${codeEntities.filter((e: any) => e.file?.match(/\.(tsx|jsx)$/)).slice(0, 40).map((e: any) => `${e.type} ${e.name} (${e.file})`).join('\n')}

Audit for:
1. WCAG 2.1 accessibility violations
2. UX anti-patterns (missing loading states, error boundaries, empty states)
3. Component quality issues (oversized, missing types, hardcoded strings)
4. User flow problems (dead ends, missing feedback)
5. Suggestions for improvement

Respond with ONLY valid JSON, no markdown fencing.`;

  const startMs = Date.now();
  const response = await throttledInvoke(model, [
    new SystemMessage(UI_UX_SYSTEM_PROMPT),
    new HumanMessage(userMessage),
  ], 'ui-ux-analyst', eventPublisher, runId);
  const durationMs = Date.now() - startMs;

  const responseText = typeof response.content === 'string' ? response.content : '';
  if (dbClient) {
    persistConversation(dbClient, {
      runId,
      agent: 'ui-ux-analyst',
      systemPrompt: UI_UX_SYSTEM_PROMPT,
      userMessage,
      response: responseText,
      tokensUsed: { input: (response as any).usage_metadata?.input_tokens, output: (response as any).usage_metadata?.output_tokens },
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  let report: UIAuditReport;
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    report = JSON.parse(cleaned);
  } catch {
    console.error('[UIUXAnalyst] Failed to parse response');
    report = {
      accessibilityIssues: [],
      uxAntiPatterns: [],
      componentIssues: [],
      userFlowIssues: [],
      suggestions: [],
      accessibilityScore: 0,
      uxScore: 0,
      summary: 'Analysis failed — retry recommended',
    };
  }

  // --- PASS 2: Programmatic verification — filter framework-handled a11y issues ---
  const preVerifyA11y = (report.accessibilityIssues || []).length;

  // Ensure arrays exist
  report.accessibilityIssues = report.accessibilityIssues || [];
  report.uxAntiPatterns = report.uxAntiPatterns || [];
  report.componentIssues = report.componentIssues || [];
  report.userFlowIssues = report.userFlowIssues || [];
  report.suggestions = report.suggestions || [];

  // Chakra UI components that handle a11y automatically
  const chakraA11yComponents = [
    'Button', 'IconButton', 'FormControl', 'FormLabel', 'Input', 'Select',
    'Checkbox', 'Radio', 'Switch', 'Slider', 'Modal', 'ModalOverlay',
    'ModalContent', 'Drawer', 'Menu', 'MenuButton', 'MenuItem',
    'Popover', 'Tooltip', 'Tabs', 'Tab', 'Accordion', 'Alert',
    'AlertDialog', 'Toast', 'useToast',
  ];

  // MUI components that handle a11y automatically
  const muiA11yComponents = [
    'Button', 'IconButton', 'TextField', 'Select', 'Checkbox', 'Radio',
    'Switch', 'Slider', 'Dialog', 'Menu', 'MenuItem', 'Popover',
    'Tooltip', 'Tabs', 'Tab', 'Accordion', 'Alert', 'Snackbar',
    'FormControl', 'InputLabel', 'FormControlLabel',
  ];

  if (hasChakra || hasMUI || hasAntD || hasRadix || hasHeadlessUI) {
    const frameworkComponents = [
      ...(hasChakra ? chakraA11yComponents : []),
      ...(hasMUI ? muiA11yComponents : []),
    ];

    report.accessibilityIssues = report.accessibilityIssues.filter(issue => {
      // Check if the issue references a framework component that handles a11y automatically
      const element = (issue.element || '').toLowerCase();
      const isFrameworkHandled = frameworkComponents.some(comp =>
        element.includes(comp.toLowerCase()) ||
        element.includes(`<${comp.toLowerCase()}`)
      );

      if (isFrameworkHandled && (issue.type === 'missing-aria' || issue.type === 'form-label' || issue.type === 'focus-indicator')) {
        console.log(`[UIUXAnalyst] Filtered: ${issue.element} in ${issue.file} - handled by UI framework`);
        return false;
      }

      // Also check if the referenced file actually uses a framework component
      if (issue.file && (issue.type === 'missing-aria' || issue.type === 'form-label')) {
        const normalizedPath = issue.file.replace(/\\/g, '/');
        const matchingFile = codeFiles.find(f =>
          f.path && f.path.replace(/\\/g, '/').endsWith(normalizedPath)
        );
        if (matchingFile?.content) {
          const usesFramework =
            (hasChakra && matchingFile.content.includes('@chakra-ui')) ||
            (hasMUI && matchingFile.content.includes('@mui/')) ||
            (hasAntD && matchingFile.content.includes('antd')) ||
            (hasRadix && matchingFile.content.includes('@radix-ui'));
          if (usesFramework) {
            console.log(`[UIUXAnalyst] Filtered: ${issue.type} in ${issue.file} - file uses UI framework with built-in a11y`);
            return false;
          }
        }
      }

      return true;
    });
  }

  // Recalculate accessibility score
  const filteredA11yCount = preVerifyA11y - report.accessibilityIssues.length;
  if (filteredA11yCount > 0) {
    report.accessibilityScore = Math.max(report.accessibilityScore, Math.round(100 - report.accessibilityIssues.length * 3));
    console.log(`[UIUXAnalyst] Verification pass filtered ${filteredA11yCount} framework-handled a11y false positives`);
    report.summary = `[Verified] ${report.summary} (${filteredA11yCount} false positives removed — UI framework handles a11y)`;
  }

  eventPublisher?.emit('qa:agent.completed', {
    runId,
    agent: 'ui-ux-analyst',
    result: {
      accessibilityIssues: report.accessibilityIssues.length,
      uxAntiPatterns: report.uxAntiPatterns.length,
      componentIssues: report.componentIssues.length,
      userFlowIssues: report.userFlowIssues.length,
      suggestions: report.suggestions.length,
      accessibilityScore: report.accessibilityScore,
      uxScore: report.uxScore,
    },
  });

  console.log(
    `[UIUXAnalyst] A11y: ${report.accessibilityScore}/100, UX: ${report.uxScore}/100. ` +
    `${report.accessibilityIssues.length} a11y issues, ${report.uxAntiPatterns.length} anti-patterns`
  );
  return report;
}
