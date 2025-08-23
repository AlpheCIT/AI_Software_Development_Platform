import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { JavaScriptParser, ParseResult, ParsedEntity } from './javascript-parser';
import { LanguageParser } from './language-parser-factory';
import { logger } from '../utils/logger';

export class TypeScriptParser extends JavaScriptParser implements LanguageParser {
  getLanguage(): string {
    return 'typescript';
  }

  getSupportedExtensions(): string[] {
    return ['.ts', '.tsx'];
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
      // Parse TypeScript code with TypeScript-specific plugins
      const ast = parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'typescript',
          'tsx',
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

      // Extract entities and relationships with TypeScript-specific handling
      this.extractFromTSAST(ast, result);

    } catch (error) {
      logger.error(`Failed to parse TypeScript file ${filePath}:`, error);
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  private extractFromTSAST(ast: any, result: ParseResult): void {
    const currentScope: string[] = [];
    const interfaceImplementations: Map<string, string[]> = new Map();

    traverse(ast, {
      // TypeScript interfaces
      TSInterfaceDeclaration: (path) => {
        const name = path.node.id.name;
        const extendsList = path.node.extends?.map(ext => {
          if (t.isTSExpressionWithTypeArguments(ext) && t.isIdentifier(ext.expression)) {
            return ext.expression.name;
          }
          return 'unknown';
        }) || [];

        result.entities.push({
          type: 'class', // Treat interfaces as class-like entities
          name,
          location: this.getLocation(path.node),
          signature: `interface ${name}${extendsList.length > 0 ? ` extends ${extendsList.join(', ')}` : ''}`,
          isExported: this.isInExportContext(path),
          dependencies: extendsList,
          documentation: this.extractDocumentation(path)
        });

        // Add extends relationships
        extendsList.forEach(extended => {
          result.relationships.push({
            type: 'extends',
            from: name,
            to: extended,
            location: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            }
          });
        });

        currentScope.push(name);
      },

      // TypeScript type aliases
      TSTypeAliasDeclaration: (path) => {
        const name = path.node.id.name;
        
        result.entities.push({
          type: 'variable', // Treat type aliases as variable-like entities
          name,
          location: this.getLocation(path.node),
          signature: `type ${name}`,
          isExported: this.isInExportContext(path),
          documentation: this.extractDocumentation(path)
        });
      },

      // TypeScript enums
      TSEnumDeclaration: (path) => {
        const name = path.node.id.name;
        
        result.entities.push({
          type: 'class', // Treat enums as class-like entities
          name,
          location: this.getLocation(path.node),
          signature: `enum ${name}`,
          isExported: this.isInExportContext(path),
          documentation: this.extractDocumentation(path)
        });

        currentScope.push(name);
      },

      // TypeScript namespaces/modules
      TSModuleDeclaration: (path) => {
        if (t.isIdentifier(path.node.id)) {
          const name = path.node.id.name;
          
          result.entities.push({
            type: 'class', // Treat namespaces as class-like entities
            name,
            location: this.getLocation(path.node),
            signature: `namespace ${name}`,
            isExported: this.isInExportContext(path),
            documentation: this.extractDocumentation(path)
          });

          currentScope.push(name);
        }
      },

      // Enhanced function declarations with TypeScript types
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name || 'anonymous';
        const isAsync = path.node.async || false;
        const params = path.node.params.map(param => {
          if (t.isIdentifier(param)) {
            const typeAnnotation = this.getTypeAnnotation(param);
            return typeAnnotation ? `${param.name}: ${typeAnnotation}` : param.name;
          }
          if (t.isRestElement(param) && t.isIdentifier(param.argument)) {
            const typeAnnotation = this.getTypeAnnotation(param.argument);
            return typeAnnotation ? `...${param.argument.name}: ${typeAnnotation}` : `...${param.argument.name}`;
          }
          return 'unknown';
        });

        const returnType = this.getReturnTypeAnnotation(path.node);

        result.entities.push({
          type: 'function',
          name,
          location: this.getLocation(path.node),
          signature: this.generateTSFunctionSignature(name, params, isAsync, returnType),
          parameters: params,
          returnType,
          isAsync,
          isExported: this.isInExportContext(path),
          documentation: this.extractDocumentation(path)
        });

        currentScope.push(name);
      },

      // Enhanced class declarations with TypeScript features
      ClassDeclaration: (path) => {
        const name = path.node.id?.name || 'anonymous';
        const superClass = path.node.superClass;
        const implementsList = path.node.implements?.map(impl => {
          if (t.isTSExpressionWithTypeArguments(impl) && t.isIdentifier(impl.expression)) {
            return impl.expression.name;
          }
          return 'unknown';
        }) || [];

        let superClassName = '';
        if (superClass && t.isIdentifier(superClass)) {
          superClassName = superClass.name;
        }

        const dependencies = [...(superClassName ? [superClassName] : []), ...implementsList];

        result.entities.push({
          type: 'class',
          name,
          location: this.getLocation(path.node),
          signature: this.generateTSClassSignature(name, superClassName, implementsList),
          isExported: this.isInExportContext(path),
          dependencies,
          documentation: this.extractDocumentation(path)
        });

        // Add extends relationship
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

        // Add implements relationships
        implementsList.forEach(implemented => {
          result.relationships.push({
            type: 'implements',
            from: name,
            to: implemented,
            location: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0
            }
          });
        });

        currentScope.push(name);
      },

      // TypeScript import type statements
      ImportDeclaration: (path) => {
        const source = path.node.source.value;
        result.imports.push(source);

        // Check if it's a type-only import
        const isTypeOnly = path.node.importKind === 'type';

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
              dependencies: [source],
              signature: isTypeOnly ? `import type { ${name} } from '${source}'` : undefined
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

      // Exit handlers
      'FunctionDeclaration|ClassDeclaration|TSInterfaceDeclaration|TSEnumDeclaration|TSModuleDeclaration': {
        exit: () => {
          currentScope.pop();
        }
      }
    });

    // Also run the base JavaScript extraction for standard JavaScript features
    this.extractFromAST(ast, result);
  }

  private getTypeAnnotation(node: any): string | undefined {
    if (node.typeAnnotation && node.typeAnnotation.typeAnnotation) {
      return this.typeAnnotationToString(node.typeAnnotation.typeAnnotation);
    }
    return undefined;
  }

  private getReturnTypeAnnotation(node: any): string | undefined {
    if (node.returnType && node.returnType.typeAnnotation) {
      return this.typeAnnotationToString(node.returnType.typeAnnotation);
    }
    return undefined;
  }

  private typeAnnotationToString(typeAnnotation: any): string {
    if (t.isTSStringKeyword(typeAnnotation)) return 'string';
    if (t.isTSNumberKeyword(typeAnnotation)) return 'number';
    if (t.isTSBooleanKeyword(typeAnnotation)) return 'boolean';
    if (t.isTSVoidKeyword(typeAnnotation)) return 'void';
    if (t.isTSAnyKeyword(typeAnnotation)) return 'any';
    if (t.isTSUnknownKeyword(typeAnnotation)) return 'unknown';
    if (t.isTSNullKeyword(typeAnnotation)) return 'null';
    if (t.isTSUndefinedKeyword(typeAnnotation)) return 'undefined';
    
    if (t.isTSTypeReference(typeAnnotation) && t.isIdentifier(typeAnnotation.typeName)) {
      return typeAnnotation.typeName.name;
    }
    
    if (t.isTSArrayType(typeAnnotation)) {
      const elementType = this.typeAnnotationToString(typeAnnotation.elementType);
      return `${elementType}[]`;
    }
    
    if (t.isTSUnionType(typeAnnotation)) {
      const types = typeAnnotation.types.map(type => this.typeAnnotationToString(type));
      return types.join(' | ');
    }
    
    return 'unknown';
  }

  private generateTSFunctionSignature(
    name: string, 
    params: string[], 
    isAsync: boolean, 
    returnType?: string
  ): string {
    const asyncKeyword = isAsync ? 'async ' : '';
    const paramsList = params.join(', ');
    const returnTypePart = returnType ? `: ${returnType}` : '';
    return `${asyncKeyword}function ${name}(${paramsList})${returnTypePart}`;
  }

  private generateTSClassSignature(
    name: string, 
    superClass?: string, 
    implementsList?: string[]
  ): string {
    let signature = `class ${name}`;
    
    if (superClass) {
      signature += ` extends ${superClass}`;
    }
    
    if (implementsList && implementsList.length > 0) {
      signature += ` implements ${implementsList.join(', ')}`;
    }
    
    return signature;
  }
}
