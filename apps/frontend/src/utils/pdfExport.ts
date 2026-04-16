/**
 * PDF Report Export — generates a branded QA Intelligence report as PDF.
 * All data comes from real analysis stored in ArangoDB.
 */
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ReportData {
  repoUrl: string;
  branch: string;
  date: string;
  healthScore: number | null;
  grade: string;
  testsGenerated: number;
  testsPassed: number;
  mutationScore: number;
  breakdown: Record<string, number>;
  findings: { severity: string; title: string; description: string; file?: string }[];
  actionItems: { priority: string; title: string; effort: string }[];
}

export function exportReportPDF(data: ReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFontSize(22);
  doc.setTextColor(66, 66, 66);
  doc.text('QA Intelligence Report', 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Repository: ${data.repoUrl} (${data.branch})`, 20, y);
  y += 6;
  doc.text(`Generated: ${data.date}`, 20, y);
  y += 6;
  doc.text('AI Software Development Platform — All findings from real analysis', 20, y);
  y += 12;

  // ── Health Score Summary ────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(20, y, pageWidth - 40, 30, 3, 3, 'FD');

  doc.setFontSize(14);
  doc.setTextColor(66, 66, 66);
  doc.text('Code Health', 30, y + 12);

  doc.setFontSize(24);
  const gradeColor = data.grade === 'A' ? [34, 197, 94] :
    data.grade === 'B' ? [59, 130, 246] :
    data.grade === 'C' ? [234, 179, 8] :
    data.grade === 'D' ? [249, 115, 22] : [239, 68, 68];
  doc.setTextColor(gradeColor[0], gradeColor[1], gradeColor[2]);
  doc.text(`${data.grade} (${data.healthScore ?? '--'}/100)`, 100, y + 14);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Tests: ${data.testsGenerated} generated, ${data.testsPassed} passed`, 30, y + 24);
  doc.text(`Mutation Score: ${data.mutationScore}%`, 140, y + 24);
  y += 38;

  // ── Score Breakdown ─────────────────────────────────────────────────
  if (Object.keys(data.breakdown).length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(66, 66, 66);
    doc.text('Agent Score Breakdown', 20, y);
    y += 6;

    const breakdownRows = Object.entries(data.breakdown).map(([agent, score]) => [
      agent.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      score != null ? `${score}/100` : 'N/A',
      score != null && score >= 70 ? 'Good' : score != null && score >= 40 ? 'Needs Work' : 'Critical',
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [['Agent', 'Score', 'Status']],
      body: breakdownRows,
      theme: 'striped',
      headStyles: { fillColor: [66, 99, 235], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 20, right: 20 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Action Items ────────────────────────────────────────────────────
  if (data.actionItems.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(66, 66, 66);
    doc.text(`Action Items (${data.actionItems.length})`, 20, y);
    y += 6;

    const actionRows = data.actionItems.map(a => [
      a.priority.toUpperCase(),
      a.title,
      a.effort,
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [['Priority', 'Action', 'Effort']],
      body: actionRows,
      theme: 'striped',
      headStyles: { fillColor: [234, 88, 12], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 20, right: 20 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Findings ────────────────────────────────────────────────────────
  if (data.findings.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(66, 66, 66);
    doc.text(`Findings (${data.findings.length})`, 20, y);
    y += 6;

    const findingRows = data.findings.slice(0, 20).map(f => [
      f.severity.toUpperCase(),
      f.title,
      f.file || '',
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [['Severity', 'Finding', 'File']],
      body: findingRows,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 20, right: 20 },
      columnStyles: { 2: { cellWidth: 50 } },
    });
  }

  // ── Footer ──────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(
      `AI Software Development Platform — Page ${i}/${pageCount}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save
  const repoName = data.repoUrl.split('/').pop() || 'report';
  doc.save(`qa-report-${repoName}-${new Date().toISOString().split('T')[0]}.pdf`);
}
