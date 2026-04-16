/**
 * BehaviorExportButton - Export behavioral specs in multiple formats
 *
 * Dropdown menu with options to export as Gherkin (.feature), Markdown (.md),
 * or full JSON report. Fetches data from backend and generates files client-side.
 */

import React, { useState } from 'react';
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  useToast,
} from '@chakra-ui/react';
import { Download, FileText, FileCode, Database, ChevronDown, FileOutput } from 'lucide-react';
import { exportReportPDF } from '../../utils/pdfExport';



interface BehaviorExportButtonProps {
  runId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateGherkinContent(specs: any): string {
  const features: string[] = [];

  // Frontend screens as features
  if (specs.frontend?.screens) {
    for (const screen of specs.frontend.screens) {
      const lines: string[] = [];
      lines.push(`Feature: ${screen.name}`);
      if (screen.description) {
        lines.push(`  ${screen.description}`);
      }
      lines.push('');

      for (const el of screen.elements || []) {
        lines.push(`  Scenario: ${el.name} - ${el.type}`);
        lines.push(`    Given the user is on the "${screen.name}" screen`);
        lines.push(`    Then they should see the "${el.name}" ${el.type}`);
        if (el.description) {
          lines.push(`    And it should ${el.description}`);
        }
        if (el.interactions) {
          for (const interaction of el.interactions) {
            lines.push(`    When the user ${interaction}`);
          }
        }
        lines.push('');
      }

      features.push(lines.join('\n'));
    }
  }

  // End-to-end flows as features
  if (specs.flows) {
    for (const flow of specs.flows) {
      const lines: string[] = [];
      lines.push(`Feature: ${flow.name}`);
      if (flow.description) {
        lines.push(`  ${flow.description}`);
      }
      lines.push('');
      lines.push(`  Scenario: ${flow.name} full flow`);

      for (const step of flow.steps || []) {
        const prefix = step.stepNumber === 1 ? 'Given' :
          step.stepNumber === (flow.steps?.length || 0) ? 'Then' : 'And';
        lines.push(`    ${prefix} [${step.layer}] ${step.action}`);
      }
      lines.push('');
      features.push(lines.join('\n'));
    }
  }

  return features.join('\n---\n\n');
}

function generateMarkdownContent(specs: any): string {
  const lines: string[] = [];

  lines.push('# Behavioral Documentation');
  lines.push('');
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('- [Frontend Screens](#frontend-screens)');
  lines.push('- [Backend Routes](#backend-routes)');
  lines.push('- [Middleware](#middleware)');
  lines.push('- [End-to-End Flows](#end-to-end-flows)');
  lines.push('- [Integration Audit](#integration-audit)');
  lines.push('');

  // Frontend
  lines.push('## Frontend Screens');
  lines.push('');
  if (specs.frontend?.screens) {
    for (const screen of specs.frontend.screens) {
      lines.push(`### ${screen.name}`);
      lines.push(`Path: \`${screen.path}\``);
      if (screen.description) lines.push(`\n${screen.description}`);
      lines.push('');
      lines.push('| Element | Type | Description |');
      lines.push('|---------|------|-------------|');
      for (const el of screen.elements || []) {
        lines.push(`| ${el.name} | ${el.type} | ${el.description || '--'} |`);
      }
      lines.push('');
    }
  } else {
    lines.push('No frontend screens documented.');
    lines.push('');
  }

  // Backend
  lines.push('## Backend Routes');
  lines.push('');
  if (specs.backend?.routes) {
    for (const rf of specs.backend.routes) {
      lines.push(`### ${rf.filePath}`);
      lines.push('');
      lines.push('| Method | Path | Description |');
      lines.push('|--------|------|-------------|');
      for (const ep of rf.endpoints || []) {
        lines.push(`| ${ep.method} | \`${ep.path}\` | ${ep.description || '--'} |`);
      }
      lines.push('');
    }
  } else {
    lines.push('No backend routes documented.');
    lines.push('');
  }

  // Middleware
  lines.push('## Middleware');
  lines.push('');
  if (specs.middleware?.global?.length) {
    lines.push('### Global Middleware');
    for (const mw of specs.middleware.global) {
      lines.push(`- **${mw.name}**: ${mw.description}`);
    }
    lines.push('');
  }
  if (specs.middleware?.perRoute?.length) {
    lines.push('### Per-Route Middleware');
    for (const mw of specs.middleware.perRoute) {
      const routes = (mw.appliesTo || []).map((r: string) => `\`${r}\``).join(', ');
      lines.push(`- **${mw.name}** (${routes}): ${mw.description}`);
    }
    lines.push('');
  }

  // Flows
  lines.push('## End-to-End Flows');
  lines.push('');
  if (specs.flows?.length) {
    for (const flow of specs.flows) {
      lines.push(`### ${flow.name}`);
      if (flow.description) lines.push(`\n${flow.description}`);
      lines.push('');
      for (const step of flow.steps || []) {
        lines.push(`${step.stepNumber}. **[${step.layer}]** ${step.action}`);
        if (step.filePath) lines.push(`   - File: \`${step.filePath}\``);
      }
      lines.push('');
    }
  } else {
    lines.push('No end-to-end flows documented.');
    lines.push('');
  }

  // Audit
  lines.push('## Integration Audit');
  lines.push('');
  if (specs.audit?.mismatches?.length) {
    for (const m of specs.audit.mismatches) {
      lines.push(`- **[${m.severity.toUpperCase()}]** ${m.description}`);
      if (m.suggestion) lines.push(`  - Suggestion: ${m.suggestion}`);
    }
  } else {
    lines.push('No integration mismatches detected.');
  }
  lines.push('');

  return lines.join('\n');
}

// ── Component ──────────────────────────────────────────────────────────────

export default function BehaviorExportButton({ runId }: BehaviorExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  async function fetchSpecs(): Promise<any | null> {
    if (false /* always use proxy */) return null;
    try {
      let effectiveRunId = runId;
      if (!effectiveRunId) {
        const runsRes = await fetch(`/qa/runs`);
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const completed = (runsData.runs || []).filter((r: any) => r.status === 'completed');
          if (completed[0]) effectiveRunId = completed[0]._key || completed[0].runId;
        }
      }
      if (!effectiveRunId) return null;

      // Skip behavioral-specs (404), go directly to product endpoint
      const response = await fetch(`/qa/product/${effectiveRunId}`);
      if (response.ok) {
        const data = await response.json();
        return data.behavioralSpecs || data.specs || data;
      }
    } catch { /* ignore */ }
    return null;
  }

  async function exportGherkin() {
    setExporting(true);
    try {
      const specs = await fetchSpecs();
      if (!specs) {
        toast({ title: 'No specs available', status: 'warning', duration: 3000 });
        return;
      }
      const content = generateGherkinContent(specs);
      downloadFile(content, 'behavioral-specs.feature', 'text/plain');
      toast({ title: 'Gherkin exported', status: 'success', duration: 2000 });
    } catch {
      toast({ title: 'Export failed', status: 'error', duration: 3000 });
    } finally {
      setExporting(false);
    }
  }

  async function exportMarkdown() {
    setExporting(true);
    try {
      const specs = await fetchSpecs();
      if (!specs) {
        toast({ title: 'No specs available', status: 'warning', duration: 3000 });
        return;
      }
      const content = generateMarkdownContent(specs);
      downloadFile(content, 'behavioral-docs.md', 'text/markdown');
      toast({ title: 'Markdown exported', status: 'success', duration: 2000 });
    } catch {
      toast({ title: 'Export failed', status: 'error', duration: 3000 });
    } finally {
      setExporting(false);
    }
  }

  async function exportJSON() {
    setExporting(true);
    try {
      const specs = await fetchSpecs();
      if (!specs) {
        toast({ title: 'No specs available', status: 'warning', duration: 3000 });
        return;
      }
      const content = JSON.stringify(specs, null, 2);
      downloadFile(content, 'behavioral-report.json', 'application/json');
      toast({ title: 'JSON exported', status: 'success', duration: 2000 });
    } catch {
      toast({ title: 'Export failed', status: 'error', duration: 3000 });
    } finally {
      setExporting(false);
    }
  }

  async function exportPDF() {
    setExporting(true);
    try {
      let effectiveRunId = runId;
      if (!effectiveRunId) {
        const runsRes = await fetch('/qa/runs');
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const completed = (runsData.runs || []).filter((r: any) => r.status === 'completed');
          if (completed[0]) effectiveRunId = completed[0]._key || completed[0].runId;
        }
      }
      if (!effectiveRunId) {
        toast({ title: 'No run available for export', status: 'warning', duration: 3000 });
        return;
      }
      // Fetch product intelligence for the report
      const res = await fetch(`/qa/product/${effectiveRunId}`);
      if (!res.ok) throw new Error('Failed to fetch report data');
      const product = await res.json();
      const summary = product.summary || {};
      const unified = summary.unifiedHealthScore || {};

      // Fetch run details
      const runRes = await fetch(`/qa/runs/${effectiveRunId}`);
      const runData = runRes.ok ? await runRes.json() : {};

      exportReportPDF({
        repoUrl: runData.repoUrl || 'Unknown',
        branch: runData.branch || 'main',
        date: new Date(runData.startedAt || Date.now()).toLocaleString(),
        healthScore: unified.score ?? null,
        grade: unified.grade || 'N/A',
        testsGenerated: runData.testsGenerated || 0,
        testsPassed: runData.testsPassed || 0,
        mutationScore: runData.mutationScore || 0,
        breakdown: unified.breakdown
          ? Object.fromEntries(Object.entries(unified.breakdown).map(([k, v]: [string, any]) => [k, v.score]))
          : {},
        findings: (product.codeQuality?.findings || []).slice(0, 20).map((f: any) => ({
          severity: f.severity || 'medium',
          title: f.title || f.description || 'Finding',
          description: f.description || '',
          file: f.file || f.location || '',
        })),
        actionItems: (product.codeQuality?.actionItems || product.actionItems || []).slice(0, 10).map((a: any) => ({
          priority: a.priority || a.severity || 'medium',
          title: a.title || a.description || 'Action',
          effort: a.effort || 'Unknown',
        })),
      });
      toast({ title: 'PDF exported', status: 'success', duration: 2000 });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast({ title: 'PDF export failed', status: 'error', duration: 3000 });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Menu>
      <MenuButton
        as={Button}
        size="xs"
        variant="outline"
        colorScheme="teal"
        rightIcon={<ChevronDown size={12} />}
        leftIcon={<Download size={12} />}
        isLoading={exporting}
      >
        Export
      </MenuButton>
      <MenuList>
        <MenuItem icon={<FileCode size={14} />} onClick={exportGherkin} fontSize="sm">
          Export Gherkin (.feature)
        </MenuItem>
        <MenuItem icon={<FileText size={14} />} onClick={exportMarkdown} fontSize="sm">
          Export Documentation (.md)
        </MenuItem>
        <MenuItem icon={<Database size={14} />} onClick={exportJSON} fontSize="sm">
          Export Full Report (.json)
        </MenuItem>
        <MenuItem icon={<FileOutput size={14} />} onClick={exportPDF} fontSize="sm">
          Export PDF Report (.pdf)
        </MenuItem>
      </MenuList>
    </Menu>
  );
}
