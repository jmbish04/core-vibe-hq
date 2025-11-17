import { Card, CardBody, CardHeader, Chip, Progress, Skeleton } from '@heroui/react';
import { Cpu, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import type { WorkerHealthResult, WorkersResponse } from '@/api-types';

interface WorkerStatusGridProps {
	workers: WorkersResponse | null;
	workerResults: WorkerHealthResult[];
	loading?: boolean;
	onWorkerClick?: (workerName: string) => void;
}

export function WorkerStatusGrid({
	workers,
	workerResults,
	loading = false,
	onWorkerClick,
}: WorkerStatusGridProps) {
	const getStatusColor = (
		status: string | null,
	): 'success' | 'warning' | 'danger' | 'default' => {
		if (!status) return 'default';
		if (status === 'healthy' || status === 'completed') return 'success';
		if (status === 'degraded' || status === 'running') return 'warning';
		if (status === 'unhealthy' || status === 'failed' || status === 'critical') return 'danger';
		return 'default';
	};

	const getStatusIcon = (status: string | null) => {
		if (!status) return <Clock size={16} />;
		if (status === 'healthy' || status === 'completed') return <CheckCircle2 size={16} />;
		if (status === 'unhealthy' || status === 'failed' || status === 'critical')
			return <XCircle size={16} />;
		return <AlertCircle size={16} />;
	};

	const getWorkerResult = (workerName: string): WorkerHealthResult | undefined => {
		return workerResults.find((r) => r.worker_name === workerName);
	};

	if (loading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{[...Array(6)].map((_, i) => (
					<Card key={i}>
						<CardHeader>
							<Skeleton className="h-4 w-24 rounded" />
						</CardHeader>
						<CardBody>
							<Skeleton className="h-20 w-full rounded" />
						</CardBody>
					</Card>
				))}
			</div>
		);
	}

	if (!workers?.workers || workers.workers.length === 0) {
		return (
			<Card>
				<CardBody className="items-center justify-center py-8">
					<p className="text-sm text-default-500">No workers configured</p>
				</CardBody>
			</Card>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{workers.workers.map((worker) => {
				const result = getWorkerResult(worker.name);
				const status = result?.overall_status ?? result?.status ?? null;
				const healthScore = result?.health_score ?? null;

				return (
					<Card
						key={worker.name}
						isPressable={!!onWorkerClick}
						onPress={() => onWorkerClick?.(worker.name)}
						className={onWorkerClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
					>
						<CardHeader className="flex items-start justify-between gap-2">
							<div className="flex items-center gap-2">
								<Cpu size={16} className="text-default-500" />
								<div>
									<p className="text-sm font-semibold text-foreground">{worker.name}</p>
									<p className="text-xs text-default-500">{worker.type}</p>
								</div>
							</div>
							<Chip
								size="sm"
								color={getStatusColor(status)}
								variant="flat"
								startContent={getStatusIcon(status)}
							>
								{status ?? 'Unknown'}
							</Chip>
						</CardHeader>
						<CardBody className="gap-3">
							{healthScore !== null ? (
								<>
									<div className="flex items-baseline justify-between">
										<span className="text-2xl font-semibold text-foreground">
											{Math.round(healthScore * 100)}%
										</span>
										<span className="text-xs text-default-500">Health score</span>
									</div>
									<Progress
										value={healthScore * 100}
										color={getStatusColor(status)}
										size="sm"
										aria-label={`${worker.name} health score`}
									/>
								</>
							) : (
								<div className="flex items-center justify-center py-4">
									<p className="text-xs text-default-400">No health data available</p>
								</div>
							)}
							{result?.error_message && (
								<p className="text-xs text-danger line-clamp-2">{result.error_message}</p>
							)}
							{result?.completed_at && (
								<p className="text-xs text-default-400">
									Checked {new Date(result.completed_at).toLocaleString()}
								</p>
							)}
						</CardBody>
					</Card>
				);
			})}
		</div>
	);
}

