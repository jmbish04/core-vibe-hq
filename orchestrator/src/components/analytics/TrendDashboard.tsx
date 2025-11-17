import { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader, Button, Select, SelectItem, Chip } from '@heroui/react';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import { TrendChart } from './TrendChart';
import { useMultipleAnalyticsTrends } from '@/hooks/useAnalyticsTrends';
import type { AnalyticsTrendsParams } from '@/api-types';

interface TrendDashboardProps {
	autoRefresh?: boolean;
	refreshInterval?: number;
	onRefresh?: () => void;
}

const METRICS: Array<{ key: string; label: string; color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' }> = [
	{ key: 'events', label: 'Events', color: 'primary' },
	{ key: 'success_rate', label: 'Success Rate', color: 'success' },
	{ key: 'avg_duration', label: 'Average Duration', color: 'warning' },
	{ key: 'error_rate', label: 'Error Rate', color: 'danger' },
];

const TIMEFRAMES = [
	{ key: '1h', label: 'Last Hour' },
	{ key: '24h', label: 'Last 24 Hours' },
	{ key: '7d', label: 'Last 7 Days' },
	{ key: '30d', label: 'Last 30 Days' },
	{ key: '90d', label: 'Last 90 Days' },
];

const INTERVALS = [
	{ key: '1m', label: '1 Minute' },
	{ key: '5m', label: '5 Minutes' },
	{ key: '15m', label: '15 Minutes' },
	{ key: '1h', label: '1 Hour' },
	{ key: '1d', label: '1 Day' },
];

export function TrendDashboard({
	autoRefresh = false,
	refreshInterval = 60000,
	onRefresh,
}: TrendDashboardProps) {
	const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['events', 'success_rate']));
	const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d' | '30d' | '90d'>('24h');
	const [interval, setInterval] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('1h');

	const trendsParams: AnalyticsTrendsParams[] = useMemo(() => {
		return Array.from(selectedMetrics).map(metric => ({
			metric: metric as AnalyticsTrendsParams['metric'],
			timeframe,
			interval,
		}));
	}, [selectedMetrics, timeframe, interval]);

	const { trendsData, loading, error, refresh } = useMultipleAnalyticsTrends(
		trendsParams,
		autoRefresh,
		refreshInterval
	);

	const handleRefresh = () => {
		refresh();
		onRefresh?.();
	};

	const handleExport = () => {
		// Create CSV export
		const headers = ['Metric', 'Timeframe', 'Interval', 'Timestamp', 'Value', 'Change', 'ChangePercent'];
		const rows: string[] = [headers.join(',')];

		Object.entries(trendsData).forEach(([key, trends]) => {
			const [metric] = key.split('-');
			trends.result.dataPoints.forEach(point => {
				rows.push([
					metric,
					trends.result.timeframe,
					trends.result.interval,
					point.timestamp,
					point.value.toString(),
					(point.change ?? '').toString(),
					(point.changePercent ?? '').toString(),
				].join(','));
			});
		});

		const csvContent = rows.join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', `analytics-trends-${new Date().toISOString().split('T')[0]}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const selectedMetricObjects = METRICS.filter(m => selectedMetrics.has(m.key));

	return (
		<div className="space-y-6">
			{/* Controls */}
			<Card>
				<CardHeader className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Calendar size={18} className="text-primary" />
						<span className="text-lg font-semibold text-foreground">Analytics Trends</span>
					</div>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="flat"
							startContent={<Download size={14} />}
							onPress={handleExport}
							isDisabled={Object.keys(trendsData).length === 0}
						>
							Export CSV
						</Button>
						<Button
							size="sm"
							variant="flat"
							startContent={<RefreshCw size={14} />}
							onPress={handleRefresh}
							isLoading={loading}
						>
							Refresh
						</Button>
					</div>
				</CardHeader>
				<CardBody className="gap-4">
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<label className="text-sm font-medium text-default-700">Metrics</label>
							<div className="flex flex-wrap gap-2">
								{METRICS.map(metric => (
									<Chip
										key={metric.key}
										color={selectedMetrics.has(metric.key) ? metric.color : 'default'}
										variant={selectedMetrics.has(metric.key) ? 'solid' : 'flat'}
										className="cursor-pointer"
										onClick={() => {
											const newSelection = new Set(selectedMetrics);
											if (newSelection.has(metric.key)) {
												newSelection.delete(metric.key);
											} else {
												newSelection.add(metric.key);
											}
											setSelectedMetrics(newSelection);
										}}
									>
										{metric.label}
									</Chip>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium text-default-700">Timeframe</label>
							<Select
								size="sm"
								selectedKeys={[timeframe]}
								onSelectionChange={(keys) => {
									const selected = Array.from(keys)[0] as typeof timeframe;
									setTimeframe(selected);
								}}
							>
								{TIMEFRAMES.map(tf => (
									<SelectItem key={tf.key} value={tf.key}>
										{tf.label}
									</SelectItem>
								))}
							</Select>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium text-default-700">Interval</label>
							<Select
								size="sm"
								selectedKeys={[interval]}
								onSelectionChange={(keys) => {
									const selected = Array.from(keys)[0] as typeof interval;
									setInterval(selected);
								}}
							>
								{INTERVALS.map(int => (
									<SelectItem key={int.key} value={int.key}>
										{int.label}
									</SelectItem>
								))}
							</Select>
						</div>
					</div>

					{error && (
						<div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
							<p className="text-sm text-danger-700">{error}</p>
						</div>
					)}
				</CardBody>
			</Card>

			{/* Charts Grid */}
			<div className="grid gap-6 lg:grid-cols-2">
				{selectedMetricObjects.map(metric => {
					const trendsKey = `${metric.key}-${timeframe}`;
					const trends = trendsData[trendsKey] || null;

					return (
						<TrendChart
							key={metric.key}
							trends={trends}
							loading={loading}
							title={metric.label}
							color={metric.color}
							showSummary={true}
						/>
					);
				})}
			</div>

			{selectedMetrics.size === 0 && (
				<Card>
					<CardBody className="items-center justify-center py-8">
						<p className="text-sm text-default-500">
							Select one or more metrics to view trend charts
						</p>
					</CardBody>
				</Card>
			)}
		</div>
	);
}

