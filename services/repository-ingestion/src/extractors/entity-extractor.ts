import { ParseResult, ParsedEntity } from '../parsers/javascript-parser';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface ExtractedEntity {
  _key: string;
  repositoryId: string;
  fileId: string;
  type: string;
  name: string;
  signature: string;
  location: {
    file: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  parameters?: string[];
  returnType?: string;
  isAsync?: boolean;
  isExported?: boolean;
  dependencies?: string[];
  documentation?: string;
  metadata: {
    complexity?: number;
    cyclomatic?: number;
    maintainabilityIndex?: number;
    linesOfCode?: number;
  };
  createdAt: Date;
}

export class EntityExtractor {
  async extract(
    parseResult: ParseResult, 
    fileId: string, 
    repositoryId: string
  ): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];

    try {
      for (const parsedEntity of parseResult.entities) {
        const entity = await this.convertToExtractedEntity(
          parsedEntity, 
          fileId, 
          repositoryId
        );
        entities.push(entity);
      }

      logger.debug(`Extracted ${entities.length} entities from file ${fileId}`);
    } catch (error) {
      logger.error('Failed to extract entities:', error);
      throw error;
    }

    return entities;
  }

  private async convertToExtractedEntity(
    parsedEntity: ParsedEntity,
    fileId: string,
    repositoryId: string
  ): Promise<ExtractedEntity> {
    const entityId = uuidv4();

    const entity: ExtractedEntity = {
      _key: entityId,
      repositoryId,
      fileId,
      type: parsedEntity.type,
      name: parsedEntity.name,
      signature: parsedEntity.signature || this.generateSignature(parsedEntity),
      location: {
        file: fileId,
        startLine: parsedEntity.location.start.line,
        endLine: parsedEntity.location.end.line,
        startColumn: parsedEntity.location.start.column,
        endColumn: parsedEntity.location.end.column
      },
      parameters: parsedEntity.parameters,
      returnType: parsedEntity.returnType,
      isAsync: parsedEntity.isAsync,
      isExported: parsedEntity.isExported,
      dependencies: parsedEntity.dependencies,
      documentation: parsedEntity.documentation,
      metadata: await this.calculateMetadata(parsedEntity),
      createdAt: new Date()
    };

    return entity;
  }

  private generateSignature(entity: ParsedEntity): string {
    if (entity.signature) return entity.signature;

    switch (entity.type) {
      case 'function':
        const asyncPrefix = entity.isAsync ? 'async ' : '';
        const params = entity.parameters ? `(${entity.parameters.join(', ')})` : '()';
        const returnType = entity.returnType ? `: ${entity.returnType}` : '';
        return `${asyncPrefix}function ${entity.name}${params}${returnType}`;

      case 'class':
        const deps = entity.dependencies && entity.dependencies.length > 0 
          ? ` extends ${entity.dependencies[0]}` 
          : '';
        return `class ${entity.name}${deps}`;

      case 'variable':
        return `var ${entity.name}`;

      case 'import':
        const dep = entity.dependencies?.[0] || '';
        return `import ${entity.name} from '${dep}'`;

      default:
        return entity.name;
    }
  }

  private async calculateMetadata(entity: ParsedEntity): Promise<ExtractedEntity['metadata']> {
    const metadata: ExtractedEntity['metadata'] = {};

    // Calculate lines of code
    if (entity.location) {
      metadata.linesOfCode = entity.location.end.line - entity.location.start.line + 1;
    }

    // Basic complexity calculation for functions
    if (entity.type === 'function') {
      metadata.complexity = this.calculateBasicComplexity(entity);
      metadata.cyclomatic = metadata.complexity; // Simplified
      metadata.maintainabilityIndex = this.calculateMaintainabilityIndex(metadata);
    }

    return metadata;
  }

  private calculateBasicComplexity(entity: ParsedEntity): number {
    // Very basic complexity calculation
    // In a real implementation, this would analyze the function body
    let complexity = 1; // Base complexity

    // Add complexity for parameters
    if (entity.parameters) {
      complexity += Math.min(entity.parameters.length * 0.1, 2);
    }

    // Add complexity for async functions
    if (entity.isAsync) {
      complexity += 0.5;
    }

    // Add complexity based on name patterns (heuristic)
    if (entity.name.includes('process') || entity.name.includes('handle')) {
      complexity += 1;
    }

    return Math.round(complexity * 10) / 10;
  }

  private calculateMaintainabilityIndex(metadata: ExtractedEntity['metadata']): number {
    // Simplified maintainability index calculation
    // Real implementation would use Halstead metrics and cyclomatic complexity
    const complexity = metadata.complexity || 1;
    const loc = metadata.linesOfCode || 1;
    
    // Scale from 0-100, higher is better
    const index = Math.max(0, 100 - (complexity * 10) - (loc * 0.5));
    return Math.round(index * 10) / 10;
  }

  // Additional utility methods for entity analysis
  async enrichEntity(entity: ExtractedEntity, context: any): Promise<ExtractedEntity> {
    // Add contextual information
    if (context.language) {
      entity.metadata = {
        ...entity.metadata,
        language: context.language
      };
    }

    // Add semantic information
    if (entity.type === 'function') {
      entity.metadata = {
        ...entity.metadata,
        purpose: this.inferFunctionPurpose(entity.name),
        category: this.categorizeFunction(entity.name)
      };
    }

    return entity;
  }

  private inferFunctionPurpose(functionName: string): string {
    const name = functionName.toLowerCase();
    
    if (name.startsWith('get') || name.startsWith('fetch') || name.startsWith('load')) {
      return 'data-retrieval';
    }
    if (name.startsWith('set') || name.startsWith('save') || name.startsWith('store')) {
      return 'data-storage';
    }
    if (name.startsWith('create') || name.startsWith('build') || name.startsWith('generate')) {
      return 'creation';
    }
    if (name.startsWith('delete') || name.startsWith('remove') || name.startsWith('destroy')) {
      return 'deletion';
    }
    if (name.startsWith('update') || name.startsWith('modify') || name.startsWith('change')) {
      return 'modification';
    }
    if (name.startsWith('validate') || name.startsWith('check') || name.startsWith('verify')) {
      return 'validation';
    }
    if (name.startsWith('process') || name.startsWith('handle') || name.startsWith('execute')) {
      return 'processing';
    }
    if (name.startsWith('render') || name.startsWith('draw') || name.startsWith('display')) {
      return 'presentation';
    }
    if (name.startsWith('calculate') || name.startsWith('compute') || name.startsWith('analyze')) {
      return 'computation';
    }
    
    return 'utility';
  }

  private categorizeFunction(functionName: string): string {
    const name = functionName.toLowerCase();
    
    if (name.includes('api') || name.includes('request') || name.includes('response')) {
      return 'api';
    }
    if (name.includes('database') || name.includes('db') || name.includes('sql')) {
      return 'database';
    }
    if (name.includes('ui') || name.includes('component') || name.includes('render')) {
      return 'ui';
    }
    if (name.includes('auth') || name.includes('login') || name.includes('permission')) {
      return 'authentication';
    }
    if (name.includes('test') || name.includes('spec') || name.includes('mock')) {
      return 'testing';
    }
    if (name.includes('config') || name.includes('setting') || name.includes('env')) {
      return 'configuration';
    }
    if (name.includes('log') || name.includes('debug') || name.includes('trace')) {
      return 'logging';
    }
    if (name.includes('util') || name.includes('helper') || name.includes('tool')) {
      return 'utility';
    }
    
    return 'business-logic';
  }

  // Method to extract entities by type
  async extractByType(
    parseResult: ParseResult,
    fileId: string,
    repositoryId: string,
    entityType: string
  ): Promise<ExtractedEntity[]> {
    const filteredEntities = parseResult.entities.filter(
      entity => entity.type === entityType
    );

    const extractedEntities: ExtractedEntity[] = [];
    for (const entity of filteredEntities) {
      const extracted = await this.convertToExtractedEntity(entity, fileId, repositoryId);
      extractedEntities.push(extracted);
    }

    return extractedEntities;
  }

  // Method to get entity statistics
  getEntityStatistics(entities: ExtractedEntity[]): {
    total: number;
    byType: Record<string, number>;
    byComplexity: {
      low: number;
      medium: number;
      high: number;
    };
    exported: number;
    documented: number;
  } {
    const stats = {
      total: entities.length,
      byType: {} as Record<string, number>,
      byComplexity: { low: 0, medium: 0, high: 0 },
      exported: 0,
      documented: 0
    };

    entities.forEach(entity => {
      // Count by type
      stats.byType[entity.type] = (stats.byType[entity.type] || 0) + 1;

      // Count by complexity
      const complexity = entity.metadata.complexity || 0;
      if (complexity < 2) stats.byComplexity.low++;
      else if (complexity < 5) stats.byComplexity.medium++;
      else stats.byComplexity.high++;

      // Count exported entities
      if (entity.isExported) stats.exported++;

      // Count documented entities
      if (entity.documentation) stats.documented++;
    });

    return stats;
  }
}
