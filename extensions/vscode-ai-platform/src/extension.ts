import * as vscode from 'vscode';
import { AIplatformClient } from './client';
import { FindingsDiagnosticProvider } from './diagnostics';
import { FindingsTreeProvider } from './views/findings-tree';
import { ImpactTreeProvider } from './views/impact-tree';

let client: AIplatformClient;
let diagnosticProvider: FindingsDiagnosticProvider;

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('aiPlatform');
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:4000');

  client = new AIplatformClient(serverUrl);
  diagnosticProvider = new FindingsDiagnosticProvider();

  // Register diagnostic collection for inline findings
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('aiPlatform');
  context.subscriptions.push(diagnosticCollection);

  // Register tree views
  const findingsProvider = new FindingsTreeProvider(client);
  vscode.window.registerTreeDataProvider('aiPlatform.findings', findingsProvider);

  const impactProvider = new ImpactTreeProvider(client);
  vscode.window.registerTreeDataProvider('aiPlatform.impact', impactProvider);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('aiPlatform.analyzeFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const filePath = editor.document.uri.fsPath;
      const content = editor.document.getText();

      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AI Platform: Analyzing file...',
        cancellable: false
      }, async () => {
        try {
          const findings = await client.analyzeFile(filePath, content);
          diagnosticProvider.updateDiagnostics(editor.document.uri, findings, diagnosticCollection);
          findingsProvider.refresh(findings);

          const verifiedCount = findings.filter((f: any) => f.verificationStatus === 'verified').length;
          vscode.window.showInformationMessage(
            `AI Platform: ${verifiedCount} verified findings (${findings.length - verifiedCount} false positives caught by debate)`
          );
        } catch (error) {
          vscode.window.showErrorMessage(`AI Platform analysis failed: ${error}`);
        }
      });
    }),

    vscode.commands.registerCommand('aiPlatform.analyzeWorkspace', async () => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AI Platform: Analyzing workspace...',
        cancellable: true
      }, async (progress) => {
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showWarningMessage('No workspace folder open');
            return;
          }

          progress.report({ message: 'Starting analysis...' });
          const result = await client.analyzeWorkspace(workspaceFolder.uri.fsPath);

          progress.report({ message: 'Analysis complete' });
          vscode.window.showInformationMessage(
            `AI Platform: Analysis complete. ${result.verifiedFindings} verified findings across ${result.filesAnalyzed} files.`
          );
        } catch (error) {
          vscode.window.showErrorMessage(`Workspace analysis failed: ${error}`);
        }
      });
    }),

    vscode.commands.registerCommand('aiPlatform.showImpact', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const filePath = editor.document.uri.fsPath;
      try {
        const impact = await client.getImpactAnalysis(filePath);
        impactProvider.refresh(impact);
        vscode.window.showInformationMessage(
          `Blast radius: ${impact.affectedFiles} files, ${impact.affectedEndpoints} endpoints`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Impact analysis failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('aiPlatform.applyFix', async (finding: any) => {
      if (!finding?.remediation) {
        vscode.window.showWarningMessage('No fix available for this finding');
        return;
      }

      const patch = finding.remediation;
      const edit = new vscode.WorkspaceEdit();
      const uri = vscode.Uri.file(patch.filePath);

      // Apply the fix
      const document = await vscode.workspace.openTextDocument(uri);
      const line = document.lineAt(patch.lineNumber - 1);

      if (patch.patchType === 'replace') {
        edit.replace(uri, line.range, patch.fixedCode);
      } else if (patch.patchType === 'insert_before') {
        edit.insert(uri, line.range.start, patch.fixedCode + '\n');
      } else if (patch.patchType === 'insert_after') {
        edit.insert(uri, line.range.end, '\n' + patch.fixedCode);
      }

      await vscode.workspace.applyEdit(edit);
      vscode.window.showInformationMessage(`Applied fix: ${patch.explanation}`);
    }),

    vscode.commands.registerCommand('aiPlatform.generateDocs', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      try {
        const content = editor.document.getText();
        const docs = await client.generateDocumentation(editor.document.uri.fsPath, content);

        // Open generated docs in new editor
        const doc = await vscode.workspace.openTextDocument({
          content: docs.markdown,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (error) {
        vscode.window.showErrorMessage(`Documentation generation failed: ${error}`);
      }
    })
  );

  // Auto-analyze on save
  if (config.get<boolean>('autoAnalyze', true)) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.uri.scheme !== 'file') return;

        try {
          const findings = await client.analyzeFile(document.uri.fsPath, document.getText());
          diagnosticProvider.updateDiagnostics(document.uri, findings, diagnosticCollection);
        } catch {
          // Silent fail for auto-analyze
        }
      })
    );
  }

  console.log('AI Code Intelligence Platform extension activated');
}

export function deactivate() {
  // Cleanup
}
