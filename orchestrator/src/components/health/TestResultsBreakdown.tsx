import { Card, CardBody, CardHeader, Chip, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { CheckCircle2, XCircle, AlertCircle, TestTube } from 'lucide-react';
import type { HealthCheckStatusResponse } from '@/api-types';

interface TestResultsBreakdownProps {
	status: HealthCheckStatusResponse | null;
	loading?: boolean;
}

export function TestResultsBreakdown({ status, loading = false }: TestResultsBreakdownProps) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<TestTube size={18} className="text-primary" />
						<span className="text-sm font-medium text-default-500">Test Results</span>
					</div>
				</CardHeader>
				<CardBody>
					<div className="space-y-2">
						{[...Array(3)].map((_, i) => (
							<div key={i} className="h-12 bg-default-100 rounded animate-pulse" />
						))}
					</div>
				</CardBody>
			</Card>
		);
	}

	if (!status) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<TestTube size={18} className="text-primary" />
						<span className="text-sm font-medium text-default-500">Test Results</span>
					</div>
				</CardHeader>
				<CardBody>
					<p className="text-sm text-default-500">No test results available</p>
				</CardBody>
			</Card>
		);
	}

	// Aggregate test results from worker results
	const testResults: Array<{
		worker: string;
		type: string;
		status: string;
		count: number;
	}> = [];

	status.worker_results.forEach((workerResult) => {
		// We would need to fetch detailed test results for each worker
		// For now, show worker-level status
		testResults.push({
			worker: workerResult.worker_name,
			type: 'Overall',
			status: workerResult.overall_status ?? workerResult.status,
			count: 1,
		});
	});

	const getStatusColor = (status: string | null): 'success' | 'warning' | 'danger' | 'default' => {
		if (!status) return 'default';
		if (status === 'healthy' || status === 'completed' || status === 'passed') return 'success';
		if (status === 'degraded' || status === 'running') return 'warning';
		if (status === 'unhealthy' || status === 'failed' || status === 'critical') return 'danger';
		return 'default';
	};

	const getStatusIcon = (status: string | null) => {
		if (!status) return <AlertCircle size={14} />;
		if (status === 'healthy' || status === 'completed' || status === 'passed')
			return <CheckCircle2 size={14} />;
		if (status === 'unhealthy' || status === 'failed' || status === 'critical')
			return <XCircle size={14} />;
		return <AlertCircle size={14} />;
	};

	return (
		<Card>
			<CardHeader className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<TestTube size={18} className="text-primary" />
					<span className="text-sm font-medium text-default-500">Test Results Breakdown</span>
				</div>
				<Chip size="sm" variant="flat" color="primary">
					{status.completed_workers} / {status.total_workers} workers
				</Chip>
			</CardHeader>
			<CardBody className="p-0">
				<Table aria-label="Test results breakdown" removeWrapper>
					<TableHeader>
						<TableColumn>Worker</TableColumn>
						<TableColumn>Type</TableColumn>
						<TableColumn>Status</TableColumn>
						<TableColumn>Score</TableColumn>
					</TableHeader>
					<TableBody emptyContent="No test results available">
						{testResults.map((result, index) => (
							<TableRow key={`${result.worker}-${result.type}-${index}`}>
								<TableCell>
									<span className="text-sm font-medium text-foreground">{result.worker}</span>
								</TableCell>
								<TableCell>
									<span className="text-sm text-default-500">{result.type}</span>
								</TableCell>
								<TableCell>
									<Chip
										size="sm"
										color={getStatusColor(result.status)}
										variant="flat"
										startContent={getStatusIcon(result.status)}
									>
										{result.status ?? 'Unknown'}
									</Chip>
								</TableCell>
								<TableCell>
									{status.worker_results.find((r) => r.worker_name === result.worker)
										?.health_score !== null ? (
										<span className="text-sm text-default-500">
											{Math.round(
												(status.worker_results.find((r) => r.worker_name === result.worker)
													?.health_score ?? 0) * 100
											)}
											%
										</span>
									) : (
										<span className="text-sm text-default-400">—</span>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardBody>
		</Card>
	);
}

