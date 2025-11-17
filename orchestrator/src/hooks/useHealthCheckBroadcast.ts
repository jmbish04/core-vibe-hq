import { useEffect, useRef, useState, useCallback } from 'react';
import PartySocket from 'partysocket';
import type { HealthCheckStatusResponse } from '@/api-types';

interface HealthCheckBroadcastMessage {
	type: 'connected' | 'health-check-status' | 'health-check-start' | 'worker-result' | 'health-check-complete';
	data?: HealthCheckStatusResponse | any;
	timestamp?: string;
}

export function useHealthCheckBroadcast(
	onStatusUpdate?: (status: HealthCheckStatusResponse) => void,
	onWorkerResult?: (workerName: string, result: any) => void,
	onHealthCheckStart?: (uuid: string, triggerType: string, triggerSource: string) => void,
	onHealthCheckComplete?: (uuid: string, status: HealthCheckStatusResponse) => void
) {
	const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'reconnecting' | 'disconnected'>('disconnected');
	const [error, setError] = useState<string | null>(null);
	const socketRef = useRef<PartySocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const maxReconnectAttempts = 5;

	const connect = useCallback(() => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			return; // Already connected
		}

		setConnectionState('connecting');
		setError(null);

		try {
			const socket = new PartySocket({
				host: window.location.host,
				room: 'main',
				party: 'health-check-broadcast',
			});

			socketRef.current = socket;

			socket.addEventListener('open', () => {
				setConnectionState('connected');
				setError(null);
				reconnectAttemptsRef.current = 0;
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
					reconnectTimeoutRef.current = null;
				}
			});

			socket.addEventListener('message', (event) => {
				try {
					const message: HealthCheckBroadcastMessage = JSON.parse(event.data as string);
					
					switch (message.type) {
						case 'connected':
							// Connection established
							break;
						case 'health-check-status':
							if (message.data && onStatusUpdate) {
								onStatusUpdate(message.data as HealthCheckStatusResponse);
							}
							break;
						case 'worker-result':
							if (message.data && onWorkerResult) {
								onWorkerResult(message.data.worker_name, message.data);
							}
							break;
						case 'health-check-start':
							if (message.data && onHealthCheckStart) {
								onHealthCheckStart(
									message.data.health_check_uuid,
									message.data.trigger_type,
									message.data.trigger_source
								);
							}
							break;
						case 'health-check-complete':
							if (message.data && onHealthCheckComplete) {
								onHealthCheckComplete(message.data.health_check_uuid, message.data.status);
							}
							break;
					}
				} catch (err) {
					console.error('Error parsing health check broadcast message:', err);
				}
			});

			socket.addEventListener('error', (err) => {
				console.error('Health check broadcast socket error:', err);
				setError('Connection error');
				setConnectionState('disconnected');
			});

			socket.addEventListener('close', () => {
				setConnectionState('disconnected');
				
				// Attempt to reconnect
				if (reconnectAttemptsRef.current < maxReconnectAttempts) {
					reconnectAttemptsRef.current++;
					setConnectionState('reconnecting');
					const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
					reconnectTimeoutRef.current = setTimeout(() => {
						connect();
					}, delay);
				} else {
					setError('Failed to reconnect after multiple attempts');
				}
			});
		} catch (err) {
			console.error('Error creating health check broadcast socket:', err);
			setError(err instanceof Error ? err.message : 'Failed to connect');
			setConnectionState('disconnected');
		}
	}, [onStatusUpdate, onWorkerResult, onHealthCheckStart, onHealthCheckComplete]);

	useEffect(() => {
		connect();

		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (socketRef.current) {
				socketRef.current.close();
				socketRef.current = null;
			}
		};
	}, [connect]);

	return {
		connectionState,
		error,
		reconnect: connect,
	};
}

