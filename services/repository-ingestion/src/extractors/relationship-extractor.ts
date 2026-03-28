import { ParseResult, ParsedRelationship } from '../parsers/javascript-parser';
import { ExtractedEntity } from './entity-extractor';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface ExtractedRelationship {
  _key: string;
  repositoryId: string;
  fileId: string;
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'references' | 'depends_on' | 'contains';
  sourceEntityId: string;
  targetEntityId: string;
  sourceEntity: {
    name: string;
    type: string;
  };
  targetEntity: {
    name: string;
    type: string;
  };
  location?: {
    file: string;
    line: number;
    column: number;
  };
  strength: number; // 0.0 to 1.0 indicating relationship strength
  metadata: {
    confidence?: number;
    context?: string;
    frequency?: number;
  };
  createdAt: Date;
}

export class RelationshipExtractor {
  async extract(
    parseResult: ParseResult,
    fileId: string,
    repositoryId: string,
    entities: ExtractedEntity[]
  ): Promise<ExtractedRelationship[]> {
    const relationships: ExtractedRelationship[] = [];

    try {
      // Create entity lookup map for quick reference
      const entityMap = new Map<string, ExtractedEntity>();
      entities.forEach(entity => {
        entityMap.set(entity.name, entity);
      });

      // Extract relationships from parse result
      for (const parsedRelationship of parseResult.relationships) {
        const relationship = await this.convertToExtractedRelationship(
          parsedRelationship,
          fileId,
          repositoryId,
          entityMap
        );
        
        if (relationship) {
          relationships.push(relationship);
        }
      }

      // Extract implicit relationships
      const implicitRelationships = await this.extractImplicitRelationships(
        entities,
        fileId,
        repositoryId
      );
      relationships.push(...implicitRelationships);

      logger.debug(`Extracted ${relationships.length} relationships from file ${fileId}`);
    } catch (error) {
      logger.error('Failed to extract relationships:', error);
      throw error;
    }

    return relationships;
  }

  private async convertToExtractedRelationship(
    parsedRelationship: ParsedRelationship,
    fileId: string,
    repositoryId: string,
    entityMap: Map<string, ExtractedEntity>
  ): Promise<ExtractedRelationship | null> {
    const relationshipId = uuidv4();
    
    const sourceEntity = entityMap.get(parsedRelationship.from);
    const targetEntity = entityMap.get(parsedRelationship.to);

    // Skip if we can't find both entities (might be external dependencies)
    if (!sourceEntity && !targetEntity) {
      return null;
    }

    const relationship: ExtractedRelationship = {
      _key: relationshipId,
      repositoryId,
      fileId,
      type: parsedRelationship.type,
      sourceEntityId: sourceEntity?._key || `external:${parsedRelationship.from}`,
      targetEntityId: targetEntity?._key || `external:${parsedRelationship.to}`,
      sourceEntity: {
        name: parsedRelationship.from,
        type: sourceEntity?.type || 'external'
      },
      targetEntity: {
        name: parsedRelationship.to,
        type: targetEntity?.type || 'external'
      },
      location: parsedRelationship.location ? {
        file: fileId,
        line: parsedRelationship.location.line,
        column: parsedRelationship.location.column
      } : undefined,
      strength: this.calculateRelationshipStrength(parsedRelationship.type),
      metadata: {
        confidence: this.calculateConfidence(parsedRelationship, sourceEntity, targetEntity),
        context: this.getRelationshipContext(parsedRelationship.type),
        frequency: 1
      },
      createdAt: new Date()
    };

    return relationship;
  }

  private async extractImplicitRelationships(
    entities: ExtractedEntity[],
    fileId: string,
    repositoryId: string
  ): Promise<ExtractedRelationship[]> {
    const relationships: ExtractedRelationship[] = [];

    // Extract containment relationships (file contains entities)
    for (const entity of entities) {
      const containmentRelationship: ExtractedRelationship = {
        _key: uuidv4(),
        repositoryId,
        fileId,
        type: 'contains',
        sourceEntityId: fileId,
        targetEntityId: entity._key,
        sourceEntity: {
          name: fileId,
          type: 'file'
        },
        targetEntity: {
          name: entity.name,
          type: entity.type
        },
        strength: 1.0,
        metadata: {
          confidence: 1.0,
          context: 'file-containment',
          frequency: 1
        },
        createdAt: new Date()
      };

      relationships.push(containmentRelationship);
    }

    // Extract dependency relationships based on entity dependencies
    for (const entity of entities) {
      if (entity.dependencies && entity.dependencies.length > 0) {
        for (const dependency of entity.dependencies) {
          const dependentEntity = entities.find(e => e.name === dependency);
          
          if (dependentEntity) {
            const dependencyRelationship: ExtractedRelationship = {
              _key: uuidv4(),
              repositoryId,
              fileId,
              type: 'depends_on',
              sourceEntityId: entity._key,
              targetEntityId: dependentEntity._key,
              sourceEntity: {
                name: entity.name,
                type: entity.type
              },
              targetEntity: {
                name: dependentEntity.name,
                type: dependentEntity.type
              },
              strength: 0.8,
              metadata: {
                confidence: 0.9,
                context: 'dependency-analysis',
                frequency: 1
              },
              createdAt: new Date()
            };

            relationships.push(dependencyRelationship);
          }
        }
      }
    }

    return relationships;
  }

  private calculateRelationshipStrength(type: string): number {
    const strengthMap: Record<string, number> = {
      'calls': 0.8,
      'imports': 0.9,
      'extends': 1.0,
      'implements': 0.9,
      'references': 0.6,
      'depends_on': 0.7,
      'contains': 1.0
    };

    return strengthMap[type] || 0.5;
  }

  private calculateConfidence(
    relationship: ParsedRelationship,
    sourceEntity?: ExtractedEntity,
    targetEntity?: ExtractedEntity
  ): number {
    let confidence = 0.5;

    // Higher confidence if both entities are known
    if (sourceEntity && targetEntity) {
      confidence += 0.3;
    } else if (sourceEntity || targetEntity) {
      confidence += 0.1;
    }

    // Higher confidence for explicit relationships
    if (['extends', 'implements', 'imports'].includes(relationship.type)) {
      confidence += 0.2;
    }

    // Higher confidence if we have location information
    if (relationship.location) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  private getRelationshipContext(type: string): string {
    const contextMap: Record<string, string> = {
      'calls': 'function-invocation',
      'imports': 'module-dependency',
      'extends': 'inheritance',
      'implements': 'interface-implementation',
      'references': 'code-reference',
      'depends_on': 'structural-dependency',
      'contains': 'containment'
    };

    return contextMap[type] || 'unknown';
  }

  /**
   * Return the edge collection name for a given relationship type,
   * or null if there is no dedicated edge collection.
   */
  static getEdgeCollectionName(type: string): string | null {
    const map: Record<string, string> = {
      'imports': 'imports',
      'calls': 'calls',
      'depends_on': 'depends_on',
      'extends': 'extends_class',
      'implements': 'implements_interface',
      'references': 'references',
      'contains': 'contains',
    };
    return map[type] || null;
  }

  // Public methods for relationship analysis
  async groupRelationshipsByType(relationships: ExtractedRelationship[]): Promise<Record<string, ExtractedRelationship[]>> {
    const grouped: Record<string, ExtractedRelationship[]> = {};
    
    relationships.forEach(relationship => {
      if (!grouped[relationship.type]) {
        grouped[relationship.type] = [];
      }
      grouped[relationship.type].push(relationship);
    });

    return grouped;
  }

  async getRelationshipStatistics(relationships: ExtractedRelationship[]): Promise<{
    total: number;
    byType: Record<string, number>;
    averageStrength: number;
    highConfidence: number;
    crossFileRelationships: number;
  }> {
    const stats = {
      total: relationships.length,
      byType: {} as Record<string, number>,
      averageStrength: 0,
      highConfidence: 0,
      crossFileRelationships: 0
    };

    let totalStrength = 0;
    const fileIds = new Set<string>();

    relationships.forEach(relationship => {
      // Count by type
      stats.byType[relationship.type] = (stats.byType[relationship.type] || 0) + 1;
      
      // Calculate average strength
      totalStrength += relationship.strength;
      
      // Count high confidence relationships
      if (relationship.metadata.confidence && relationship.metadata.confidence > 0.8) {
        stats.highConfidence++;
      }
      
      // Track file IDs to identify cross-file relationships
      fileIds.add(relationship.fileId);
    });

    stats.averageStrength = relationships.length > 0 ? totalStrength / relationships.length : 0;
    stats.crossFileRelationships = fileIds.size > 1 ? relationships.length : 0;

    return stats;
  }

  async findStrongRelationships(
    relationships: ExtractedRelationship[],
    strengthThreshold: number = 0.8
  ): Promise<ExtractedRelationship[]> {
    return relationships.filter(rel => rel.strength >= strengthThreshold);
  }

  async findRelationshipClusters(relationships: ExtractedRelationship[]): Promise<Array<{
    entities: string[];
    relationships: ExtractedRelationship[];
    strength: number;
  }>> {
    const clusters: Array<{
      entities: string[];
      relationships: ExtractedRelationship[];
      strength: number;
    }> = [];

    // Group relationships by connected entities
    const entityConnections = new Map<string, Set<string>>();
    
    relationships.forEach(rel => {
      if (!entityConnections.has(rel.sourceEntityId)) {
        entityConnections.set(rel.sourceEntityId, new Set());
      }
      if (!entityConnections.has(rel.targetEntityId)) {
        entityConnections.set(rel.targetEntityId, new Set());
      }
      
      entityConnections.get(rel.sourceEntityId)!.add(rel.targetEntityId);
      entityConnections.get(rel.targetEntityId)!.add(rel.sourceEntityId);
    });

    // Find clusters using simple connected component analysis
    const visited = new Set<string>();
    
    entityConnections.forEach((connections, entityId) => {
      if (!visited.has(entityId)) {
        const cluster = this.findClusterDFS(entityId, entityConnections, visited);
        const clusterRelationships = relationships.filter(rel =>
          cluster.has(rel.sourceEntityId) && cluster.has(rel.targetEntityId)
        );
        
        if (cluster.size > 1) {
          const avgStrength = clusterRelationships.reduce((sum, rel) => sum + rel.strength, 0) / clusterRelationships.length;
          
          clusters.push({
            entities: Array.from(cluster),
            relationships: clusterRelationships,
            strength: avgStrength
          });
        }
      }
    });

    return clusters.sort((a, b) => b.strength - a.strength);
  }

  private findClusterDFS(
    entityId: string,
    connections: Map<string, Set<string>>,
    visited: Set<string>
  ): Set<string> {
    const cluster = new Set<string>();
    const stack = [entityId];
    
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      
      if (!visited.has(currentId)) {
        visited.add(currentId);
        cluster.add(currentId);
        
        const entityConnections = connections.get(currentId);
        if (entityConnections) {
          entityConnections.forEach(connectedId => {
            if (!visited.has(connectedId)) {
              stack.push(connectedId);
            }
          });
        }
      }
    }
    
    return cluster;
  }
}
