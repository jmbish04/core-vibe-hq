import { Card, CardBody, CardHeader, CircularProgress } from '@heroui/react';
import { Activity } from 'lucide-react';
import type { HealthCheckStatusResponse } from '@/api-types';

interface HealthScoreChartProps {
	status: HealthCheckStatusResponse | null;
	loading?: boolean;
}

export function HealthScoreChart({ status, loading = false }: HealthScoreChartProps) {
	const healthScore = status?.overall_health_score ?? 0;
	const scorePercentage = Math.round(healthScore * 100);

	// Determine color based on health score
	const getColor = (score: number): 'success' | 'warning' | 'danger' => {
		if (score >= 0.8) return 'success';
		if (score >= 0.5) return 'warning';
		return 'danger';
	};

	const getStatusLabel = (score: number): string => {
		if (score >= 0.8) return 'Healthy';
		if (score >= 0.5) return 'Degraded';
		return 'Unhealthy';
	};

	if (loading) {
		return (
			<Card>
				<CardHeader className="flex items-center gap-2">
					<Activity size={18} className="text-primary" />
					<span className="text-sm font-medium text-default-500">Overall Health Score</span>
				</CardHeader>
				<CardBody className="items-center justify-center py-8">
					<CircularProgress aria-label="Loading health score" />
				</CardBody>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Activity size={18} className="text-primary" />
					<span className="text-sm font-medium text-default-500">Overall Health Score</span>
				</div>
				<span className={`text-sm font-semibold text-${getColor(healthScore)}`}>
					{getStatusLabel(healthScore)}
				</span>
			</CardHeader>
			<CardBody className="items-center gap-4 py-6">
				<CircularProgress
					value={scorePercentage}
					size="lg"
					color={getColor(healthScore)}
					showValueLabel
					aria-label={`Health score: ${scorePercentage}%`}
				/>
				<div className="text-center">
					<p className="text-xs text-default-500">
						{status?.completed_workers ?? 0} of {status?.total_workers ?? 0} workers checked
					</p>
					<p className="text-xs text-default-400 mt-1">
						{status?.passed_workers ?? 0} passed • {status?.failed_workers ?? 0} failed
					</p>
				</div>
			</CardBody>
		</Card>
	);
}

