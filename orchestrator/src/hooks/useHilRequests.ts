import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type {
  GetHilRequestsResponse,
  GetHilRequestResponse,
  SubmitHilResponseParams,
  UpdateHilStatusParams,
} from '@/api-types';

export interface HilRequest {
  id: number;
  order_id: string;
  conversation_id: string;
  question: string;
  context: string | null;
  status: string;
  user_response: string | null;
  resolved_at: number | null;
  created_at: number;
  updated_at: number;
}

interface UseHilRequestsOptions {
  status?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useHilRequests(options: UseHilRequestsOptions = {}) {
  const { status, autoRefresh = false, refreshInterval = 30000 } = options;
  const [requests, setRequests] = useState<HilRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiResponse = await apiClient.getHilRequests({ status });
      if (apiResponse.success && apiResponse.data?.ok && apiResponse.data.requests) {
        setRequests(apiResponse.data.requests);
      } else {
        setError(apiResponse.data?.error || apiResponse.error?.message || 'Failed to fetch HIL requests');
      }
    } catch (err) {
      console.error('Error fetching HIL requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch HIL requests');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchRequests();
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchRequests, refreshInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchRequests, autoRefresh, refreshInterval]);

  return { requests, loading, error, refetch: fetchRequests };
}

export function useHilRequest(id: number | null) {
  const [request, setRequest] = useState<HilRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequest = useCallback(async () => {
    if (!id) {
      setRequest(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiResponse = await apiClient.getHilRequest({ id });
      if (apiResponse.success && apiResponse.data?.ok && apiResponse.data.request) {
        setRequest(apiResponse.data.request);
      } else {
        setError(apiResponse.data?.error || apiResponse.error?.message || 'Failed to fetch HIL request');
      }
    } catch (err) {
      console.error('Error fetching HIL request:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch HIL request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const submitResponse = useCallback(async (userResponse: string) => {
    if (!id) return { ok: false, error: 'No request ID' };

    try {
      const params: SubmitHilResponseParams = { id, user_response: userResponse };
      const apiResponse = await apiClient.submitHilResponse(params);
      if (apiResponse.success && apiResponse.data?.ok && apiResponse.data.request) {
        setRequest(apiResponse.data.request);
        return { ok: true };
      } else {
        return { ok: false, error: apiResponse.data?.error || apiResponse.error?.message };
      }
    } catch (err) {
      console.error('Error submitting HIL response:', err);
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to submit response' };
    }
  }, [id]);

  const updateStatus = useCallback(async (newStatus: 'pending' | 'in_progress' | 'resolved' | 'cancelled') => {
    if (!id) return { ok: false, error: 'No request ID' };

    try {
      const params: UpdateHilStatusParams = { id, status: newStatus };
      const apiResponse = await apiClient.updateHilStatus(params);
      if (apiResponse.success && apiResponse.data?.ok && apiResponse.data.request) {
        setRequest(apiResponse.data.request);
        return { ok: true };
      } else {
        return { ok: false, error: apiResponse.data?.error || apiResponse.error?.message };
      }
    } catch (err) {
      console.error('Error updating HIL status:', err);
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update status' };
    }
  }, [id]);

  return {
    request,
    loading,
    error,
    refetch: fetchRequest,
    submitResponse,
    updateStatus,
  };
}
