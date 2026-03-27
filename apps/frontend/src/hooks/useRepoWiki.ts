/**
 * useRepoWiki - React hook for fetching and managing repository wiki data
 * Provides the wiki payload, loading/error state, and file selection.
 */

import { useState, useEffect, useCallback } from 'react';
import { qaService } from '../services/qaService';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WikiFile {
  path: string;
  language: string;
  lineCount: number;
  entityCount: number;
  hasTests: boolean;
  testCount: number;
  riskScore: number;
  hasDocumentation: boolean;
  smells: Array<{
    type: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    line: number;
  }>;
}

export interface WikiEntity {
  name: string;
  type: string;
  file: string;
  signature?: string;
}

export interface WikiData {
  repository: {
    url: string;
    branch: string;
    totalFiles: number;
    totalEntities: number;
    lastAnalyzed: string;
  };
  files: WikiFile[];
  entities: WikiEntity[];
  documentation: {
    documented: number;
    undocumented: number;
    coverage: string;
    gaps: string[];
  };
  summary: {
    topUndocumentedFiles: string[];
    totalTODOs: number;
    codeHealthGrade: string | null;
    codeHealthScore: number | null;
  };
}

export interface UseRepoWikiReturn {
  wikiData: WikiData | null;
  loading: boolean;
  error: string | null;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  refresh: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useRepoWiki(runId: string | null): UseRepoWikiReturn {
  const [wikiData, setWikiData] = useState<WikiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const fetchWiki = useCallback(async () => {
    if (!runId) {
      setWikiData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await qaService.getRepoWiki(runId);
      setWikiData(data as unknown as WikiData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load wiki data';
      setError(message);
      setWikiData(null);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchWiki();
  }, [fetchWiki]);

  // Reset selected file when run changes
  useEffect(() => {
    setSelectedFile(null);
  }, [runId]);

  return {
    wikiData,
    loading,
    error,
    selectedFile,
    setSelectedFile,
    refresh: fetchWiki,
  };
}

export default useRepoWiki;
