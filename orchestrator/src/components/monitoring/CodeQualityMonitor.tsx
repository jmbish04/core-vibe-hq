/**
 * CodeQualityMonitor - Real-time code quality monitoring component for Mission Control
 *
 * Displays live code quality violations, agent quarantine status, and quality alerts.
 */

import { useEffect, useState } from 'react';
import {
	Card,
	CardHeader,
	CardBody,
	Badge,
	Chip,
	Button,
	Table,
	TableHeader,
	TableBody,
	TableColumn,
	TableRow,
	TableCell,
	Alert,
	Divider,
	Progress,
} from '@heroui/react';
import {
	Shield,
	AlertTriangle,
	Ban,
	CheckCircle,
	Clock,
	RefreshCw,
	ExternalLink,
} from 'lucide-react';
import type { QualityViolation, CodeChangeEvent } from '@shared/clients/codeQualityClient';

interface CodeQualityState {
	activeViolations: QualityViolation[];
	quarantinedAgents: string[];
	lastUpdate: string;
}

export function CodeQualityMonitor() {
	const [qualityState, setQualityState] = useState<CodeQualityState>({
		activeViolations: [],
		quarantinedAgents: [],
		lastUpdate: new Date().toISOString(),
	});
	const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
	const [lastHeartbeat, setLastHeartbeat] = useState<Date>(new Date());

	// Simulate real-time updates (replace with actual PartySocket/partysync connection)
	useEffect(() => {
		// Mock data for demonstration
		const mockViolations: QualityViolation[] = [
			{
				id: 'violation-1',
				severity: 'CRITICAL',
				type: 'PLACEHOLDER_DROPPED',
				message: 'Agent dropped placeholder comment "// ... (scheduled handler remains the same)" without implementing functionality',
				agentId: 'cursor-composer1',
				agentName: 'Cursor Composer 1',
				filePath: 'orchestrator/worker/database/schema.ts',
				codeSnippet: '// ... (scheduled handler remains the same)',
				detectedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
				quarantineRecommended: true,
			},
			{
				id: 'violation-2',
				severity: 'HIGH',
				type: 'INCOMPLETE_CODE',
				message: 'Found 3 empty method implementations',
				agentId: 'codex',
				agentName: 'Codex',
				filePath: 'apps/base/worker/index.ts',
				codeSnippet: 'export function processData(input: any) {\n  // Empty implementation\n}',
				detectedAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
				quarantineRecommended: false,
			},
		];

		const mockQuarantinedAgents = ['cursor-composer1'];

		setQualityState({
			activeViolations: mockViolations,
			quarantinedAgents: mockQuarantinedAgents,
			lastUpdate: new Date().toISOString(),
		});
		setConnectionStatus('connected');
		setLastHeartbeat(new Date());

		// Simulate heartbeat
		const heartbeatInterval = setInterval(() => {
			setLastHeartbeat(new Date());
		}, 30000);

		return () => clearInterval(heartbeatInterval);
	}, []);

	const getSeverityColor = (severity: QualityViolation['severity']) => {
		switch (severity) {
			case 'CRITICAL':
				return 'danger';
			case 'HIGH':
				return 'warning';
			case 'MEDIUM':
				return 'primary';
			case 'LOW':
				return 'default';
			default:
				return 'default';
		}
	};

	const getSeverityIcon = (severity: QualityViolation['severity']) => {
		switch (severity) {
			case 'CRITICAL':
				return <Ban size={16} className="text-danger" />;
			case 'HIGH':
				return <AlertTriangle size={16} className="text-warning" />;
			case 'MEDIUM':
				return <Clock size={16} className="text-primary" />;
			case 'LOW':
				return <CheckCircle size={16} className="text-success" />;
			default:
				return <CheckCircle size={16} className="text-default" />;
		}
	};

	const getViolationTypeLabel = (type: QualityViolation['type']) => {
		switch (type) {
			case 'PLACEHOLDER_DROPPED':
				return 'Placeholder Dropped';
			case 'INCOMPLETE_CODE':
				return 'Incomplete Code';
			case 'MALFORMED_SYNTAX':
				return 'Syntax Error';
			case 'LOGIC_ERROR':
				return 'Logic Error';
			case 'SECURITY_RISK':
				return 'Security Risk';
			default:
				return type;
		}
	};

	const formatTimeAgo = (timestamp: string) => {
		const diff = Date.now() - new Date(timestamp).getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m ago`;
		}
		return `${minutes}m ago`;
	};

	const criticalViolations = qualityState.activeViolations.filter(v => v.severity === 'CRITICAL');
	const quarantinedCount = qualityState.quarantinedAgents.length;
	const totalViolations = qualityState.activeViolations.length;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Shield className="text-primary" size={20} />
					<h2 className="text-xl font-semibold text-foreground">Code Quality Monitor</h2>
				</div>
				<div className="flex items-center gap-3">
					<Chip
						color={connectionStatus === 'connected' ? 'success' : 'warning'}
						variant="flat"
						size="sm"
					>
						{connectionStatus === 'connected' ? 'Live' : 'Connecting'}
					</Chip>
					<Button size="sm" variant="flat" startContent={<RefreshCw size={14} />}>
						Refresh
					</Button>
				</div>
			</div>

			{/* Critical Alerts */}
			{quarantinedCount > 0 && (
				<Alert color="danger" title="🚨 AGENT QUARANTINE ACTIVE" className="border-danger/20">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm">
								<strong>{quarantinedCount}</strong> agent{quarantinedCount !== 1 ? 's' : ''} quarantined due to code quality violations.
								All code modifications by quarantined agents have been halted.
							</p>
							<p className="text-xs text-default-500 mt-1">
								Quarantined: {qualityState.quarantinedAgents.join(', ')}
							</p>
						</div>
						<Button size="sm" color="danger" variant="flat">
							Review & Release
						</Button>
					</div>
				</Alert>
			)}

			{/* Overview Cards */}
			<div className="grid gap-4 lg:grid-cols-4">
				<Card>
					<CardBody className="gap-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<AlertTriangle className="text-danger" size={18} />
								<span className="text-sm font-medium text-default-500">Critical</span>
							</div>
							<Badge color="danger" variant="flat">
								{criticalViolations.length}
							</Badge>
						</div>
						<div className="text-2xl font-semibold text-foreground">
							{criticalViolations.length}
						</div>
						<p className="text-xs text-default-500">
							Immediate attention required
						</p>
					</CardBody>
				</Card>

				<Card>
					<CardBody className="gap-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Ban className="text-warning" size={18} />
								<span className="text-sm font-medium text-default-500">Quarantined</span>
							</div>
							<Badge color="warning" variant="flat">
								{quarantinedCount}
							</Badge>
						</div>
						<div className="text-2xl font-semibold text-foreground">
							{quarantinedCount}
						</div>
						<p className="text-xs text-default-500">
							Agents halted
						</p>
					</CardBody>
				</Card>

				<Card>
					<CardBody className="gap-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Shield className="text-primary" size={18} />
								<span className="text-sm font-medium text-default-500">Total Violations</span>
							</div>
							<Badge color="primary" variant="flat">
								{totalViolations}
							</Badge>
						</div>
						<div className="text-2xl font-semibold text-foreground">
							{totalViolations}
						</div>
						<p className="text-xs text-default-500">
							Active issues
						</p>
					</CardBody>
				</Card>

				<Card>
					<CardBody className="gap-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<CheckCircle className="text-success" size={18} />
								<span className="text-sm font-medium text-default-500">Clean Commits</span>
							</div>
							<Badge color="success" variant="flat">
								94%
							</Badge>
						</div>
						<div className="text-2xl font-semibold text-foreground">
							94%
						</div>
						<p className="text-xs text-default-500">
							Code quality score
						</p>
					</CardBody>
				</Card>
			</div>

			{/* Violations Table */}
			<Card>
				<CardHeader className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<AlertTriangle size={18} className="text-warning" />
						<div>
							<p className="text-sm font-medium text-default-500">Active Violations</p>
							<p className="text-xs text-default-400">
								Real-time code quality monitoring with automatic quarantine
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs text-default-500">
							Last update: {formatTimeAgo(qualityState.lastUpdate)}
						</span>
						<Button size="sm" variant="flat" startContent={<ExternalLink size={14} />}>
							View Logs
						</Button>
					</div>
				</CardHeader>
				<CardBody className="p-0">
					<Table aria-label="Code quality violations" removeWrapper>
						<TableHeader>
							<TableColumn>SEVERITY</TableColumn>
							<TableColumn>TYPE</TableColumn>
							<TableColumn>AGENT</TableColumn>
							<TableColumn>FILE</TableColumn>
							<TableColumn>MESSAGE</TableColumn>
							<TableColumn>DETECTED</TableColumn>
							<TableColumn>ACTIONS</TableColumn>
						</TableHeader>
						<TableBody emptyContent="No active violations - all clear!">
							{qualityState.activeViolations.map((violation) => (
								<TableRow key={violation.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											{getSeverityIcon(violation.severity)}
											<Chip
												size="sm"
												color={getSeverityColor(violation.severity)}
												variant="flat"
											>
												{violation.severity}
											</Chip>
										</div>
									</TableCell>
									<TableCell>
										<span className="text-sm font-medium">
											{getViolationTypeLabel(violation.type)}
										</span>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-foreground">
												{violation.agentName}
											</span>
											{qualityState.quarantinedAgents.includes(violation.agentId) && (
												<Badge color="danger" variant="flat" size="sm">
													QUARANTINED
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="max-w-xs">
											<p className="text-sm font-mono text-default-500 truncate">
												{violation.filePath}
											</p>
											{violation.lineNumber && (
												<p className="text-xs text-default-400">
													Line {violation.lineNumber}
												</p>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="max-w-md">
											<p className="text-sm text-foreground">
												{violation.message}
											</p>
											{violation.codeSnippet && (
												<pre className="text-xs text-default-500 mt-1 bg-default-50 p-2 rounded font-mono overflow-hidden">
													{violation.codeSnippet.length > 100
														? `${violation.codeSnippet.substring(0, 100)}...`
														: violation.codeSnippet
													}
												</pre>
											)}
										</div>
									</TableCell>
									<TableCell>
										<span className="text-sm text-default-500">
											{formatTimeAgo(violation.detectedAt)}
										</span>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Button size="sm" variant="light">
												View Details
											</Button>
											{violation.quarantineRecommended && (
												<Button size="sm" color="danger" variant="flat">
													Release Agent
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardBody>
			</Card>

			{/* Quality Trends */}
			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Shield size={18} className="text-primary" />
							<div>
								<p className="text-sm font-medium text-default-500">Quality Trends</p>
								<p className="text-xs text-default-400">24-hour violation patterns</p>
							</div>
						</div>
					</CardHeader>
					<CardBody>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm text-default-500">Clean commits</span>
								<span className="text-sm font-medium text-success">94%</span>
							</div>
							<Progress value={94} color="success" size="sm" />

							<div className="flex items-center justify-between">
								<span className="text-sm text-default-500">Violation rate</span>
								<span className="text-sm font-medium text-warning">6%</span>
							</div>
							<Progress value={6} color="warning" size="sm" />

							<Divider />

							<div className="grid grid-cols-3 gap-4 text-center">
								<div>
									<p className="text-2xl font-semibold text-foreground">23</p>
									<p className="text-xs text-default-500">Clean today</p>
								</div>
								<div>
									<p className="text-2xl font-semibold text-foreground">2</p>
									<p className="text-xs text-default-500">Violations</p>
								</div>
								<div>
									<p className="text-2xl font-semibold text-foreground">1</p>
									<p className="text-xs text-default-500">Quarantines</p>
								</div>
							</div>
						</div>
					</CardBody>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Ban size={18} className="text-danger" />
							<div>
								<p className="text-sm font-medium text-default-500">Agent Status</p>
								<p className="text-xs text-default-400">Current quarantine and monitoring status</p>
							</div>
						</div>
					</CardHeader>
					<CardBody>
						<div className="space-y-4">
							{/* Mock agent statuses - replace with real data */}
							{[
								{ name: 'Cursor Composer 1', status: 'quarantined', violations: 1 },
								{ name: 'Codex', status: 'warning', violations: 0 },
								{ name: 'Cursor Composer 2', status: 'clean', violations: 0 },
								{ name: 'Cursor GPT5 Codex', status: 'clean', violations: 0 },
							].map((agent) => (
								<div key={agent.name} className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className={`w-3 h-3 rounded-full ${
											agent.status === 'quarantined' ? 'bg-danger' :
											agent.status === 'warning' ? 'bg-warning' : 'bg-success'
										}`} />
										<span className="text-sm font-medium text-foreground">
											{agent.name}
										</span>
									</div>
									<div className="flex items-center gap-2">
										{agent.violations > 0 && (
											<Badge color="warning" variant="flat" size="sm">
												{agent.violations} violations
											</Badge>
										)}
										<Chip
											size="sm"
											color={
												agent.status === 'quarantined' ? 'danger' :
												agent.status === 'warning' ? 'warning' : 'success'
											}
											variant="flat"
										>
											{agent.status}
										</Chip>
									</div>
								</div>
							))}
						</div>
					</CardBody>
				</Card>
			</div>
		</div>
	);
}
