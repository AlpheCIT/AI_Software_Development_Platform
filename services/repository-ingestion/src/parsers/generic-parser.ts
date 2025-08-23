import { LanguageParser } from './language-parser-factory';
import { ParseResult, ParsedEntity, ParsedRelationship } from './javascript-parser';
import { logger } from '../utils/logger';

export class GenericParser implements LanguageParser {
  getLanguage(): string {
    return 'generic';
  }

  getSupportedExtensions(): string[] {
    return ['*']; // Supports any extension
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
      // Perform basic text-based analysis for any file type
      this.extractFromGeneric(content, filePath, result);
    } catch (error) {
      logger.error(`Failed to parse generic file ${filePath}:`, error);
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  private extractFromGeneric(content: string, filePath: string, result: ParseResult): void {
    const lines = content.split('\n');
    const extension = this.getFileExtension(filePath);
    
    // Apply language-specific patterns based on file extension
    switch (extension.toLowerCase()) {
      case '.java':
        this.extractJavaPatterns(lines, result);
        break;
      case '.cs':
        this.extractCSharpPatterns(lines, result);
        break;
      case '.cpp':
      case '.c':
      case '.h':
      case '.hpp':
        this.extractCppPatterns(lines, result);
        break;
      case '.rb':
        this.extractRubyPatterns(lines, result);
        break;
      case '.php':
        this.extractPhpPatterns(lines, result);
        break;
      case '.go':
        this.extractGoPatterns(lines, result);
        break;
      case '.rs':
        this.extractRustPatterns(lines, result);
        break;
      case '.swift':
        this.extractSwiftPatterns(lines, result);
        break;
      case '.kt':
        this.extractKotlinPatterns(lines, result);
        break;
      case '.scala':
        this.extractScalaPatterns(lines, result);
        break;
      case '.sql':
        this.extractSqlPatterns(lines, result);
        break;
      case '.yaml':
      case '.yml':
        this.extractYamlPatterns(lines, result);
        break;
      case '.json':
        this.extractJsonPatterns(content, result);
        break;
      case '.xml':
        this.extractXmlPatterns(content, result);
        break;
      case '.html':
        this.extractHtmlPatterns(content, result);
        break;
      case '.css':
      case '.scss':
      case '.less':
        this.extractCssPatterns(lines, result);
        break;
      default:
        this.extractGenericPatterns(lines, result);
        break;
    }
  }

  private extractJavaPatterns(lines: string[], result: ParseResult): void {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();

      // Package declaration
      const packageMatch = line.match(/^package\s+([\w.]+);/);
      if (packageMatch) {
        const [, packageName] = packageMatch;
        result.entities.push({
          type: 'variable',
          name: packageName,
          location: this.getLineLocation(lineNum, line),
          signature: line
        });
        continue;
      }

      // Import statements
      const importMatch = line.match(/^import\s+(static\s+)?([\w.*]+);/);
      if (importMatch) {
        const [, isStatic, importName] = importMatch;
        result.imports.push(importName);
        result.entities.push({
          type: 'import',
          name: importName.split('.').pop() || importName,
          location: this.getLineLocation(lineNum, line),
          dependencies: [importName]
        });
        continue;
      }

      // Class declarations
      const classMatch = line.match(/^(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/);
      if (classMatch) {
        const [, className, superClass, interfaces] = classMatch;
        const dependencies = [];
        if (superClass) dependencies.push(superClass);
        if (interfaces) {
          dependencies.push(...interfaces.split(',').map(i => i.trim()));
        }

        result.entities.push({
          type: 'class',
          name: className,
          location: this.getLineLocation(lineNum, line),
          signature: line,
          dependencies
        });

        if (superClass) {
          result.relationships.push({
            type: 'extends',
            from: className,
            to: superClass,
            location: { line: lineNum + 1, column: 0 }
          });
        }
        continue;
      }

      // Method declarations
      const methodMatch = line.match(/^(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:abstract\s+|final\s+)?(\w+)\s+(\w+)\s*\([^)]*\)/);
      if (methodMatch) {
        const [, returnType, methodName] = methodMatch;
        result.entities.push({
          type: 'function',
          name: methodName,
          location: this.getLineLocation(lineNum, line),
          signature: line,
          returnType
        });
        continue;
      }
    }
  }

  private extractCSharpPatterns(lines: string[], result: ParseResult): void {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();

      // Using statements
      const usingMatch = line.match(/^using\s+([\w.]+);/);
      if (usingMatch) {
        const [, usingName] = usingMatch;
        result.imports.push(usingName);
        result.entities.push({
          type: 'import',
          name: usingName.split('.').pop() || usingName,
          location: this.getLineLocation(lineNum, line),
          dependencies: [usingName]
        });
        continue;
      }

      // Namespace declarations
      const namespaceMatch = line.match(/^namespace\s+([\w.]+)/);
      if (namespaceMatch) {
        const [, namespaceName] = namespaceMatch;
        result.entities.push({
          type: 'class',
          name: namespaceName,
          location: this.getLineLocation(lineNum, line),
          signature: line
        });
        continue;
      }

      // Class declarations
      const classMatch = line.match(/^(?:public\s+|private\s+|internal\s+)?(?:abstract\s+|sealed\s+)?class\s+(\w+)(?:\s*:\s*([\w,\s]+))?/);
      if (classMatch) {
        const [, className, inheritance] = classMatch;
        const dependencies = inheritance ? 
          inheritance.split(',').map(i => i.trim()) : [];

        result.entities.push({
          type: 'class',
          name: className,
          location: this.getLineLocation(lineNum, line),
          signature: line,
          dependencies
        });
        continue;
      }
    }
  }

  private extractCppPatterns(lines: string[], result: ParseResult): void {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();

      // Include statements
      const includeMatch = line.match(/^#include\s*[<"](.*?)[>"]/);
      if (includeMatch) {
        const [, includeName] = includeMatch;
        result.imports.push(includeName);
        result.entities.push({
          type: 'import',
          name: includeName,
          location: this.getLineLocation(lineNum, line),
          dependencies: [includeName]
        });
        continue;
      }

      // Class declarations
      const classMatch = line.match(/^(?:template\s*<[^>]*>\s*)?class\s+(\w+)(?:\s*:\s*(?:public\s+|private\s+|protected\s+)?(\w+))?/);
      if (classMatch) {
        const [, className, baseClass] = classMatch;
        const dependencies = baseClass ? [baseClass] : [];

        result.entities.push({
          type: 'class',
          name: className,
          location: this.getLineLocation(lineNum, line),
          signature: line,
          dependencies
        });

        if (baseClass) {
          result.relationships.push({
            type: 'extends',
            from: className,
            to: baseClass,
            location: { line: lineNum + 1, column: 0 }
          });
        }
        continue;
      }

      // Function declarations
      const functionMatch = line.match(/^(?:(?:inline\s+|static\s+|virtual\s+|extern\s+)*)?(\w+(?:\s*\*|\s*&)?)\s+(\w+)\s*\([^)]*\)/);
      if (functionMatch && !line.includes('=') && !line.includes('if') && !line.includes('while')) {
        const [, returnType, functionName] = functionMatch;
        result.entities.push({
          type: 'function',
          name: functionName,
          location: this.getLineLocation(lineNum, line),
          signature: line,
          returnType: returnType.trim()
        });
        continue;
      }
    }
  }

  private extractRubyPatterns(lines: string[], result: ParseResult): void {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();

      // Require statements
      const requireMatch = line.match(/^require\s+['"]([^'"]+)['"]/);
      if (requireMatch) {
        const [, requireName] = requireMatch;
        result.imports.push(requireName);
        result.entities.push({
          type: 'import',
          name: requireName,
          location: this.getLineLocation(lineNum, line),
          dependencies: [requireName]
        });
        continue;
      }

      // Class declarations
      const classMatch = line.match(/^class\s+(\w+)(?:\s*<\s*(\w+))?/);
      if (classMatch) {
        const [, className, superClass] = classMatch;
        const dependencies = superClass ? [superClass] : [];

        result.entities.push({
          type: 'class',
          name: className,
          location: this.getLineLocation(lineNum, line),
          signature: line,
          dependencies
        });

        if (superClass) {
          result.relationships.push({
            type: 'extends',
            from: className,
            to: superClass,
            location: { line: lineNum + 1, column: 0 }
          });
        }
        continue;
      }

      // Method declarations
      const methodMatch = line.match(/^def\s+(\w+)(?:\([^)]*\))?/);
      if (methodMatch) {
        const [, methodName] = methodMatch;
        result.entities.push({
          type: 'function',
          name: methodName,
          location: this.getLineLocation(lineNum, line),
          signature: line
        });
        continue;
      }
    }
  }

  private extractGoPatterns(lines: string[], result: ParseResult): void {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();

      // Import statements
      const importMatch = line.match(/^import\s+(?:"([^"]+)"|(\w+)\s+"([^"]+)")/);
      if (importMatch) {
        const [, simpleName, alias, quotedName] = importMatch;
        const importName = simpleName || quotedName;
        const name = alias || importName.split('/').pop() || importName;
        
        result.imports.push(importName);
        result.entities.push({
          type: 'import',
          name,
          location: this.getLineLocation(lineNum, line),
          dependencies: [importName]
        });
        continue;
      }

      // Function declarations
      const funcMatch = line.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)(?:\s*\([^)]*\)|\s*\w+)?/);
      if (funcMatch) {
        const [, funcName] = funcMatch;
        result.entities.push({
          type: 'function',
          name: funcName,
          location: this.getLineLocation(lineNum, line),
          signature: line
        });
        continue;
      }

      // Type declarations
      const typeMatch = line.match(/^type\s+(\w+)\s+(?:struct|interface)/);
      if (typeMatch) {
        const [, typeName] = typeMatch;
        result.entities.push({
          type: 'class',
          name: typeName,
          location: this.getLineLocation(lineNum, line),
          signature: line
        });
        continue;
      }
    }
  }

  private extractJsonPatterns(content: string, result: ParseResult): void {
    try {
      const json = JSON.parse(content);
      this.extractJsonKeys(json, result, []);
    } catch (error) {
      result.errors.push(`Invalid JSON: ${error.message}`);
    }
  }

  private extractJsonKeys(obj: any, result: ParseResult, path: string[]): void {
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        const currentPath = [...path, key];
        const fullName = currentPath.join('.');
        
        result.entities.push({
          type: 'variable',
          name: fullName,
          location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          signature: `"${key}"`
        });

        if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.extractJsonKeys(obj[key], result, currentPath);
        }
      });
    }
  }

  private extractGenericPatterns(lines: string[], result: ParseResult): void {
    // Extract basic patterns that might exist in any language
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();

      // Function-like patterns
      const funcPattern = line.match(/(\w+)\s*\([^)]*\)\s*[{;]/);
      if (funcPattern && !line.includes('=') && !line.includes('if')) {
        const [, funcName] = funcPattern;
        result.entities.push({
          type: 'function',
          name: funcName,
          location: this.getLineLocation(lineNum, line),
          signature: line
        });
      }

      // Variable assignment patterns
      const varPattern = line.match(/^\s*(?:var\s+|let\s+|const\s+)?(\w+)\s*[=:]/);
      if (varPattern && !line.includes('(')) {
        const [, varName] = varPattern;
        result.entities.push({
          type: 'variable',
          name: varName,
          location: this.getLineLocation(lineNum, line),
          signature: line
        });
      }
    }
  }

  private extractSqlPatterns(lines: string[], result: ParseResult): void {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim().toUpperCase();

      // Table creation
      const createTableMatch = line.match(/CREATE\s+TABLE\s+(\w+)/);
      if (createTableMatch) {
        const [, tableName] = createTableMatch;
        result.entities.push({
          type: 'class',
          name: tableName.toLowerCase(),
          location: this.getLineLocation(lineNum, line),
          signature: lines[lineNum].trim()
        });
      }

      // Function/Procedure creation
      const createFuncMatch = line.match(/CREATE\s+(?:FUNCTION|PROCEDURE)\s+(\w+)/);
      if (createFuncMatch) {
        const [, funcName] = createFuncMatch;
        result.entities.push({
          type: 'function',
          name: funcName.toLowerCase(),
          location: this.getLineLocation(lineNum, line),
          signature: lines[lineNum].trim()
        });
      }
    }
  }

  private extractYamlPatterns(lines: string[], result: ParseResult): void {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const keyMatch = line.match(/^(\s*)([^:\s]+):\s*(.*)$/);
      
      if (keyMatch) {
        const [, indent, key, value] = keyMatch;
        result.entities.push({
          type: 'variable',
          name: key,
          location: this.getLineLocation(lineNum, line),
          signature: `${key}: ${value}`
        });
      }
    }
  }

  private extractXmlPatterns(content: string, result: ParseResult): void {
    // Simple XML tag extraction
    const tagRegex = /<(\w+)[^>]*>/g;
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      const [, tagName] = match;
      result.entities.push({
        type: 'class',
        name: tagName,
        location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
        signature: `<${tagName}>`
      });
    }
  }

  private extractHtmlPatterns(content: string, result: ParseResult): void {
    // HTML elements
    const elementRegex = /<(\w+)[^>]*>/g;
    let match;
    
    while ((match = elementRegex.exec(content)) !== null) {
      const [, tagName] = match;
      if (!['html', 'head', 'body', 'div', 'span', 'p'].includes(tagName.toLowerCase())) {
        result.entities.push({
          type: 'class',
          name: tagName,
          location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          signature: `<${tagName}>`
        });
      }
    }

    // JavaScript in script tags
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    
    while ((scriptMatch = scriptRegex.exec(content)) !== null) {
      const [, scriptContent] = scriptMatch;
      // Could recursively parse JavaScript here
      const funcMatches = scriptContent.match(/function\s+(\w+)/g);
      if (funcMatches) {
        funcMatches.forEach(funcMatch => {
          const funcName = funcMatch.replace('function ', '');
          result.entities.push({
            type: 'function',
            name: funcName,
            location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
            signature: funcMatch
          });
        });
      }
    }
  }

  private extractCssPatterns(lines: string[], result: ParseResult): void {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();

      // CSS selectors
      const selectorMatch = line.match(/^([.#]?[\w-]+(?:\s*[,>+~]\s*[.#]?[\w-]+)*)\s*\{?$/);
      if (selectorMatch && !line.includes(':') && !line.includes(';')) {
        const [, selector] = selectorMatch;
        result.entities.push({
          type: 'class',
          name: selector.replace(/[.#]/g, ''),
          location: this.getLineLocation(lineNum, line),
          signature: selector
        });
      }
    }
  }

  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    return lastDotIndex !== -1 ? filePath.substring(lastDotIndex) : '';
  }

  private getLineLocation(lineNum: number, line: string) {
    return {
      start: { line: lineNum + 1, column: 0 },
      end: { line: lineNum + 1, column: line.length }
    };
  }
}
