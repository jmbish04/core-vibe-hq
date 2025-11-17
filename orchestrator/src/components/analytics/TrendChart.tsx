import { Card, CardBody, CardHeader } from '@heroui/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useMemo } from 'react';
import type { AnalyticsTrendsResponse } from '@/api-types';

interface TrendChartProps {
	trends: AnalyticsTrendsResponse | null;
	loading?: boolean;
	title?: string;
	color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
	height?: number;
	showSummary?: boolean;
}

export function TrendChart({
	trends,
	loading = false,
	title = 'Trend',
	color = 'primary',
	height = 200,
	showSummary = true,
}: TrendChartProps) {
	const chartData = useMemo(() => {
		if (!trends?.result?.dataPoints) return [];

		return trends.result.dataPoints.map((point, index) => ({
			x: new Date(point.timestamp).getTime(),
			y: point.value,
			change: point.change,
			changePercent: point.changePercent,
		}));
	}, [trends]);

	const summary = trends?.result?.summary;

	const getTrendIcon = (trend: string) => {
		switch (trend) {
			case 'increasing':
				return <TrendingUp size={16} className="text-success" />;
			case 'decreasing':
				return <TrendingDown size={16} className="text-danger" />;
			default:
				return <Minus size={16} className="text-default-500" />;
		}
	};

	const getTrendColor = (trend: string) => {
		switch (trend) {
			case 'increasing':
				return 'text-success';
			case 'decreasing':
				return 'text-danger';
			default:
				return 'text-default-500';
		}
	};

	if (loading) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<div className="h-4 w-24 bg-default-100 animate-pulse rounded" />
					</div>
				</CardHeader>
				<CardBody>
					<div className={`h-${height / 4} bg-default-100 animate-pulse rounded`} />
				</CardBody>
			</Card>
		);
	}

	if (!trends || chartData.length === 0) {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-default-500">{title}</span>
					</div>
				</CardHeader>
				<CardBody>
					<div className="flex items-center justify-center py-8">
						<p className="text-sm text-default-500">No trend data available</p>
					</div>
				</CardBody>
			</Card>
		);
	}

	// Simple SVG line chart
	const minValue = Math.min(...chartData.map(d => d.y));
	const maxValue = Math.max(...chartData.map(d => d.y));
	const valueRange = maxValue - minValue || 1;

	const points = chartData.map((data, index) => {
		const x = (index / (chartData.length - 1)) * (100 - 10) + 5; // 5% margin
		const y = height - 40 - ((data.y - minValue) / valueRange) * (height - 80); // 40px margins
		return `${x},${y}`;
	}).join(' ');

	const areaPoints = `${points} ${100 - 5},${height - 40} ${5},${height - 40}`;

	return (
		<Card>
			<CardHeader className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium text-default-500">{title}</span>
					{trends.result.metric && (
						<span className="text-xs text-default-400">
							{trends.result.metric.replace('_', ' ')}
						</span>
					)}
				</div>
				{showSummary && summary && (
					<div className="flex items-center gap-1">
						{getTrendIcon(summary.trend)}
						<span className={`text-xs font-medium ${getTrendColor(summary.trend)}`}>
							{summary.changePercent > 0 ? '+' : ''}{summary.changePercent.toFixed(1)}%
						</span>
					</div>
				)}
			</CardHeader>
			<CardBody className="p-4">
				<div className="relative" style={{ height: height - 80 }}>
					{/* Y-axis labels */}
					<div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-default-400 -ml-8">
						<span>{maxValue.toFixed(1)}</span>
						<span>{summary?.average?.toFixed(1) || ''}</span>
						<span>{minValue.toFixed(1)}</span>
					</div>

					{/* Chart area */}
					<svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
						{/* Grid lines */}
						<line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
						<line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
						<line x1="0" y1="80" x2="100" y2="80" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />

						{/* Area fill */}
						<polygon
							points={areaPoints}
							fill={`hsl(var(--heroui-${color}))`}
							fillOpacity="0.1"
						/>

						{/* Line */}
						<polyline
							points={points}
							fill="none"
							stroke={`hsl(var(--heroui-${color}))`}
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>

						{/* Data points */}
						{chartData.map((data, index) => {
							const x = (index / (chartData.length - 1)) * (100 - 10) + 5;
							const y = 100 - 40 - ((data.y - minValue) / valueRange) * (100 - 80);
							return (
								<circle
									key={index}
									cx={x}
									cy={y}
									r="1.5"
									fill={`hsl(var(--heroui-${color}))`}
								/>
							);
						})}
					</svg>
				</div>

				{/* Summary stats */}
				{showSummary && summary && (
					<div className="mt-4 grid grid-cols-2 gap-4 text-xs">
						<div>
							<span className="text-default-500">Average: </span>
							<span className="font-medium">{summary.average.toFixed(2)}</span>
						</div>
						<div>
							<span className="text-default-500">Total: </span>
							<span className="font-medium">{summary.total.toLocaleString()}</span>
						</div>
					</div>
				)}
			</CardBody>
		</Card>
	);
}

