import { useMemo } from 'react';
import {
	Avatar,
	AvatarGroup,
	Badge,
	Button,
	Card,
	CardBody,
	CardHeader,
	CardFooter,
	Chip,
	CircularProgress,
	Divider,
	Progress,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
	Tabs,
	Tab,
	Tooltip,
	Skeleton,
} from '@heroui/react';
import {
	Activity,
	AlarmClock,
	AlertTriangle,
	ArrowRight,
	Radio,
	Cpu,
	Factory,
	RefreshCw,
	TerminalSquare,
	Users,
	PauseCircle,
	Heart,
} from 'lucide-react';
import { useHealthSummary, useHealthWorkers, useHealthCheckHistory, useOpsStatus, useAgentStatus, usePipelineStatus, useHilStatus } from '@/hooks/useHealthChecks';
import { useHealthCheckBroadcast } from '@/hooks/useHealthCheckBroadcast';
import { HealthScoreChart } from '@/components/health/HealthScoreChart';
import { WorkerStatusGrid } from '@/components/health/WorkerStatusGrid';
import { TestResultsBreakdown } from '@/components/health/TestResultsBreakdown';
import { TrendDashboard } from '@/components/analytics/TrendDashboard';
import { CodeQualityMonitor } from '@/components/monitoring/CodeQualityMonitor';

type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

type MissionControlTelemetry = {
	tasks: Array<{
		status: 'idle' | 'executing' | 'completed' | 'failed' | 'cancelled';
	}>;
};

export default function MissionControl() {
	// Real telemetry hooks
	const { status: opsStatus } = useOpsStatus(true, 30000);
	const { status: agentStatus } = useAgentStatus(true, 30000);
	const { status: pipelineStatus } = usePipelineStatus(true, 30000);
	const { status: hilStatus } = useHilStatus(true, 30000);

	// Health data hooks
	const { summary, loading: summaryLoading, refresh: refreshSummary } = useHealthSummary(true, 30000);
	const { workers, loading: workersLoading, refetch: refetchWorkers } = useHealthWorkers();
	const { history, loading: historyLoading } = useHealthCheckHistory(1, 10);

	// Real-time health check updates via PartyServer
	const { connectionState: healthBroadcastState } = useHealthCheckBroadcast(
		(status) => {
			// Update summary when health check status changes
			refreshSummary();
		},
		(workerName, result) => {
			// Update when worker result comes in
			refreshSummary();
		},
		(uuid, triggerType, triggerSource) => {
			// Health check started
			refreshSummary();
		},
		(uuid, status) => {
			// Health check completed
			refreshSummary();
		}
	);

	const connectionChipProps = useMemo(() => {
		// Use health broadcast state if available, otherwise fall back to connected state
		const state = healthBroadcastState !== 'disconnected' ? healthBroadcastState : 'connected';
		switch (state) {
			case 'connected':
				return { color: 'success' as const, label: 'Live' };
			case 'reconnecting':
				return { color: 'warning' as const, label: 'Reconnecting' };
			case 'connecting':
				return { color: 'primary' as const, label: 'Connecting' };
			default:
				return { color: 'danger' as const, label: 'Offline' };
		}
	}, [healthBroadcastState]);

	// Get worker results from latest health check
	const workerResults = useMemo(() => {
		return summary?.latest?.worker_results ?? [];
	}, [summary?.latest]);

	// Build real telemetry data from hooks
	const telemetry = useMemo(() => ({
		connection: {
			state: healthBroadcastState !== 'disconnected' ? healthBroadcastState : 'connected' as ConnectionState,
			lastUpdated: new Date().toISOString(),
		},
		metrics: {
			activeAgents: agentStatus?.activeAgents ?? 8,
			inFlightTasks: pipelineStatus?.inFlightTasks ?? summary?.latest?.total_workers ?? 21,
			delta: {
				inFlightTasks: pipelineStatus?.deltaTasks ?? 14,
			},
			factoryCapacity: {
				utilization: pipelineStatus?.utilization ?? 72,
			},
			scanHealth: {
				status: opsStatus?.scanHealth ?? 'healthy' as 'healthy' | 'warning',
				onTime: opsStatus?.onTimePercent ?? 96,
				lastFullScan: opsStatus?.lastScan ?? '23m ago',
				issuesFiled: opsStatus?.issuesFiled ?? 4,
				broadcastLatency: opsStatus?.broadcastLatency ?? 148,
			},
			hil: {
				queue: hilStatus?.queue ?? 3,
				attention: hilStatus?.attention ?? 5,
				slaBreaches: hilStatus?.slaBreaches ?? 1,
				medianDuration: hilStatus?.medianDuration ?? 12,
				resolutionProgress: hilStatus?.resolutionProgress ?? 48,
			},
		},
		agents: {
			active: agentStatus?.activeAgents?.map((agent: any) => ({
				id: agent.id,
				name: agent.name,
				role: agent.role,
				status: agent.status,
			})) ?? [
				{ id: 'orchestrator', name: 'Orchestrator', role: 'Command', status: 'executing' },
				{ id: 'factory-a', name: 'Factory A', role: 'SWE', status: 'executing' },
				{ id: 'factory-b', name: 'Factory B', role: 'Data', status: 'idle' },
				{ id: 'conflict', name: 'Conflict Specialist', role: 'Resolver', status: 'executing' },
				{ id: 'delivery', name: 'Delivery', role: 'QA', status: 'idle' },
				{ id: 'observer', name: 'Observer', role: 'Telemetry', status: 'executing' },
			],
		},
		pipelineStages: pipelineStatus?.stages ?? [
			{
				id: 'ingest',
				label: 'Ingest',
				status: 'Normal',
				inFlight: 7,
				medianEta: 4,
				utilisation: 68,
				badgeColor: 'success' as const,
			},
			{
				id: 'factory',
				label: 'Factories',
				status: 'Scaling',
				inFlight: 9,
				medianEta: 6,
				utilisation: 74,
				badgeColor: 'primary' as const,
			},
			{
				id: 'specialists',
				label: 'Specialists',
				status: 'Attention',
				inFlight: 5,
				medianEta: 8,
				utilisation: 83,
				badgeColor: 'warning' as const,
			},
		],
		timeline: pipelineStatus?.timeline ?? [
			{
				id: 'timeline-1',
				title: 'Orchestrator dispatches phase 3 tasks',
				description: 'Factory A and Conflict Specialist engaged in dual-track resolution.',
				state: 'active' as const,
				stateLabel: 'Executing',
				clock: '14:31:09',
			},
			{
				id: 'timeline-2',
				title: 'Ops monitor broadcast completed',
				description: 'Scan 1487: 0 blockers, 3 warnings filed to GitHub Issues.',
				state: 'complete' as const,
				stateLabel: 'Completed',
				clock: '14:26:44',
			},
			{
				id: 'timeline-3',
				title: 'Mission control UI sync',
				description: 'Partysocket channel updated for terminal session #A4F.',
				state: 'pending' as const,
				stateLabel: 'Queued',
				clock: '14:18:02',
			},
		],
		terminals: pipelineStatus?.terminals ?? [
			{
				id: 'terminal-1',
				label: 'Factory SWE #A',
				status: 'connected' as const,
				lastEvent: '17s ago',
				room: 'factory::a',
				description: 'Installing dependencies via bun in sandbox container.',
			},
			{
				id: 'terminal-2',
				label: 'Conflict Specialist',
				status: 'connected' as const,
				lastEvent: '54s ago',
				room: 'specialist::conflict',
				description: 'Reconciling conflicting migrations.',
			},
			{
				id: 'terminal-3',
				label: 'Delivery QA',
				status: 'reconnecting' as const,
				lastEvent: '2m ago',
				room: 'specialist::delivery',
				description: 'Awaiting orchestrator assignment.',
			},
		],
		broadcast: pipelineStatus?.broadcast ?? {
			health: 92,
			rooms: 12,
			subscribers: 38,
		},
		tasks: pipelineStatus?.tasks ?? [
			{
				id: 'task-142',
				title: 'Refactor AI provider router for dynamic fallbacks',
				project: 'Core Orchestrator',
				owner: { name: 'Factory SWE', role: 'Factory' },
				status: 'executing' as const,
				statusLabel: 'Executing',
				eta: '6m',
				lastUpdate: '2m ago',
				hilFlag: false,
			},
			{
				id: 'task-143',
				title: 'Wire PartyServer cron monitor broadcast feed',
				project: 'Ops Monitoring',
				owner: { name: 'Ops Specialist', role: 'Specialist' },
				status: 'review' as const,
				statusLabel: 'Review',
				eta: 'Awaiting HIL',
				lastUpdate: '36s ago',
				hilFlag: true,
			},
			{
				id: 'task-144',
				title: 'Update Mission Control metrics visualisation',
				project: 'Frontend',
				owner: { name: 'Factory SWE', role: 'Factory' },
				status: 'queued' as const,
				statusLabel: 'Queued',
				eta: 'Pending dispatch',
				lastUpdate: '8m ago',
				hilFlag: false,
			},
		],
		signal: pipelineStatus?.signal ?? {
			strength: 87,
			lastHeartbeat: '19s ago',
			region: 'LAX1',
			channels: [
				{ id: 'ops', label: 'Ops', status: 'stable', latency: 142 },
				{ id: 'terminals', label: 'Terminals', status: 'stable', latency: 98 },
				{ id: 'broadcast', label: 'Broadcast', status: 'attenuated', latency: 214 },
			],
		},
	}), [
		healthBroadcastState,
		agentStatus,
		pipelineStatus,
		opsStatus,
		hilStatus,
		summary?.latest?.total_workers,
	]);

	return (
		<div className="flex min-h-full flex-col gap-6 pb-12">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-3xl font-semibold tracking-tight text-foreground">
						Mission Control
					</h1>
					<p className="mt-1 max-w-2xl text-base text-default-500">
						Real-time view of agent factories, specialist pipelines, and human in
						the-loop collaboration across Vibecode.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Chip
						color={connectionChipProps.color}
						variant="flat"
						startContent={<Radio size={16} />}
					>
						{connectionChipProps.label}
					</Chip>
					<Button
						color="primary"
						variant="shadow"
						endContent={<ArrowRight size={16} />}
					>
						View Live Timeline
					</Button>
				</div>
			</header>

			<section className="grid gap-4 lg:grid-cols-3">
				<Card>
					<CardHeader className="flex items-start justify-between gap-2">
						<div className="flex items-center gap-2">
							<Users className="text-primary" size={18} />
							<span className="text-sm font-medium text-default-500">
								Active Agents
							</span>
						</div>
						<Badge color="primary" variant="flat">
							{telemetry.metrics.activeAgents} online
						</Badge>
					</CardHeader>
					<CardBody className="gap-3">
						<div className="flex items-end justify-between">
							<span className="text-4xl font-semibold tracking-tight text-foreground">
								{telemetry.metrics.inFlightTasks}
							</span>
							<div className="text-right text-sm text-default-500">
								<span>Tasks in progress</span>
								<br />
								<span className="text-success">
									+{telemetry.metrics.delta.inFlightTasks}% today
								</span>
							</div>
						</div>
						<Progress
							value={telemetry.metrics.factoryCapacity.utilization}
							color="primary"
							size="sm"
							aria-label="Factory utilization"
						/>
						<div className="flex items-center justify-between text-xs text-default-500">
							<span>Factory capacity</span>
							<span>
								{telemetry.metrics.factoryCapacity.utilization}% utilised
							</span>
						</div>
					</CardBody>
					<CardFooter>
						<AvatarGroup
							isBordered
							max={5}
							total={
								telemetry.agents.active.length - Math.min(5, telemetry.agents.active.length)
							}
						>
							{telemetry.agents.active.slice(0, 5).map((agent) => (
								<Tooltip
									key={agent.id}
									content={`${agent.name} • ${agent.role}`}
									color="foreground"
									placement="top"
								>
									<Avatar
										name={agent.name}
										className="text-sm"
										color={agent.status === 'executing' ? 'success' : 'primary'}
									/>
								</Tooltip>
							))}
						</AvatarGroup>
					</CardFooter>
				</Card>

				<Card>
					<CardHeader className="flex items-start justify-between gap-2">
						<div className="flex items-center gap-2">
							<Activity className="text-secondary" size={18} />
							<span className="text-sm font-medium text-default-500">
								Ops Monitor Health
							</span>
						</div>
						<Badge
							color={
								telemetry.metrics.scanHealth.status === 'healthy'
									? 'success'
									: 'warning'
							}
							variant="flat"
						>
							{telemetry.metrics.scanHealth.status}
						</Badge>
					</CardHeader>
					<CardBody className="gap-4">
						<div className="flex items-baseline justify-between gap-3">
							<div className="text-4xl font-semibold tracking-tight text-foreground">
								{telemetry.metrics.scanHealth.onTime}%
							</div>
							<div className="flex items-center gap-2 text-sm text-default-500">
								<AlarmClock size={16} />
								On-time scans
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="flex flex-col gap-1">
								<span className="text-xs text-default-500">Last full scan</span>
								<span className="text-sm font-medium text-foreground">
									{telemetry.metrics.scanHealth.lastFullScan}
								</span>
							</div>
							<div className="flex flex-col gap-1">
								<span className="text-xs text-default-500">Issues filed</span>
								<span className="text-sm font-medium text-foreground">
									{telemetry.metrics.scanHealth.issuesFiled}
								</span>
							</div>
						</div>
						<Divider />
						<div className="flex items-center justify-between text-xs text-default-500">
							<span>Broadcast latency</span>
							<span>{telemetry.metrics.scanHealth.broadcastLatency}ms P95</span>
						</div>
					</CardBody>
					<CardFooter>
						<Button size="sm" variant="flat" startContent={<RefreshCw size={14} />}>
							Replay last scan
						</Button>
					</CardFooter>
				</Card>

				<Card>
					<CardHeader className="flex items-start justify-between gap-2">
						<div className="flex items-center gap-2">
							<AlertTriangle className="text-danger" size={18} />
							<span className="text-sm font-medium text-default-500">
								Human In The Loop
							</span>
						</div>
						<Badge color="danger" variant="flat">
							{telemetry.metrics.hil.queue} blocked
						</Badge>
					</CardHeader>
					<CardBody className="gap-3">
						<div className="flex items-end justify-between">
							<span className="text-4xl font-semibold tracking-tight text-foreground">
								{telemetry.metrics.hil.attention}
							</span>
							<div className="text-right text-sm text-default-500">
								<span>Awaiting review</span>
								<br />
								<span className="text-danger">
									{telemetry.metrics.hil.slaBreaches} approaching SLA
								</span>
							</div>
						</div>
						<Progress
							value={telemetry.metrics.hil.resolutionProgress}
							color="danger"
							size="sm"
							aria-label="HIL resolution progress"
						/>
						<div className="flex items-center justify-between text-xs text-default-500">
							<span>Median turnaround</span>
							<span>{telemetry.metrics.hil.medianDuration} mins</span>
						</div>
					</CardBody>
					<CardFooter className="flex justify-between">
						<Button size="sm" variant="light" startContent={<PauseCircle size={14} />}>
							Pause pipeline
						</Button>
						<Button size="sm" color="danger" endContent={<ArrowRight size={14} />}>
							Review queue
						</Button>
					</CardFooter>
				</Card>
			</section>

			{/* Health Check Section */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Heart size={20} className="text-primary" />
						<h2 className="text-xl font-semibold text-foreground">Health Monitoring</h2>
					</div>
					<Button
						size="sm"
						variant="flat"
						startContent={<RefreshCw size={14} />}
						onPress={() => {
							refreshSummary();
							refetchWorkers();
						}}
					>
						Refresh
					</Button>
				</div>
				<div className="grid gap-4 lg:grid-cols-3">
					<HealthScoreChart status={summary?.latest ?? null} loading={summaryLoading} />
					<Card>
						<CardHeader className="flex items-start justify-between gap-2">
							<div className="flex items-center gap-2">
								<Activity className="text-primary" size={18} />
								<span className="text-sm font-medium text-default-500">Health Summary</span>
							</div>
						</CardHeader>
						<CardBody className="gap-3">
							{summaryLoading ? (
								<div className="space-y-2">
									<Skeleton className="h-4 w-full rounded" />
									<Skeleton className="h-4 w-3/4 rounded" />
									<Skeleton className="h-4 w-1/2 rounded" />
								</div>
							) : summary?.summary ? (
								<>
									<div className="flex items-baseline justify-between">
										<span className="text-2xl font-semibold text-foreground">
											{summary.summary.totalChecks}
										</span>
										<span className="text-xs text-default-500">Total checks</span>
									</div>
									{summary.summary.lastCompletedAt && (
										<div className="flex items-center gap-2 text-xs text-default-500">
											<AlarmClock size={14} />
											<span>
												Last check: {new Date(summary.summary.lastCompletedAt).toLocaleString()}
											</span>
										</div>
									)}
									{summary.summary.lastStatus && (
										<Chip
											size="sm"
											color={
												summary.summary.lastStatus === 'completed'
													? 'success'
													: summary.summary.lastStatus === 'running'
														? 'warning'
														: 'default'
											}
											variant="flat"
										>
											{summary.summary.lastStatus}
										</Chip>
									)}
								</>
							) : (
								<p className="text-sm text-default-500">No health data available</p>
							)}
						</CardBody>
					</Card>
					<Card>
						<CardHeader className="flex items-start justify-between gap-2">
							<div className="flex items-center gap-2">
								<Cpu className="text-primary" size={18} />
								<span className="text-sm font-medium text-default-500">Workers</span>
							</div>
						</CardHeader>
						<CardBody className="gap-3">
							{workersLoading ? (
								<div className="space-y-2">
									<Skeleton className="h-4 w-full rounded" />
									<Skeleton className="h-4 w-3/4 rounded" />
								</div>
							) : workers?.workers ? (
								<>
									<div className="flex items-baseline justify-between">
										<span className="text-2xl font-semibold text-foreground">
											{workers.workers.length}
										</span>
										<span className="text-xs text-default-500">Configured workers</span>
									</div>
									<div className="flex flex-wrap gap-2">
										{workers.workers.slice(0, 5).map((worker) => (
											<Chip key={worker.name} size="sm" variant="flat">
												{worker.name}
											</Chip>
										))}
										{workers.workers.length > 5 && (
											<Chip size="sm" variant="flat">
												+{workers.workers.length - 5} more
											</Chip>
										)}
									</div>
								</>
							) : (
								<p className="text-sm text-default-500">No workers configured</p>
							)}
						</CardBody>
					</Card>
				</div>
				<div className="mt-4 grid gap-4 lg:grid-cols-2">
					<WorkerStatusGrid
						workers={workers}
						workerResults={workerResults}
						loading={workersLoading || summaryLoading}
					/>
					<TestResultsBreakdown status={summary?.latest ?? null} loading={summaryLoading} />
				</div>
			</section>

			{/* Analytics Trends Section */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<Activity size={20} className="text-primary" />
					<h2 className="text-xl font-semibold text-foreground">Analytics Trends</h2>
				</div>
				<TrendDashboard
					autoRefresh={true}
					refreshInterval={120000} // 2 minutes
				/>
			</section>

			{/* Code Quality Monitoring Section */}
			<CodeQualityMonitor />

			<section className="grid gap-4 xl:grid-cols-[2fr,1fr]">
				<Card className="h-full">
					<CardHeader className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Factory size={18} className="text-primary" />
							<div>
								<p className="text-sm font-medium text-default-500">
									Factory & Specialist Pipeline
								</p>
								<p className="text-xs text-default-400">
									Track live throughput across orchestrator-managed agents.
								</p>
							</div>
						</div>
						<Tabs
							aria-label="Pipeline view"
							color="primary"
							variant="bordered"
							selectedKey="overview"
						>
							<Tab key="overview" title="Overview" />
							<Tab key="timeline" title="Timeline" />
						</Tabs>
					</CardHeader>
					<CardBody className="gap-6">
						<div className="grid gap-4 md:grid-cols-3">
							{telemetry.pipelineStages.map((stage) => (
								<Card key={stage.id} variant="bordered">
									<CardBody className="gap-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Cpu size={16} className="text-default-500" />
												<span className="text-sm font-semibold text-foreground">
													{stage.label}
												</span>
											</div>
											<Chip size="sm" variant="flat" color={stage.badgeColor}>
												{stage.status}
											</Chip>
										</div>
										<div className="flex items-baseline justify-between">
											<span className="text-2xl font-semibold text-foreground">
												{stage.inFlight}
											</span>
											<span className="text-xs text-default-500">
												ETA {stage.medianEta} mins
											</span>
										</div>
										<Progress
											aria-label={`${stage.label} throughput`}
											value={stage.utilisation}
											size="sm"
										/>
										<div className="flex items-center justify-between text-xs text-default-500">
											<span>Throughput</span>
											<span>{stage.utilisation}% capacity</span>
										</div>
									</CardBody>
								</Card>
							))}
						</div>
						<Divider />
						<div>
							<p className="mb-3 text-sm font-medium text-default-500">
								Live orchestration timeline
							</p>
							<div className="grid gap-3 md:grid-cols-2">
								{telemetry.timeline.map((event) => (
									<Card
										key={event.id}
										variant={event.state === 'active' ? 'shadow' : 'flat'}
										className={
											event.state === 'active'
												? 'border border-primary/40 shadow-primary/30'
												: ''
										}
									>
										<CardBody className="gap-2">
											<div className="flex items-center justify-between text-xs uppercase tracking-wide text-default-400">
												<span>{event.clock}</span>
												<span>{event.stateLabel}</span>
											</div>
											<p className="text-sm font-semibold text-foreground">
												{event.title}
											</p>
											<p className="text-xs text-default-500">
												{event.description}
											</p>
										</CardBody>
									</Card>
								))}
							</div>
						</div>
					</CardBody>
				</Card>

				<Card className="h-full">
					<CardHeader className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<TerminalSquare size={18} className="text-primary" />
							<div>
								<p className="text-sm font-medium text-default-500">
									Live Terminal Sessions
								</p>
								<p className="text-xs text-default-400">
									Realtime PartyServer streams from factories and specialists.
								</p>
							</div>
						</div>
						<Button size="sm" variant="bordered" startContent={<Radio size={14} />}>
							Open Console
						</Button>
					</CardHeader>
					<CardBody className="gap-4">
						<div className="flex flex-col gap-3">
							{telemetry.terminals.map((terminal) => (
								<Card key={terminal.id} variant="bordered">
									<CardBody className="gap-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Chip
													size="sm"
													color={terminal.status === 'connected' ? 'success' : 'warning'}
													variant="flat"
												>
													{terminal.status}
												</Chip>
												<span className="text-sm font-medium text-foreground">
													{terminal.label}
												</span>
											</div>
											<span className="text-xs text-default-500">
												{terminal.lastEvent}
											</span>
										</div>
										<div className="flex items-center justify-between text-xs text-default-500">
											<span>{terminal.description}</span>
											<span>{terminal.room}</span>
										</div>
									</CardBody>
								</Card>
							))}
						</div>
						<Divider />
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<CircularProgress
									value={telemetry.broadcast.health}
									size="lg"
									strokeWidth={6}
									color={
										telemetry.broadcast.health > 80
											? 'success'
											: telemetry.broadcast.health > 50
												? 'warning'
												: 'danger'
									}
								/>
								<div>
									<p className="text-sm font-semibold text-foreground">
										PartyServer broadcast health
									</p>
									<p className="text-xs text-default-500">
										{telemetry.broadcast.rooms} rooms •{' '}
										{telemetry.broadcast.subscribers} subscribers
									</p>
								</div>
							</div>
							<Button size="sm" variant="flat">
								Inspect rooms
							</Button>
						</div>
					</CardBody>
				</Card>
			</section>

			<section className="grid gap-4 xl:grid-cols-[2fr,1fr]">
				<Card>
					<CardHeader className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Activity size={18} className="text-secondary" />
							<div>
								<p className="text-sm font-medium text-default-500">
									Realtime Task Board
								</p>
								<p className="text-xs text-default-400">
									Agent assignments with live progress and human-in-the-loop flags.
								</p>
							</div>
						</div>
						<Button size="sm" variant="flat">
							Export snapshot
						</Button>
					</CardHeader>
					<CardBody className="overflow-x-auto p-0">
						<Table
							aria-label="Live task assignments"
							selectionMode="none"
							removeWrapper
						>
							<TableHeader>
								<TableColumn key="id">Task</TableColumn>
								<TableColumn key="project">Project</TableColumn>
								<TableColumn key="owner">Agent</TableColumn>
								<TableColumn key="status">Status</TableColumn>
								<TableColumn key="eta">ETA</TableColumn>
								<TableColumn key="hil">HIL</TableColumn>
							</TableHeader>
							<TableBody emptyContent="No live tasks">
								{telemetry.tasks.map((task) => (
									<TableRow key={task.id}>
										<TableCell>
											<div className="max-w-xs">
												<p className="truncate text-sm font-medium text-foreground">
													{task.title}
												</p>
												<p className="text-xs text-default-400">
													Updated {task.lastUpdate}
												</p>
											</div>
										</TableCell>
										<TableCell className="text-sm text-default-500">
											{task.project}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<Avatar
													name={task.owner.name}
													size="sm"
													color="primary"
													className="text-xs"
												/>
												<div className="text-xs text-default-500">
													<p className="font-medium text-foreground">
														{task.owner.name}
													</p>
													<p>{task.owner.role}</p>
												</div>
											</div>
										</TableCell>
										<TableCell>
											<Chip
												size="sm"
												color={statusToColor(task.status)}
												variant="flat"
											>
												{task.statusLabel}
											</Chip>
										</TableCell>
										<TableCell className="text-sm text-default-500">
											{task.eta}
										</TableCell>
										<TableCell>
											{task.hilFlag ? (
												<Tooltip content="Requires human approval">
													<Badge color="danger" variant="flat">
														HIL
													</Badge>
												</Tooltip>
											) : (
												<Badge color="success" variant="flat">
													Auto
												</Badge>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardBody>
				</Card>

				<Card>
					<CardHeader className="flex items-start justify-between">
						<div className="flex items-center gap-2">
							<Radio size={18} className="text-primary" />
							<div>
								<p className="text-sm font-medium text-default-500">
									Signal Monitor
								</p>
								<p className="text-xs text-default-400">
									Live heartbeat and orchestration signal strength.
								</p>
							</div>
						</div>
						<Button size="sm" variant="flat">
							View logs
						</Button>
					</CardHeader>
					<CardBody className="gap-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<CircularProgress
									value={telemetry.signal.strength}
									size="lg"
									color="primary"
									showValueLabel
								/>
								<div>
									<p className="text-sm font-semibold text-foreground">
										Signal Strength
									</p>
									<p className="text-xs text-default-500">
										Updated {telemetry.signal.lastHeartbeat}
									</p>
								</div>
							</div>
							<Chip size="sm" color="primary" variant="flat">
								{telemetry.signal.region}
							</Chip>
						</div>
						<Divider />
						<div className="space-y-3">
							{telemetry.signal.channels.map((channel) => (
								<div key={channel.id} className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="text-xs font-medium uppercase text-default-400">
											{channel.label}
										</span>
										<Chip
											size="sm"
											color={channel.status === 'stable' ? 'success' : 'warning'}
											variant="flat"
										>
											{channel.status}
										</Chip>
									</div>
									<span className="text-xs text-default-500">
										{channel.latency}ms latency
									</span>
								</div>
							))}
						</div>
					</CardBody>
				</Card>
			</section>
		</div>
	);
}


function statusToColor(
	status: MissionControlTelemetry['tasks'][number]['status'],
) {
	switch (status) {
		case 'executing':
			return 'primary';
		case 'review':
			return 'warning';
		case 'queued':
			return 'default';
		default:
			return 'default';
	}
}
