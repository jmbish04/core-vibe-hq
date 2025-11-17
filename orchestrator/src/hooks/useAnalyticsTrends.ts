import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { apiClient } from '@/lib/api-client';
import type { AnalyticsTrendsResponse, AnalyticsTrendsParams } from '@/api-types';

export function useAnalyticsTrends(
	params: AnalyticsTrendsParams,
	autoRefresh = false,
	refreshInterval = 60000
) {
	const { isAuthenticated } = useAuth();
	const [trends, setTrends] = useState<AnalyticsTrendsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchTrends = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const response = await apiClient.getAnalyticsTrends(params);
			if (response.success && response.data) {
				setTrends(response.data);
			} else {
				throw new Error(response.error?.message || 'Failed to fetch analytics trends');
			}
		} catch (err) {
			console.error('Error fetching analytics trends:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch analytics trends');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated, params]);

	useEffect(() => {
		fetchTrends();

		if (autoRefresh && isAuthenticated) {
			intervalRef.current = setInterval(fetchTrends, refreshInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchTrends, autoRefresh, refreshInterval, isAuthenticated]);

	const refresh = useCallback(() => {
		setLoading(true);
		fetchTrends();
	}, [fetchTrends]);

	return { trends, loading, error, refresh };
}

/**
 * Hook for multiple metrics trends
 */
export function useMultipleAnalyticsTrends(
	metrics: AnalyticsTrendsParams[],
	autoRefresh = false,
	refreshInterval = 60000
) {
	const { isAuthenticated } = useAuth();
	const [trendsData, setTrendsData] = useState<Record<string, AnalyticsTrendsResponse>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchAllTrends = useCallback(async () => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		try {
			setError(null);
			const results = await Promise.all(
				metrics.map(async (metricParams) => {
					const response = await apiClient.getAnalyticsTrends(metricParams);
					return {
						key: `${metricParams.metric}-${metricParams.timeframe}`,
						params: metricParams,
						response,
					};
				})
			);

			const newTrendsData: Record<string, AnalyticsTrendsResponse> = {};
			let hasError = false;

			results.forEach(({ key, params, response }) => {
				if (response.success && response.data) {
					newTrendsData[key] = response.data;
				} else {
					hasError = true;
					console.error(`Error fetching trends for ${params.metric}:`, response.error);
				}
			});

			if (hasError && Object.keys(newTrendsData).length === 0) {
				setError('Failed to fetch analytics trends');
			} else {
				setTrendsData(newTrendsData);
				setError(null);
			}
		} catch (err) {
			console.error('Error fetching multiple analytics trends:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch analytics trends');
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated, metrics]);

	useEffect(() => {
		fetchAllTrends();

		if (autoRefresh && isAuthenticated) {
			intervalRef.current = setInterval(fetchAllTrends, refreshInterval);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchAllTrends, autoRefresh, refreshInterval, isAuthenticated]);

	const refresh = useCallback(() => {
		setLoading(true);
		fetchAllTrends();
	}, [fetchAllTrends]);

	return { trendsData, loading, error, refresh };
}

