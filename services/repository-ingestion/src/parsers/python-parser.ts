import { LanguageParser } from './language-parser-factory';
import { ParseResult, ParsedEntity, ParsedRelationship } from './javascript-parser';
import { logger } from '../utils/logger';

export class PythonParser implements LanguageParser {
  getLanguage(): string {
    return 'python';
  }

  getSupportedExtensions(): string[] {
    return ['.py'];
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
      // Parse Python code using regex patterns and line-by-line analysis
      // This is a simplified parser - for production, consider using python-ast or tree-sitter
      this.extractFromPython(content, result);
    } catch (error) {
      logger.error(`Failed to parse Python file ${filePath}:`, error);
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  private extractFromPython(content: string, result: ParseResult): void {
    const lines = content.split('\n');
    let currentClass = '';
    let currentFunction = '';
    let indentLevel = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();
      const originalLine = lines[lineNum];
      const currentIndent = originalLine.length - originalLine.trimLeft().length;

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;

      // Import statements
      const importMatch = line.match(/^(from\s+(\S+)\s+)?import\s+(.+)/);
      if (importMatch) {
        const [, , fromModule, importedItems] = importMatch;
        const module = fromModule || importedItems.split(',')[0].trim();
        
        result.imports.push(module);
        
        const items = importedItems.split(',').map(item => item.trim().split(' as ')[0]);
        items.forEach(item => {
          result.entities.push({
            type: 'import',
            name: item,
            location: {
              start: { line: lineNum + 1, column: 0 },
              end: { line: lineNum + 1, column: line.length }
            },
            dependencies: [module]
          });

          result.relationships.push({
            type: 'imports',
            from: item,
            to: module,
            location: { line: lineNum + 1, column: 0 }
          });
        });
        continue;
      }

      // Class definitions
      const classMatch = line.match(/^class\s+(\w+)(?:\(([^)]+)\))?:/);
      if (classMatch) {
        const [, className, inheritance] = classMatch;
        currentClass = className;
        indentLevel = currentIndent;

        const dependencies = inheritance ? 
          inheritance.split(',').map(base => base.trim()) : [];

        result.entities.push({
          type: 'class',
          name: className,
          location: {
            start: { line: lineNum + 1, column: currentIndent },
            end: { line: lineNum + 1, column: line.length }
          },
          signature: line,
          dependencies,
          documentation: this.extractPythonDocstring(lines, lineNum + 1)
        });

        // Add inheritance relationships
        dependencies.forEach(base => {
          result.relationships.push({
            type: 'extends',
            from: className,
            to: base,
            location: { line: lineNum + 1, column: currentIndent }
          });
        });
        continue;
      }

      // Function definitions
      const functionMatch = line.match(/^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
      if (functionMatch) {
        const [, isAsync, functionName, params, returnType] = functionMatch;
        currentFunction = functionName;

        const parameters = params ? 
          params.split(',').map(param => param.trim().split('=')[0].trim()) : [];

        result.entities.push({
          type: 'function',
          name: functionName,
          location: {
            start: { line: lineNum + 1, column: currentIndent },
            end: { line: lineNum + 1, column: line.length }
          },
          signature: line,
          parameters,
          returnType,
          isAsync: !!isAsync,
          documentation: this.extractPythonDocstring(lines, lineNum + 1)
        });
        continue;
      }

      // Variable assignments (simplified)
      const varMatch = line.match(/^(\w+)\s*=\s*(.+)/);
      if (varMatch && currentIndent === 0) { // Only global variables
        const [, varName, value] = varMatch;
        
        // Skip if it's a function call or complex expression
        if (!value.includes('(') || value.match(/^['"`]/)) {
          result.entities.push({
            type: 'variable',
            name: varName,
            location: {
              start: { line: lineNum + 1, column: currentIndent },
              end: { line: lineNum + 1, column: line.length }
            },
            signature: line
          });
        }
        continue;
      }

      // Function calls
      const callMatch = line.match(/(\w+(?:\.\w+)*)\s*\(/);
      if (callMatch && currentFunction) {
        const [, calledFunction] = callMatch;
        
        result.relationships.push({
          type: 'calls',
          from: currentFunction,
          to: calledFunction,
          location: { line: lineNum + 1, column: currentIndent }
        });
      }

      // Update scope based on indentation
      if (currentIndent <= indentLevel && (currentClass || currentFunction)) {
        if (currentIndent === 0) {
          currentClass = '';
          currentFunction = '';
        } else if (currentClass && currentIndent <= indentLevel) {
          currentFunction = '';
        }
      }
    }

    // Python doesn't have explicit exports, but we can identify public functions/classes
    result.entities.forEach(entity => {
      if (entity.type === 'function' || entity.type === 'class') {
        if (!entity.name.startsWith('_')) {
          result.exports.push(entity.name);
        }
      }
    });
  }

  private extractPythonDocstring(lines: string[], startLine: number): string | undefined {
    if (startLine >= lines.length) return undefined;
    
    const nextLine = lines[startLine].trim();
    if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
      const quote = nextLine.substring(0, 3);
      let docstring = nextLine.substring(3);
      
      // Single line docstring
      if (docstring.endsWith(quote)) {
        return docstring.substring(0, docstring.length - 3).trim();
      }
      
      // Multi-line docstring
      let lineIndex = startLine + 1;
      while (lineIndex < lines.length) {
        const line = lines[lineIndex];
        if (line.trim().endsWith(quote)) {
          docstring += '\n' + line.substring(0, line.lastIndexOf(quote));
          break;
        }
        docstring += '\n' + line;
        lineIndex++;
      }
      
      return docstring.trim();
    }
    
    return undefined;
  }
}
