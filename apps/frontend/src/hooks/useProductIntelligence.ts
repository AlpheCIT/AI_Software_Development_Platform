/**
 * useProductIntelligence - Hook for fetching product intelligence data
 * Polls every 15 seconds while loading, caches after first successful fetch
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { qaService, type ProductIntelligenceData } from '../services/qaService';

interface UseProductIntelligenceReturn {
  data: ProductIntelligenceData | null;
  loading: boolean;
  error: string | null;
}

const POLL_INTERVAL = 15_000;

export function useProductIntelligence(runId: string | null): UseProductIntelligenceReturn {
  const [data, setData] = useState<ProductIntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cachedRef = useRef<{ runId: string; data: ProductIntelligenceData } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchData = useCallback(async (id: string) => {
    try {
      const result = await qaService.getProductIntelligence(id);
      setData(result);
      setError(null);
      setLoading(false);
      // Cache the successful result
      cachedRef.current = { runId: id, data: result };
      // Stop polling once we have data
      stopPolling();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load product intelligence';
      setError(message);
      // Keep loading true so polling continues
    }
  }, [stopPolling]);

  useEffect(() => {
    // Reset on runId change
    stopPolling();

    if (!runId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Return cached data if it matches the current runId
    if (cachedRef.current && cachedRef.current.runId === runId) {
      setData(cachedRef.current.data);
      setLoading(false);
      setError(null);
      return;
    }

    // Start fresh fetch
    setLoading(true);
    setError(null);
    setData(null);

    // Initial fetch
    fetchData(runId);

    // Poll every 15 seconds while we don't have data
    pollRef.current = setInterval(() => {
      // Only poll if we haven't cached yet
      if (!cachedRef.current || cachedRef.current.runId !== runId) {
        fetchData(runId);
      } else {
        stopPolling();
      }
    }, POLL_INTERVAL);

    return () => {
      stopPolling();
    };
  }, [runId, fetchData, stopPolling]);

  return { data, loading, error };
}

export default useProductIntelligence;
