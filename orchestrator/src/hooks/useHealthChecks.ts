import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { apiClient } from '@/lib/api-client';
import type {
	HealthCheckSummaryResponse,
	WorkersResponse,
	HealthCheckStatusResponse,
	HealthCheckHistoryResponse,
	InitiateHealthCheckParams,
	InitiateHealthCheckResponse,
} from '@/api-types';

/**
 * Hook for fetching health check summary and latest status
 */
export function useHealthSummary(autoRefresh = false, refreshInterval = 30000) {
	const { isAuthenticated } = useAuth();
	const [summary, setSummary] = useState<HealthCheckSummaryResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchSummary = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const response = await apiClient.getHealthSummary();
			if (response.success && response.data) {
				setSummary(response.data);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch health summary');
			}
		} catch (err) {
			console.error('Error fetching health summary:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch health summary');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		fetchSummary();

		if (autoRefresh && isAuthenticated) {
			intervalRef.current = setInterval(fetchSummary, refreshInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchSummary, autoRefresh, refreshInterval, isAuthenticated]);

	const refresh = useCallback(() => {
		setLoading(true);
		fetchSummary();
	}, [fetchSummary]);

	return { summary, loading, error, refresh };
}

/**
 * Hook for fetching configured workers list
 */
export function useHealthWorkers() {
	const { isAuthenticated } = useAuth();
	const [workers, setWorkers] = useState<WorkersResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchWorkers = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const response = await apiClient.getHealthWorkers();
			if (response.success && response.data) {
				setWorkers(response.data);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch workers');
			}
		} catch (err) {
			console.error('Error fetching workers:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch workers');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		void fetchWorkers();
	}, [fetchWorkers]);

	return { workers, loading, error, refetch: fetchWorkers };
}

/**
 * Hook for fetching health check history with pagination
 */
export function useHealthCheckHistory(
	page: number = 1,
	limit: number = 20,
	triggerType?: string,
	autoRefresh = false,
	refreshInterval = 30000
) {
	const { isAuthenticated } = useAuth();
	const [history, setHistory] = useState<HealthCheckHistoryResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchHistory = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const response = await apiClient.getHealthCheckHistory(page, limit, triggerType);
			if (response.success && response.data) {
				setHistory(response.data);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch health check history');
			}
		} catch (err) {
			console.error('Error fetching health check history:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch health check history');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated, page, limit, triggerType]);

	useEffect(() => {
		fetchHistory();

		if (autoRefresh && isAuthenticated) {
			intervalRef.current = setInterval(fetchHistory, refreshInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchHistory, autoRefresh, refreshInterval, isAuthenticated]);

	const refresh = useCallback(() => {
		setLoading(true);
		fetchHistory();
	}, [fetchHistory]);

	return { history, loading, error, refresh };
}

/**
 * Hook for fetching a specific health check status
 */
export function useHealthCheckStatus(healthCheckUuid: string | undefined) {
	const { isAuthenticated } = useAuth();
	const [status, setStatus] = useState<HealthCheckStatusResponse | null>(null);
	const [loading, setLoading] = useState(!!healthCheckUuid);
	const [error, setError] = useState<string | null>(null);

	const fetchStatus = useCallback(async () => {
		if (!isAuthenticated || !healthCheckUuid) {
			setLoading(false);
			return;
		}

		try {
			setLoading(true);
			setError(null);
			const response = await apiClient.getHealthCheckStatus(healthCheckUuid);
			if (response.success && response.data) {
				setStatus(response.data.result);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch health check status');
			}
		} catch (err) {
			console.error('Error fetching health check status:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch health check status');
			setStatus(null);
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated, healthCheckUuid]);

	useEffect(() => {
		void fetchStatus();
	}, [fetchStatus]);

	return { status, loading, error, refetch: fetchStatus };
}

/**
 * Hook for initiating health checks
 */
export function useInitiateHealthCheck() {
	const { isAuthenticated } = useAuth();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const initiate = useCallback(async (params: InitiateHealthCheckParams) => {
		if (!isAuthenticated) {
			setError('Authentication required');
			return null;
		}

		try {
			setLoading(true);
			setError(null);
			const response = await apiClient.initiateHealthCheck(params);
			if (response.success && response.data) {
				return response.data.result;
			} else {
				throw new Error(response.error?.message || 'Failed to initiate health check');
			}
		} catch (err) {
			console.error('Error initiating health check:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to initiate health check';
			setError(errorMessage);
			return null;
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	return { initiate, loading, error };
}

/**
 * Hook for ops monitoring status
 */
export function useOpsStatus(autoRefresh = false, refreshInterval = 30000) {
	const { isAuthenticated } = useAuth();
	const [status, setStatus] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchStatus = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const response = await apiClient.getOpsStatus();
			if (response.success && response.data) {
				setStatus(response.data);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch ops status');
			}
		} catch (err) {
			console.error('Error fetching ops status:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch ops status');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		fetchStatus();

		if (autoRefresh && isAuthenticated) {
			intervalRef.current = setInterval(fetchStatus, refreshInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchStatus, autoRefresh, refreshInterval, isAuthenticated]);

	return { status, loading, error, refetch: fetchStatus };
}

/**
 * Hook for agent/factory status
 */
export function useAgentStatus(autoRefresh = false, refreshInterval = 30000) {
	const { isAuthenticated } = useAuth();
	const [status, setStatus] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchStatus = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const response = await apiClient.getAgentStatus();
			if (response.success && response.data) {
				setStatus(response.data);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch agent status');
			}
		} catch (err) {
			console.error('Error fetching agent status:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch agent status');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		fetchStatus();

		if (autoRefresh && isAuthenticated) {
			intervalRef.current = setInterval(fetchStatus, refreshInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchStatus, autoRefresh, refreshInterval, isAuthenticated]);

	return { status, loading, error, refetch: fetchStatus };
}

/**
 * Hook for pipeline status
 */
export function usePipelineStatus(autoRefresh = false, refreshInterval = 30000) {
	const { isAuthenticated } = useAuth();
	const [status, setStatus] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchStatus = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const response = await apiClient.getPipelineStatus();
			if (response.success && response.data) {
				setStatus(response.data);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch pipeline status');
			}
		} catch (err) {
			console.error('Error fetching pipeline status:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch pipeline status');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		fetchStatus();

		if (autoRefresh && isAuthenticated) {
			intervalRef.current = setInterval(fetchStatus, refreshInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchStatus, autoRefresh, refreshInterval, isAuthenticated]);

	return { status, loading, error, refetch: fetchStatus };
}

/**
 * Hook for HIL (Human In The Loop) status
 */
export function useHilStatus(autoRefresh = false, refreshInterval = 30000) {
	const { isAuthenticated } = useAuth();
	const [status, setStatus] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchStatus = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const response = await apiClient.getHilStatus();
			if (response.success && response.data) {
				setStatus(response.data);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch HIL status');
			}
		} catch (err) {
			console.error('Error fetching HIL status:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch HIL status');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		fetchStatus();

		if (autoRefresh && isAuthenticated) {
			intervalRef.current = setInterval(fetchStatus, refreshInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchStatus, autoRefresh, refreshInterval, isAuthenticated]);

	return { status, loading, error, refetch: fetchStatus };
}

