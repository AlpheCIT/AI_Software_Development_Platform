import * as vscode from 'vscode';

export class FindingsDiagnosticProvider {
  updateDiagnostics(
    uri: vscode.Uri,
    findings: any[],
    collection: vscode.DiagnosticCollection
  ) {
    const diagnostics: vscode.Diagnostic[] = [];

    for (const finding of findings) {
      // Only show verified findings
      if (finding.verificationStatus === 'false_positive') continue;

      const line = (finding.location?.line || finding.lineNumber || 1) - 1;
      const range = new vscode.Range(line, 0, line, 1000);

      const severity = this.mapSeverity(finding.severity);
      const diagnostic = new vscode.Diagnostic(range, finding.title || finding.description, severity);

      diagnostic.source = 'AI Platform';
      diagnostic.code = finding.id || finding.type;

      // Add confidence as tooltip
      if (finding.confidence) {
        diagnostic.message += ` (${Math.round(finding.confidence * 100)}% confidence)`;
      }

      // Add verification badge
      if (finding.verificationStatus === 'verified') {
        diagnostic.message += ' [Verified by debate]';
      }

      // Add challenger notes
      if (finding.challengerNotes) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(uri, range),
            `Challenger: ${finding.challengerNotes}`
          )
        ];
      }

      diagnostics.push(diagnostic);
    }

    collection.set(uri, diagnostics);
  }

  private mapSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return vscode.DiagnosticSeverity.Error;
      case 'medium':
        return vscode.DiagnosticSeverity.Warning;
      case 'low':
      case 'info':
        return vscode.DiagnosticSeverity.Information;
      default:
        return vscode.DiagnosticSeverity.Hint;
    }
  }
}
