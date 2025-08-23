import { JavaScriptParser } from './javascript-parser';
import { TypeScriptParser } from './typescript-parser';
import { PythonParser } from './python-parser';
import { GenericParser } from './generic-parser';
import { logger } from '../utils/logger';

export interface LanguageParser {
  parse(content: string, filePath: string): Promise<any>;
  getLanguage(): string;
  getSupportedExtensions(): string[];
}

export class LanguageParserFactory {
  private parsers: Map<string, LanguageParser> = new Map();

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    // Register language parsers
    this.registerParser(new JavaScriptParser());
    this.registerParser(new TypeScriptParser());
    this.registerParser(new PythonParser());
    this.registerParser(new GenericParser());
  }

  private registerParser(parser: LanguageParser): void {
    const language = parser.getLanguage();
    this.parsers.set(language, parser);
    logger.debug(`Registered parser for language: ${language}`);
  }

  public getParser(language: string): LanguageParser {
    const parser = this.parsers.get(language);
    if (parser) {
      return parser;
    }

    // Fall back to generic parser for unsupported languages
    logger.warn(`No specific parser found for language: ${language}, using generic parser`);
    return this.parsers.get('generic') || new GenericParser();
  }

  public getSupportedLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }

  public isLanguageSupported(language: string): boolean {
    return this.parsers.has(language);
  }

  public getParserByExtension(extension: string): LanguageParser {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.rb': 'ruby',
      '.php': 'php',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala'
    };

    const language = languageMap[extension.toLowerCase()] || 'generic';
    return this.getParser(language);
  }
}
