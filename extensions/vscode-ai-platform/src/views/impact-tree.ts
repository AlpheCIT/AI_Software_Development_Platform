import * as vscode from 'vscode';
import { AIplatformClient } from '../client';

export class ImpactTreeProvider implements vscode.TreeDataProvider<ImpactItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ImpactItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private impactData: any = null;

  constructor(private client: AIplatformClient) {}

  refresh(impactData?: any) {
    if (impactData) this.impactData = impactData;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ImpactItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ImpactItem): ImpactItem[] {
    if (!this.impactData) return [];
    if (element) return [];

    const items: ImpactItem[] = [];

    if (this.impactData.affectedEntities) {
      for (const entity of this.impactData.affectedEntities) {
        items.push(new ImpactItem(
          entity.name || entity.id,
          `Distance: ${entity.distance} hops`,
          entity.collection || 'unknown',
          vscode.TreeItemCollapsibleState.None
        ));
      }
    }

    return items;
  }
}

class ImpactItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly distance: string,
    public readonly entityType: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(name, collapsibleState);
    this.description = `${entityType} | ${distance}`;
    this.iconPath = new vscode.ThemeIcon('symbol-reference');
  }
}
