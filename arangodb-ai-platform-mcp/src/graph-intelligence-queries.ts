/**
 * Graph Intelligence Query Library
 * Provides reusable AQL queries for advanced graph analysis
 */

export interface GraphQueryResult {
  query: string;
  bindVars: Record<string, any>;
}

/**
 * Impact Analysis (Blast Radius)
 * Find everything that depends on a given entity transitively
 */
export function impactAnalysisQuery(nodeId: string, collection: string, maxDepth: number = 3, limit: number = 100): GraphQueryResult {
  return {
    query: `
      LET startNode = CONCAT(@collection, "/", @nodeId)
      FOR vertex, edge, path IN 1..@maxDepth INBOUND startNode
        GRAPH "knowledge_graph"
        OPTIONS { uniqueVertices: "global", order: "bfs" }
        LIMIT @limit
        RETURN DISTINCT {
          id: vertex._key,
          name: vertex.name || vertex.title || vertex._key,
          type: vertex.type || SPLIT(vertex._id, "/")[0],
          collection: SPLIT(vertex._id, "/")[0],
          distance: LENGTH(path.edges),
          edgeType: edge.type || 'unknown'
        }
    `,
    bindVars: { nodeId, collection, maxDepth, limit }
  };
}

/**
 * Hub Detection (Centrality)
 * Find the most-connected nodes across dependency edges
 */
export function hubDetectionQuery(topN: number = 20): GraphQueryResult {
  return {
    query: `
      LET edgeCollections = ["depends_on", "imports", "calls"]

      FOR entity IN code_entities
        LET inbound = (
          FOR ec IN edgeCollections
            FOR e IN PARSE_IDENTIFIER(ec).collection
              FILTER e._to == entity._id
              RETURN 1
        )
        LET outbound = (
          FOR ec IN edgeCollections
            FOR e IN PARSE_IDENTIFIER(ec).collection
              FILTER e._from == entity._id
              RETURN 1
        )
        LET inDeg = LENGTH(inbound)
        LET outDeg = LENGTH(outbound)
        LET totalConnections = inDeg + outDeg
        FILTER totalConnections > 0
        SORT totalConnections DESC
        LIMIT @topN
        RETURN {
          id: entity._key,
          name: entity.name || entity._key,
          filePath: entity.file_path || entity.filePath,
          type: entity.type,
          inDegree: inDeg,
          outDegree: outDeg,
          totalConnections: totalConnections,
          isHub: inDeg > 5
        }
    `,
    bindVars: { topN }
  };
}

/**
 * Cycle Detection
 * Find circular dependencies in the graph
 */
export function cycleDetectionQuery(maxCycleLength: number = 5, limit: number = 20): GraphQueryResult {
  return {
    query: `
      FOR startVertex IN code_entities
        FOR vertex, edge, path IN 2..@maxCycleLength OUTBOUND startVertex._id
          GRAPH "knowledge_graph"
          PRUNE vertex._id == startVertex._id
          OPTIONS { uniqueVertices: "path" }
          FILTER vertex._id == startVertex._id
          LIMIT @limit
          RETURN DISTINCT {
            cycleNodes: path.vertices[*]._key,
            cycleNames: path.vertices[*].name,
            length: LENGTH(path.edges),
            edgeTypes: path.edges[*].type
          }
    `,
    bindVars: { maxCycleLength, limit }
  };
}

/**
 * Risk Propagation
 * Given a collection of findings, propagate risk through the dependency graph
 */
export function riskPropagationQuery(repositoryId: string, maxDepth: number = 3): GraphQueryResult {
  return {
    query: `
      FOR finding IN security_findings
        FILTER finding.repository_id == @repositoryId OR finding.repositoryId == @repositoryId
        FILTER finding.severity IN ["critical", "high", "CRITICAL", "HIGH"]
        LET affectedEntities = (
          FOR vertex, edge, path IN 1..@maxDepth INBOUND finding._id
            GRAPH "knowledge_graph"
            OPTIONS { uniqueVertices: "global" }
            RETURN {
              id: vertex._key,
              name: vertex.name || vertex._key,
              distance: LENGTH(path.edges),
              collection: SPLIT(vertex._id, "/")[0]
            }
        )
        RETURN {
          findingId: finding._key,
          severity: finding.severity,
          title: finding.title || finding.description,
          blastRadius: LENGTH(affectedEntities),
          affectedEntities: affectedEntities
        }
    `,
    bindVars: { repositoryId, maxDepth }
  };
}

/**
 * Orphan Detection
 * Find code entities with zero inbound edges (potential dead code)
 */
export function orphanDetectionQuery(repositoryId: string, limit: number = 50): GraphQueryResult {
  return {
    query: `
      FOR entity IN code_entities
        FILTER entity.repositoryId == @repositoryId OR entity.repository_id == @repositoryId
        LET inbound = LENGTH(
          FOR e IN depends_on
            FILTER e._to == entity._id
            LIMIT 1
            RETURN 1
        ) + LENGTH(
          FOR e IN imports
            FILTER e._to == entity._id
            LIMIT 1
            RETURN 1
        ) + LENGTH(
          FOR e IN calls
            FILTER e._to == entity._id
            LIMIT 1
            RETURN 1
        )
        FILTER inbound == 0
        FILTER entity.isExported == true OR entity.type IN ["function", "class"]
        SORT entity.name ASC
        LIMIT @limit
        RETURN {
          id: entity._key,
          name: entity.name,
          type: entity.type,
          filePath: entity.file_path || entity.filePath,
          reason: "No inbound dependencies found"
        }
    `,
    bindVars: { repositoryId, limit }
  };
}

/**
 * Critical Path Analysis
 * Find shortest path between two nodes
 */
export function criticalPathQuery(fromCollection: string, fromKey: string, toCollection: string, toKey: string): GraphQueryResult {
  return {
    query: `
      LET fromNode = CONCAT(@fromCollection, "/", @fromKey)
      LET toNode = CONCAT(@toCollection, "/", @toKey)
      FOR path IN OUTBOUND SHORTEST_PATH fromNode TO toNode
        GRAPH "knowledge_graph"
        RETURN {
          vertices: path.vertices[*]._key,
          vertexNames: path.vertices[*].name,
          edges: path.edges[*].type,
          length: LENGTH(path.edges)
        }
    `,
    bindVars: { fromCollection, fromKey, toCollection, toKey }
  };
}
