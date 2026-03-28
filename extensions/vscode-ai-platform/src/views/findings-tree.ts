import * as vscode from 'vscode';
import { AIplatformClient } from '../client';

export class FindingsTreeProvider implements vscode.TreeDataProvider<FindingItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FindingItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private findings: any[] = [];

  constructor(private client: AIplatformClient) {}

  refresh(findings?: any[]) {
    if (findings) this.findings = findings.filter((f: any) => f.verificationStatus !== 'false_positive');
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: FindingItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FindingItem): FindingItem[] {
    if (element) return [];

    return this.findings.map(f => {
      const item = new FindingItem(
        f.title || f.description,
        f.severity,
        f.location?.file || 'unknown',
        f.location?.line || 0,
        f.confidence || 0,
        f.verificationStatus,
        vscode.TreeItemCollapsibleState.None
      );

      if (f.remediation) {
        item.command = {
          command: 'aiPlatform.applyFix',
          title: 'Apply Fix',
          arguments: [f]
        };
        item.tooltip = `Click to apply fix: ${f.remediation.explanation}`;
      }

      return item;
    });
  }
}

class FindingItem extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly severity: string,
    public readonly file: string,
    public readonly line: number,
    public readonly confidence: number,
    public readonly verificationStatus: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(title, collapsibleState);

    this.description = `${file}:${line}`;
    this.tooltip = `${severity.toUpperCase()} | ${Math.round(confidence * 100)}% confidence | ${verificationStatus}`;

    // Icon based on severity
    const iconColor = severity === 'critical' || severity === 'high' ? 'error' :
                      severity === 'medium' ? 'warning' : 'info';
    this.iconPath = new vscode.ThemeIcon(
      severity === 'critical' ? 'error' : severity === 'high' ? 'warning' : 'info',
      new vscode.ThemeColor(`list.${iconColor}Foreground`)
    );
  }
}
