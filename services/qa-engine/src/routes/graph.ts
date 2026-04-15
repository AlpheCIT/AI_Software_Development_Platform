/**
 * Graph API Routes — serves code graph data for visualization
 *
 * Endpoints:
 *   GET /qa/graph/seeds          — initial graph nodes + edges
 *   GET /qa/graph/nodes/:id/details — node details
 *   GET /qa/graph/nodes/:id/expand  — expand neighborhood
 *   GET /qa/graph/search         — search nodes by name/path
 */

import { Router, Request, Response } from 'express';

export function createGraphRouter(dbClient: any) {
  const router = Router();

  // ── GET /seeds — return code files + entities as graph nodes ──────────
  router.get('/seeds', async (req: Request, res: Response) => {
    try {
      const repositoryId = req.query.repositoryId as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

      // Get code files as "file" nodes
      const fileBindVars: any = { limit };
      let fileFilter = '';
      if (repositoryId) { fileFilter = 'FILTER f.repositoryId == @repoId'; fileBindVars.repoId = repositoryId; }

      const filesCursor = await dbClient.query(
        `FOR f IN code_files ${fileFilter} LIMIT @limit
         RETURN { id: f._id, label: f.path, type: 'file',
                  metadata: { path: f.path, language: f.language, size: f.size, hasDocumentation: f.hasDocumentation } }`,
        fileBindVars
      );
      const fileNodes = await filesCursor.all();

      // Get code entities as typed nodes (function, class, interface, etc.)
      const entBindVars: any = { limit };
      let entFilter = '';
      if (repositoryId) { entFilter = 'FILTER e.repositoryId == @repoId'; entBindVars.repoId = repositoryId; }

      const entCursor = await dbClient.query(
        `FOR e IN code_entities ${entFilter} LIMIT @limit
         RETURN { id: e._id, label: e.name, type: e.type || 'function',
                  metadata: { file: e.file || e.filePath, signature: e.signature, startLine: e.startLine } }`,
        entBindVars
      );
      const entityNodes = await entCursor.all();

      // Build edges: entity → file (defined_in)
      const edges: any[] = [];
      const filePathToId = new Map(fileNodes.map((f: any) => [f.metadata.path, f.id]));

      for (const entity of entityNodes) {
        const filePath = entity.metadata?.file;
        const fileId = filePathToId.get(filePath);
        if (fileId) {
          edges.push({
            id: `edge_${entity.id}_${fileId}`,
            source: entity.id,
            target: fileId,
            type: 'defined_in',
            label: 'defined in',
          });
        }
      }

      // Build import edges from file content (lightweight regex)
      for (const file of fileNodes) {
        // Look up content from code_files
        try {
          const contentCursor = await dbClient.query(
            `FOR f IN code_files FILTER f._id == @id RETURN f.content`,
            { id: file.id }
          );
          const [content] = await contentCursor.all();
          if (content) {
            // Extract import statements
            const importPattern = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
            let match;
            while ((match = importPattern.exec(content)) !== null) {
              const importPath = match[1] || match[2];
              if (!importPath || importPath.startsWith('.') === false) continue; // skip node_modules
              // Resolve relative path
              const dir = file.metadata.path.split('/').slice(0, -1).join('/');
              const resolved = dir ? `${dir}/${importPath}` : importPath;
              // Find matching file node (fuzzy match without extension)
              const targetFile = fileNodes.find((f: any) =>
                f.metadata.path === resolved ||
                f.metadata.path === `${resolved}.js` ||
                f.metadata.path === `${resolved}.ts` ||
                f.metadata.path === `${resolved}.jsx` ||
                f.metadata.path === `${resolved}.tsx` ||
                f.metadata.path === `${resolved}/index.js` ||
                f.metadata.path === `${resolved}/index.ts`
              );
              if (targetFile) {
                edges.push({
                  id: `import_${file.id}_${targetFile.id}`,
                  source: file.id,
                  target: targetFile.id,
                  type: 'imports',
                  label: 'imports',
                });
              }
            }
          }
        } catch { /* skip content lookup errors */ }
      }

      // Assign positions (simple grid layout — frontend can re-layout)
      const allNodes = [...fileNodes, ...entityNodes];
      const cols = Math.ceil(Math.sqrt(allNodes.length));
      allNodes.forEach((node: any, i: number) => {
        node.position = { x: (i % cols) * 200, y: Math.floor(i / cols) * 150 };
        node.size = node.type === 'file' ? 30 : 20;
        node.color = node.type === 'file' ? '#4299E1'
          : node.type === 'class' ? '#48BB78'
          : node.type === 'function' ? '#ED8936'
          : node.type === 'interface' ? '#9F7AEA'
          : '#A0AEC0';
      });

      res.json({ nodes: allNodes, edges });
    } catch (err: any) {
      console.error('[Graph] Seeds error:', err.message);
      res.json({ nodes: [], edges: [], error: err.message });
    }
  });

  // ── GET /nodes/:id/details — full document by ArangoDB _id ───────────
  router.get('/nodes/:collection/:key/details', async (req: Request, res: Response) => {
    try {
      const docId = `${req.params.collection}/${req.params.key}`;
      const cursor = await dbClient.query(
        `FOR d IN @@collection FILTER d._id == @id RETURN d`,
        { '@collection': req.params.collection, id: docId }
      );
      const docs = await cursor.all();
      if (docs.length === 0) return res.status(404).json({ error: 'Node not found' });
      res.json(docs[0]);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ── GET /nodes/:id/expand — get neighbors ────────────────────────────
  router.get('/nodes/:collection/:key/expand', async (req: Request, res: Response) => {
    try {
      const docId = `${req.params.collection}/${req.params.key}`;
      const limit = parseInt(req.query.limit as string) || 50;

      // Find entities in the same file (if this is a file node)
      const cursor = await dbClient.query(
        `LET node = DOCUMENT(@id)
         LET entities = (
           FOR e IN code_entities
             FILTER e.file == node.path OR e.filePath == node.path
             LIMIT @limit
             RETURN { id: e._id, label: e.name, type: e.type, metadata: { file: e.file, signature: e.signature } }
         )
         LET fileOf = (
           FOR f IN code_files
             FILTER f.path == node.file OR f.path == node.filePath
             LIMIT 1
             RETURN { id: f._id, label: f.path, type: 'file', metadata: { language: f.language, size: f.size } }
         )
         RETURN { entities, fileOf }`,
        { id: docId, limit }
      );
      const [result] = await cursor.all();
      const nodes = [...(result?.entities || []), ...(result?.fileOf || [])];
      const edges = nodes.map((n: any) => ({
        id: `expand_${docId}_${n.id}`,
        source: docId,
        target: n.id,
        type: 'related',
      }));

      res.json({ nodes, edges, metadata: { centerNode: docId, total: nodes.length } });
    } catch (err: any) {
      res.json({ nodes: [], edges: [], error: err.message });
    }
  });

  // ── GET /search — full-text search across code entities ──────────────
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || '').toLowerCase();
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      if (!q || q.length < 2) {
        return res.json({ nodes: [], edges: [] });
      }

      const cursor = await dbClient.query(
        `LET entityResults = (
           FOR e IN code_entities
             FILTER CONTAINS(LOWER(e.name), @q) OR CONTAINS(LOWER(e.file), @q)
             LIMIT @limit
             RETURN { id: e._id, label: e.name, type: e.type, metadata: { file: e.file, signature: e.signature } }
         )
         LET fileResults = (
           FOR f IN code_files
             FILTER CONTAINS(LOWER(f.path), @q)
             LIMIT @limit
             RETURN { id: f._id, label: f.path, type: 'file', metadata: { language: f.language, size: f.size } }
         )
         RETURN { entities: entityResults, files: fileResults }`,
        { q, limit }
      );
      const [result] = await cursor.all();
      const nodes = [...(result?.entities || []), ...(result?.files || [])];

      res.json({ nodes, edges: [] });
    } catch (err: any) {
      res.json({ nodes: [], edges: [], error: err.message });
    }
  });

  return router;
}
