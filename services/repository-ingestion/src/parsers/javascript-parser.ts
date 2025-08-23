import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { LanguageParser } from './language-parser-factory';
import { logger } from '../utils/logger';

export interface ParsedEntity {
  type: 'function' | 'class' | 'variable' | 'import' | 'export';
  name: string;
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  signature?: string;
  parameters?: string[];
  returnType?: string;
  isAsync?: boolean;
  isExported?: boolean;
  dependencies?: string[];
  documentation?: string;
}

export interface ParsedRelationship {
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'references';
  from: string;
  to: string;
  location?: {
    line: number;
    column: number;
  };
}

export interface ParseResult {
  entities: ParsedEntity[];
  relationships: ParsedRelationship[];
  imports: string[];
  exports: string[];
  errors: string[];
}

export class JavaScriptParser implements LanguageParser {
  getLanguage(): string {
    return 'javascript';
  }

  getSupportedExtensions(): string[] {
    return ['.js', '.jsx'];
  }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const result: ParseResult = {
      entities: [],
      relationships: [],
      imports: [],
      exports: [],
      errors: []
    };

    try {
      // Parse the JavaScript/JSX code
      const ast = parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'jsx',
          'asyncGenerators',
          'bigInt',
          'classProperties',
          'decorators-legacy',
          'doExpressions',
          'dynamicImport',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'functionBind',
          'functionSent',
          'importMeta',
          'nullishCoalescingOperator',
          'numericSeparator',
          'objectRestSpread',
          'optionalCatchBinding',
          'optionalChaining',
          'throwExpressions',
          'topLevelAwait',
          'trailingFunctionCommas'
        ]
      });

      // Extract entities and relationships
      this.extractFromAST(ast, result);

    } catch (error) {
      logger.error(`Failed to parse JavaScript file ${filePath}:`, error);
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  private extractFromAST(ast: any, result: ParseResult): void {
    const currentScope: string[] = [];
    const functionCalls: Map<string, string[]> = new Map();

    traverse(ast, {
      // Import declarations
      ImportDeclaration: (path) => {
        const source = path.node.source.value;
        result.imports.push(source);

        path.node.specifiers.forEach(spec => {
          let name = '';
          if (t.isImportDefaultSpecifier(spec)) {
            name = spec.local.name;
          } else if (t.isImportSpecifier(spec)) {
            name = spec.local.name;
          } else if (t.isImportNamespaceSpecifier(spec)) {
            name = spec.local.name;
          }

          if (name) {
            result.entities.push({
              type: 'import',
              name,
              location: this.getLocation(spec),
              dependencies: [source]
            });

            result.relationships.push({
              type: 'imports',
              from: name,
              to: source,
              location: {
                line: spec.loc?.start.line || 0,
                column: spec.loc?.start.column || 0
              }
            });
          }
        });
      },

      // Export declarations
      ExportNamedDeclaration: (path) => {
        if (path.node.declaration) {
          this.handleExportDeclaration(path.node.declaration, result, true);
        }

        path.node.specifiers?.forEach(spec => {
          if (t.isExportSpecifier(spec)) {
            const exported = spec.exported;
            const name = t.isIdentifier(exported) ? exported.name : exported.value;
            result.exports.push(name);
            
            result.relationships.push({
              type: 'references',
              from: 'module',
              to: name,
              location: {
                line: spec.loc?.start.line || 0,
                column: spec.loc?.start.column || 0
              }
            });
          }
        });
      },

      ExportDefaultDeclaration: (path) => {
        result.exports.push('default');
        if (path.node.declaration) {
          this.handleExportDeclaration(path.node.declaration, result, true);
        }
      },

      // Function declarations
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name || 'anonymous';
        const isAsync = path.node.async || false;
        const params = path.node.params.map(param => {
          if (t.isIdentifier(param)) return param.name;
          if (t.isRestElement(param) && t.isIdentifier(param.argument)) return `...${param.argument.name}`;
          return 'unknown';
        });

        result.entities.push({
          type: 'function',
          name,
          location: this.getLocation(path.node),
          signature: this.generateFunctionSignature(name, params, isAsync),
          parameters: params,
          isAsync,
          isExported: this.isInExportContext(path),
          documentation: this.extractDocumentation(path)
        });

        currentScope.push(name);
        functionCalls.set(name, []);
      },

      // Arrow functions and function expressions
      ArrowFunctionExpression: (path) => {
        const parent = path.parent;
        let name = 'anonymous';

        if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
          name = parent.id.name;
        } else if (t.isProperty(parent) && t.isIdentifier(parent.key)) {
          name = parent.key.name;
        }

        const isAsync = path.node.async || false;
        const params = path.node.params.map(param => {
          if (t.isIdentifier(param)) return param.name;
          return 'unknown';
        });

        result.entities.push({
          type: 'function',
          name,
          location: this.getLocation(path.node),
          signature: this.generateFunctionSignature(name, params, isAsync),
          parameters: params,
          isAsync,
          isExported: this.isInExportContext(path),
          documentation: this.extractDocumentation(path)
        });
      },

      // Class declarations
      ClassDeclaration: (path) => {
        const name = path.node.id?.name || 'anonymous';
        const superClass = path.node.superClass;
        let superClassName = '';

        if (superClass && t.isIdentifier(superClass)) {
          superClassName = superClass.name;
        }

        result.entities.push({
          type: 'class',
          name,
          location: this.getLocation(path.node),
          signature: `class ${name}${superClassName ? ` extends ${superClassName}` : ''}`,
          isExported: this.isInExportContext(path),
          dependencies: superClassName ? [superClassName] : [],
          documentation: this.extractDocumentation(path)
        });

        if (superClassName) {
          result.relationships.push({
            type: 'extends',
            from: name,
            to: superClassName,
            location: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            }
          });
        }

        currentScope.push(name);
      },

      // Variable declarations
      VariableDeclarator: (path) => {
        if (t.isIdentifier(path.node.id)) {
          const name = path.node.id.name;
          const init = path.node.init;

          // Determine if it's a function assignment
          const isFunctionAssignment = t.isFunctionExpression(init) || t.isArrowFunctionExpression(init);

          if (!isFunctionAssignment) {
            result.entities.push({
              type: 'variable',
              name,
              location: this.getLocation(path.node),
              signature: `var ${name}`,
              isExported: this.isInExportContext(path),
              documentation: this.extractDocumentation(path)
            });
          }
        }
      },

      // Function calls
      CallExpression: (path) => {
        const callee = path.node.callee;
        let calledFunction = '';

        if (t.isIdentifier(callee)) {
          calledFunction = callee.name;
        } else if (t.isMemberExpression(callee)) {
          if (t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
            calledFunction = `${callee.object.name}.${callee.property.name}`;
          }
        }

        if (calledFunction && currentScope.length > 0) {
          const currentFunction = currentScope[currentScope.length - 1];
          result.relationships.push({
            type: 'calls',
            from: currentFunction,
            to: calledFunction,
            location: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            }
          });
        }
      },

      // Exit handlers to manage scope
      'FunctionDeclaration|ClassDeclaration': {
        exit: () => {
          currentScope.pop();
        }
      }
    });
  }

  private handleExportDeclaration(declaration: any, result: ParseResult, isExported: boolean): void {
    if (t.isFunctionDeclaration(declaration) && declaration.id) {
      const name = declaration.id.name;
      result.exports.push(name);
    } else if (t.isClassDeclaration(declaration) && declaration.id) {
      const name = declaration.id.name;
      result.exports.push(name);
    } else if (t.isVariableDeclaration(declaration)) {
      declaration.declarations.forEach(declarator => {
        if (t.isIdentifier(declarator.id)) {
          result.exports.push(declarator.id.name);
        }
      });
    }
  }

  private getLocation(node: any): { start: { line: number; column: number }; end: { line: number; column: number } } {
    return {
      start: {
        line: node.loc?.start.line || 0,
        column: node.loc?.start.column || 0
      },
      end: {
        line: node.loc?.end.line || 0,
        column: node.loc?.end.column || 0
      }
    };
  }

  private generateFunctionSignature(name: string, params: string[], isAsync: boolean): string {
    const asyncKeyword = isAsync ? 'async ' : '';
    const paramsList = params.join(', ');
    return `${asyncKeyword}function ${name}(${paramsList})`;
  }

  private isInExportContext(path: any): boolean {
    let parent = path.parent;
    while (parent) {
      if (t.isExportNamedDeclaration(parent) || t.isExportDefaultDeclaration(parent)) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private extractDocumentation(path: any): string | undefined {
    const leadingComments = path.node.leadingComments;
    if (leadingComments && leadingComments.length > 0) {
      const lastComment = leadingComments[leadingComments.length - 1];
      if (lastComment.type === 'CommentBlock' && lastComment.value.startsWith('*')) {
        // JSDoc comment
        return lastComment.value.trim();
      } else if (lastComment.type === 'CommentLine') {
        // Single line comment
        return lastComment.value.trim();
      }
    }
    return undefined;
  }
}
