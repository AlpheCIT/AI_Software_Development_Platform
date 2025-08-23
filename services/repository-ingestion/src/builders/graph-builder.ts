import { Database } from '@ai-code-management/database';
import { ExtractedEntity } from '../extractors/entity-extractor';
import { ExtractedRelationship } from '../extractors/relationship-extractor';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface CrossFileRelationship extends ExtractedRelationship {
  crossFileType: 'import' | 'call' | 'inheritance' | 'reference' | 'dependency';
  sourceFile: string;
  targetFile: string;
  pathDistance: number; // Number of directories between files
}

export interface GraphMetrics {
  totalNodes: number;
  totalEdges: number;
  crossFileEdges: number;
  averageDegree: number;
  clusteringCoefficient: number;
  stronglyConnectedComponents: number;
  criticalPaths: Array<{
    path: string[];
    importance: number;
  }>;
}

export class GraphBuilder {
  constructor(private db: Database) {}

  async buildCrossFileRelationships(repositoryId: string): Promise<number> {
    try {
      logger.info(`Building cross-file relationships for repository ${repositoryId}`);

      // Get all entities and files for the repository
      const [entities, files] = await Promise.all([
        this.getAllEntities(repositoryId),
        this.getAllFiles(repositoryId)
      ]);

      // Create file lookup map
      const fileMap = new Map<string, any>();
      files.forEach(file => fileMap.set(file._key, file));

      // Group entities by file
      const entitiesByFile = new Map<string, ExtractedEntity[]>();
      entities.forEach(entity => {
        if (!entitiesByFile.has(entity.fileId)) {
          entitiesByFile.set(entity.fileId, []);
        }
        entitiesByFile.get(entity.fileId)!.push(entity);
      });

      // Create entity lookup by name for cross-file resolution
      const entityLookup = new Map<string, ExtractedEntity[]>();
      entities.forEach(entity => {
        if (!entityLookup.has(entity.name)) {
          entityLookup.set(entity.name, []);
        }
        entityLookup.get(entity.name)!.push(entity);
      });

      let relationshipsCreated = 0;

      // Process each file to find cross-file relationships
      for (const [fileId, fileEntities] of entitiesByFile) {
        const crossFileRels = await this.findCrossFileRelationships(
          fileId,
          fileEntities,
          entityLookup,
          fileMap,
          repositoryId
        );

        // Save cross-file relationships
        for (const relationship of crossFileRels) {
          await this.db.collection('relationships').save(relationship);
          relationshipsCreated++;
        }
      }

      // Build additional graph structures
      await this.buildModuleDependencyGraph(repositoryId);
      await this.buildCallGraph(repositoryId);
      await this.buildInheritanceHierarchy(repositoryId);

      logger.info(`Created ${relationshipsCreated} cross-file relationships for repository ${repositoryId}`);
      return relationshipsCreated;

    } catch (error) {
      logger.error('Failed to build cross-file relationships:', error);
      throw error;
    }
  }

  private async findCrossFileRelationships(
    sourceFileId: string,
    sourceEntities: ExtractedEntity[],
    entityLookup: Map<string, ExtractedEntity[]>,
    fileMap: Map<string, any>,
    repositoryId: string
  ): Promise<CrossFileRelationship[]> {
    const relationships: CrossFileRelationship[] = [];

    for (const sourceEntity of sourceEntities) {
      // Check for imports/dependencies
      if (sourceEntity.dependencies) {
        for (const dependency of sourceEntity.dependencies) {
          const targetEntities = entityLookup.get(dependency) || [];
          
          for (const targetEntity of targetEntities) {
            if (targetEntity.fileId !== sourceFileId) {
              const relationship = await this.createCrossFileRelationship(
                sourceEntity,
                targetEntity,
                'dependency',
                sourceFileId,
                targetEntity.fileId,
                fileMap,
                repositoryId
              );
              relationships.push(relationship);
            }
          }
        }
      }

      // Check for function calls across files
      const callRelationships = await this.findCrossFileCalls(
        sourceEntity,
        sourceFileId,
        entityLookup,
        fileMap,
        repositoryId
      );
      relationships.push(...callRelationships);

      // Check for inheritance relationships
      if (sourceEntity.type === 'class' && sourceEntity.dependencies) {
        for (const baseClass of sourceEntity.dependencies) {
          const baseEntities = entityLookup.get(baseClass) || [];
          
          for (const baseEntity of baseEntities) {
            if (baseEntity.fileId !== sourceFileId && baseEntity.type === 'class') {
              const relationship = await this.createCrossFileRelationship(
                sourceEntity,
                baseEntity,
                'inheritance',
                sourceFileId,
                baseEntity.fileId,
                fileMap,
                repositoryId
              );
              relationships.push(relationship);
            }
          }
        }
      }
    }

    return relationships;
  }

  private async findCrossFileCalls(
    sourceEntity: ExtractedEntity,
    sourceFileId: string,
    entityLookup: Map<string, ExtractedEntity[]>,
    fileMap: Map<string, any>,
    repositoryId: string
  ): Promise<CrossFileRelationship[]> {
    const relationships: CrossFileRelationship[] = [];

    // Get existing call relationships for this entity
    const cursor = await this.db.query(`
      FOR rel IN relationships
      FILTER rel.sourceEntityId == @entityId AND rel.type == 'calls'
      RETURN rel
    `, { entityId: sourceEntity._key });

    const callRelationships = await cursor.all();

    for (const callRel of callRelationships) {
      const targetEntities = entityLookup.get(callRel.targetEntity.name) || [];
      
      for (const targetEntity of targetEntities) {
        if (targetEntity.fileId !== sourceFileId) {
          const relationship = await this.createCrossFileRelationship(
            sourceEntity,
            targetEntity,
            'call',
            sourceFileId,
            targetEntity.fileId,
            fileMap,
            repositoryId
          );
          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  private async createCrossFileRelationship(
    sourceEntity: ExtractedEntity,
    targetEntity: ExtractedEntity,
    crossFileType: CrossFileRelationship['crossFileType'],
    sourceFileId: string,
    targetFileId: string,
    fileMap: Map<string, any>,
    repositoryId: string
  ): Promise<CrossFileRelationship> {
    const sourceFile = fileMap.get(sourceFileId);
    const targetFile = fileMap.get(targetFileId);
    
    const pathDistance = this.calculatePathDistance(
      sourceFile?.path || '',
      targetFile?.path || ''
    );

    const relationship: CrossFileRelationship = {
      _key: uuidv4(),
      repositoryId,
      fileId: sourceFileId,
      type: this.mapCrossFileTypeToRelationType(crossFileType),
      sourceEntityId: sourceEntity._key,
      targetEntityId: targetEntity._key,
      sourceEntity: {
        name: sourceEntity.name,
        type: sourceEntity.type
      },
      targetEntity: {
        name: targetEntity.name,
        type: targetEntity.type
      },
      strength: this.calculateCrossFileStrength(crossFileType, pathDistance),
      metadata: {
        confidence: 0.8,
        context: `cross-file-${crossFileType}`,
        frequency: 1
      },
      createdAt: new Date(),
      crossFileType,
      sourceFile: sourceFile?.path || sourceFileId,
      targetFile: targetFile?.path || targetFileId,
      pathDistance
    };

    return relationship;
  }

  private calculatePathDistance(sourcePath: string, targetPath: string): number {
    const sourceSegments = sourcePath.split('/').filter(s => s.length > 0);
    const targetSegments = targetPath.split('/').filter(s => s.length > 0);
    
    // Find common prefix
    let commonLength = 0;
    for (let i = 0; i < Math.min(sourceSegments.length, targetSegments.length); i++) {
      if (sourceSegments[i] === targetSegments[i]) {
        commonLength++;
      } else {
        break;
      }
    }
    
    // Distance is the sum of unique segments
    return (sourceSegments.length - commonLength) + (targetSegments.length - commonLength);
  }

  private mapCrossFileTypeToRelationType(crossFileType: CrossFileRelationship['crossFileType']): ExtractedRelationship['type'] {
    const mapping: Record<CrossFileRelationship['crossFileType'], ExtractedRelationship['type']> = {
      'import': 'imports',
      'call': 'calls',
      'inheritance': 'extends',
      'reference': 'references',
      'dependency': 'depends_on'
    };
    
    return mapping[crossFileType];
  }

  private calculateCrossFileStrength(crossFileType: CrossFileRelationship['crossFileType'], pathDistance: number): number {
    const baseStrength: Record<CrossFileRelationship['crossFileType'], number> = {
      'import': 0.9,
      'call': 0.7,
      'inheritance': 0.95,
      'reference': 0.5,
      'dependency': 0.8
    };
    
    // Reduce strength based on path distance
    const distancePenalty = Math.min(0.5, pathDistance * 0.1);
    return Math.max(0.1, baseStrength[crossFileType] - distancePenalty);
  }

  private async buildModuleDependencyGraph(repositoryId: string): Promise<void> {
    logger.debug(`Building module dependency graph for repository ${repositoryId}`);

    // Get all files and their imports
    const cursor = await this.db.query(`
      FOR file IN files
      FILTER file.repositoryId == @repositoryId
      LET imports = (
        FOR entity IN entities
        FILTER entity.fileId == file._key AND entity.type == 'import'
        RETURN entity
      )
      RETURN {
        file: file,
        imports: imports
      }
    `, { repositoryId });

    const fileData = await cursor.all();
    
    // Create module-level dependency relationships
    for (const data of fileData) {
      for (const importEntity of data.imports) {
        // Find the target file for this import
        const targetFiles = await this.findFilesByImport(importEntity.dependencies?.[0] || '', repositoryId);
        
        for (const targetFile of targetFiles) {
          const moduleDependency = {
            _key: uuidv4(),
            repositoryId,
            fileId: data.file._key,
            type: 'depends_on',
            sourceEntityId: data.file._key,
            targetEntityId: targetFile._key,
            sourceEntity: {
              name: data.file.path,
              type: 'module'
            },
            targetEntity: {
              name: targetFile.path,
              type: 'module'
            },
            strength: 0.8,
            metadata: {
              confidence: 0.9,
              context: 'module-dependency',
              frequency: 1
            },
            createdAt: new Date()
          };

          await this.db.collection('relationships').save(moduleDependency);
        }
      }
    }
  }

  private async buildCallGraph(repositoryId: string): Promise<void> {
    logger.debug(`Building call graph for repository ${repositoryId}`);

    // Get all function call relationships
    const cursor = await this.db.query(`
      FOR rel IN relationships
      FILTER rel.repositoryId == @repositoryId AND rel.type == 'calls'
      RETURN rel
    `, { repositoryId });

    const callRelationships = await cursor.all();
    
    // Analyze call patterns and create higher-level call graph structures
    const callClusters = await this.identifyCallClusters(callRelationships);
    
    // Store call graph metadata
    for (const cluster of callClusters) {
      const clusterMetadata = {
        _key: uuidv4(),
        repositoryId,
        type: 'call-cluster',
        entities: cluster.entities,
        strength: cluster.avgStrength,
        size: cluster.entities.length,
        metadata: {
          clusterType: 'call-graph',
          centrality: cluster.centrality
        },
        createdAt: new Date()
      };

      await this.db.collection('graph_metadata').save(clusterMetadata);
    }
  }

  private async buildInheritanceHierarchy(repositoryId: string): Promise<void> {
    logger.debug(`Building inheritance hierarchy for repository ${repositoryId}`);

    // Get all inheritance relationships
    const cursor = await this.db.query(`
      FOR rel IN relationships
      FILTER rel.repositoryId == @repositoryId AND rel.type == 'extends'
      RETURN rel
    `, { repositoryId });

    const inheritanceRelationships = await cursor.all();
    
    // Build hierarchy trees
    const hierarchies = await this.buildHierarchyTrees(inheritanceRelationships);
    
    // Store hierarchy metadata
    for (const hierarchy of hierarchies) {
      const hierarchyMetadata = {
        _key: uuidv4(),
        repositoryId,
        type: 'inheritance-hierarchy',
        root: hierarchy.root,
        depth: hierarchy.depth,
        nodeCount: hierarchy.nodeCount,
        metadata: {
          hierarchyType: 'inheritance',
          complexity: hierarchy.complexity
        },
        createdAt: new Date()
      };

      await this.db.collection('graph_metadata').save(hierarchyMetadata);
    }
  }

  // Public methods for graph analysis

  async calculateGraphMetrics(repositoryId: string): Promise<GraphMetrics> {
    const [nodes, edges, crossFileEdges] = await Promise.all([
      this.countNodes(repositoryId),
      this.countEdges(repositoryId),
      this.countCrossFileEdges(repositoryId)
    ]);

    const averageDegree = nodes > 0 ? (edges * 2) / nodes : 0;
    const clusteringCoefficient = await this.calculateClusteringCoefficient(repositoryId);
    const stronglyConnectedComponents = await this.countStronglyConnectedComponents(repositoryId);
    const criticalPaths = await this.findCriticalPaths(repositoryId);

    return {
      totalNodes: nodes,
      totalEdges: edges,
      crossFileEdges,
      averageDegree,
      clusteringCoefficient,
      stronglyConnectedComponents,
      criticalPaths
    };
  }

  async findCriticalPaths(repositoryId: string, limit: number = 10): Promise<Array<{ path: string[]; importance: number; }>> {
    // Find paths with high importance (many dependencies)
    const cursor = await this.db.query(`
      FOR entity IN entities
      FILTER entity.repositoryId == @repositoryId
      LET inDegree = LENGTH(
        FOR rel IN relationships
        FILTER rel.targetEntityId == entity._key
        RETURN rel
      )
      LET outDegree = LENGTH(
        FOR rel IN relationships
        FILTER rel.sourceEntityId == entity._key
        RETURN rel
      )
      SORT (inDegree + outDegree) DESC
      LIMIT @limit
      RETURN {
        entity: entity.name,
        importance: inDegree + outDegree,
        inDegree: inDegree,
        outDegree: outDegree
      }
    `, { repositoryId, limit });

    const criticalEntities = await cursor.all();
    
    return criticalEntities.map(item => ({
      path: [item.entity],
      importance: item.importance
    }));
  }

  // Utility methods

  private async getAllEntities(repositoryId: string): Promise<ExtractedEntity[]> {
    const cursor = await this.db.query(`
      FOR entity IN entities
      FILTER entity.repositoryId == @repositoryId
      RETURN entity
    `, { repositoryId });
    
    return cursor.all();
  }

  private async getAllFiles(repositoryId: string): Promise<any[]> {
    const cursor = await this.db.query(`
      FOR file IN files
      FILTER file.repositoryId == @repositoryId
      RETURN file
    `, { repositoryId });
    
    return cursor.all();
  }

  private async findFilesByImport(importPath: string, repositoryId: string): Promise<any[]> {
    // Simple heuristic to match import paths to files
    const cursor = await this.db.query(`
      FOR file IN files
      FILTER file.repositoryId == @repositoryId
      FILTER CONTAINS(file.path, @importPath) OR CONTAINS(@importPath, file.path)
      RETURN file
    `, { repositoryId, importPath });
    
    return cursor.all();
  }

  private async identifyCallClusters(callRelationships: any[]): Promise<Array<{
    entities: string[];
    avgStrength: number;
    centrality: number;
  }>> {
    // Simplified clustering algorithm
    const clusters: Array<{
      entities: string[];
      avgStrength: number;
      centrality: number;
    }> = [];

    // Group by high-frequency call patterns
    const callCounts = new Map<string, number>();
    
    callRelationships.forEach(rel => {
      const key = `${rel.sourceEntityId}-${rel.targetEntityId}`;
      callCounts.set(key, (callCounts.get(key) || 0) + 1);
    });

    // Simple clustering based on call frequency
    const highFrequencyCalls = Array.from(callCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }));

    // Create clusters (simplified)
    const entityGroups = new Map<string, Set<string>>();
    
    highFrequencyCalls.forEach(({ key }) => {
      const [source, target] = key.split('-');
      if (!entityGroups.has(source)) {
        entityGroups.set(source, new Set([source]));
      }
      entityGroups.get(source)!.add(target);
    });

    // Convert to cluster format
    entityGroups.forEach((entities, rootEntity) => {
      if (entities.size > 1) {
        clusters.push({
          entities: Array.from(entities),
          avgStrength: 0.7, // Simplified
          centrality: entities.size / callRelationships.length
        });
      }
    });

    return clusters;
  }

  private async buildHierarchyTrees(inheritanceRelationships: any[]): Promise<Array<{
    root: string;
    depth: number;
    nodeCount: number;
    complexity: number;
  }>> {
    const hierarchies: Array<{
      root: string;
      depth: number;
      nodeCount: number;
      complexity: number;
    }> = [];

    // Build parent-child maps
    const children = new Map<string, string[]>();
    const parents = new Map<string, string>();
    
    inheritanceRelationships.forEach(rel => {
      const parent = rel.targetEntityId;
      const child = rel.sourceEntityId;
      
      if (!children.has(parent)) {
        children.set(parent, []);
      }
      children.get(parent)!.push(child);
      parents.set(child, parent);
    });

    // Find roots (nodes with no parents)
    const allNodes = new Set([
      ...inheritanceRelationships.map(rel => rel.sourceEntityId),
      ...inheritanceRelationships.map(rel => rel.targetEntityId)
    ]);

    const roots = Array.from(allNodes).filter(node => !parents.has(node));
    
    // Calculate hierarchy metrics for each root
    for (const root of roots) {
      const { depth, nodeCount } = this.calculateTreeMetrics(root, children);
      const complexity = this.calculateHierarchyComplexity(depth, nodeCount);
      
      hierarchies.push({
        root,
        depth,
        nodeCount,
        complexity
      });
    }

    return hierarchies;
  }

  private calculateTreeMetrics(root: string, children: Map<string, string[]>): { depth: number; nodeCount: number } {
    let maxDepth = 0;
    let nodeCount = 0;
    
    const traverse = (node: string, currentDepth: number) => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, currentDepth);
      
      const childNodes = children.get(node) || [];
      for (const child of childNodes) {
        traverse(child, currentDepth + 1);
      }
    };
    
    traverse(root, 0);
    
    return { depth: maxDepth, nodeCount };
  }

  private calculateHierarchyComplexity(depth: number, nodeCount: number): number {
    // Simple complexity metric: more depth and nodes = higher complexity
    return Math.log(nodeCount + 1) * Math.sqrt(depth + 1);
  }

  private async countNodes(repositoryId: string): Promise<number> {
    const cursor = await this.db.query(`
      RETURN LENGTH(
        FOR entity IN entities
        FILTER entity.repositoryId == @repositoryId
        RETURN entity
      )
    `, { repositoryId });
    
    const result = await cursor.next();
    return result || 0;
  }

  private async countEdges(repositoryId: string): Promise<number> {
    const cursor = await this.db.query(`
      RETURN LENGTH(
        FOR rel IN relationships
        FILTER rel.repositoryId == @repositoryId
        RETURN rel
      )
    `, { repositoryId });
    
    const result = await cursor.next();
    return result || 0;
  }

  private async countCrossFileEdges(repositoryId: string): Promise<number> {
    const cursor = await this.db.query(`
      RETURN LENGTH(
        FOR rel IN relationships
        FILTER rel.repositoryId == @repositoryId
        LET sourceEntity = DOCUMENT('entities', rel.sourceEntityId)
        LET targetEntity = DOCUMENT('entities', rel.targetEntityId)
        FILTER sourceEntity.fileId != targetEntity.fileId
        RETURN rel
      )
    `, { repositoryId });
    
    const result = await cursor.next();
    return result || 0;
  }

  private async calculateClusteringCoefficient(repositoryId: string): Promise<number> {
    // Simplified clustering coefficient calculation
    // In a real implementation, this would calculate the actual clustering coefficient
    const nodes = await this.countNodes(repositoryId);
    const edges = await this.countEdges(repositoryId);
    
    if (nodes < 3) return 0;
    
    const maxPossibleEdges = (nodes * (nodes - 1)) / 2;
    return edges / maxPossibleEdges;
  }

  private async countStronglyConnectedComponents(repositoryId: string): Promise<number> {
    // Simplified SCC counting
    // In a real implementation, this would use Tarjan's or Kosaraju's algorithm
    const cursor = await this.db.query(`
      FOR entity IN entities
      FILTER entity.repositoryId == @repositoryId
      COLLECT file = entity.fileId WITH COUNT INTO count
      RETURN count
    `, { repositoryId });
    
    const fileCounts = await cursor.all();
    return fileCounts.length; // Approximation: each file is a component
  }
}
