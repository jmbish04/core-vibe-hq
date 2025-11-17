#!/usr/bin/env python3
"""
Factory WebSocket Monitoring

Provides WebSocket connectivity monitoring and health checks
for factory WebSocket endpoints and connections.
"""

import asyncio
import websockets
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketMonitor:
    """WebSocket connectivity and health monitoring"""

    def __init__(self):
        self.monitoring_state = {
            "connections_tested": 0,
            "connections_successful": 0,
            "connections_failed": 0,
            "messages_sent": 0,
            "messages_received": 0,
            "last_test_time": 0,
            "test_results": []
        }

    async def test_websocket_connection(
        self,
        url: str = "ws://localhost:8080",
        timeout: float = 5.0,
        test_message: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Test WebSocket connectivity to a given URL

        Args:
            url: WebSocket URL to test
            timeout: Connection timeout in seconds
            test_message: Optional message to send for testing

        Returns:
            Dict containing test results
        """
        self.monitoring_state["connections_tested"] += 1
        start_time = time.time()

        result = {
            "url": url,
            "success": False,
            "connect_time": 0,
            "message_time": 0,
            "error": None,
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            # Attempt to connect
            connect_start = time.time()
            async with websockets.connect(url, extra_headers={"User-Agent": "FactoryMonitor/1.0"}) as websocket:
                result["connect_time"] = time.time() - connect_start

                # Send test message if provided
                if test_message:
                    message_start = time.time()
                    await websocket.send(json.dumps(test_message))
                    self.monitoring_state["messages_sent"] += 1

                    # Wait for response
                    response = await asyncio.wait_for(websocket.recv(), timeout=timeout)
                    result["message_time"] = time.time() - message_start
                    self.monitoring_state["messages_received"] += 1

                    try:
                        parsed_response = json.loads(response)
                        result["response"] = parsed_response
                    except json.JSONDecodeError:
                        result["response"] = response

                result["success"] = True
                self.monitoring_state["connections_successful"] += 1

        except asyncio.TimeoutError:
            result["error"] = "Connection timeout"
            self.monitoring_state["connections_failed"] += 1
        except websockets.exceptions.ConnectionClosedError as e:
            result["error"] = f"Connection closed: {e}"
            self.monitoring_state["connections_failed"] += 1
        except Exception as e:
            result["error"] = str(e)
            self.monitoring_state["connections_failed"] += 1

        result["total_time"] = time.time() - start_time
        self.monitoring_state["last_test_time"] = time.time()

        # Store result (keep last 10)
        self.monitoring_state["test_results"].append(result)
        if len(self.monitoring_state["test_results"]) > 10:
            self.monitoring_state["test_results"].pop(0)

        return result

    async def monitor_websocket_endpoint(
        self,
        url: str = "ws://localhost:8080",
        interval: int = 30
    ):
        """
        Continuously monitor a WebSocket endpoint

        Args:
            url: WebSocket URL to monitor
            interval: Monitoring interval in seconds
        """
        logger.info(f"Starting WebSocket monitoring for {url} (interval: {interval}s)")

        while True:
            try:
                result = await self.test_websocket_connection(url)
                status = "✅ HEALTHY" if result["success"] else "❌ UNHEALTHY"
                logger.info(f"WebSocket check: {status} - {url} ({result['connect_time']:.2f}s)")

                if not result["success"]:
                    logger.error(f"WebSocket error: {result['error']}")

            except Exception as e:
                logger.error(f"Monitoring error: {e}")

            await asyncio.sleep(interval)

    def get_monitoring_stats(self) -> Dict[str, Any]:
        """Get current monitoring statistics"""
        total_tests = self.monitoring_state["connections_tested"]
        successful_tests = self.monitoring_state["connections_successful"]
        success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "connections_tested": total_tests,
            "connections_successful": successful_tests,
            "connections_failed": self.monitoring_state["connections_failed"],
            "success_rate": round(success_rate, 2),
            "messages_sent": self.monitoring_state["messages_sent"],
            "messages_received": self.monitoring_state["messages_received"],
            "last_test_time": self.monitoring_state["last_test_time"],
            "recent_tests": self.monitoring_state["test_results"][-3:]  # Last 3 tests
        }

# Global monitor instance
monitor = WebSocketMonitor()

async def websocket_monitor():
    """Main WebSocket monitoring function"""
    print("🔌 Starting VibeHQ Factory WebSocket Monitor")

    # Test local WebSocket endpoint
    test_result = await monitor.test_websocket_connection("ws://localhost:8080/health")
    print(f"Initial WebSocket test: {'✅ PASSED' if test_result['success'] else '❌ FAILED'}")

    # Start continuous monitoring
    await monitor.monitor_websocket_endpoint("ws://localhost:8080/health")

async def check_websocket_health(url: str = "ws://localhost:8080/health") -> Dict[str, Any]:
    """Check WebSocket health for external monitoring"""
    result = await monitor.test_websocket_connection(url, timeout=3.0)
    return {
        "component": "websocket",
        "status": "healthy" if result["success"] else "unhealthy",
        "details": result
    }

if __name__ == "__main__":
    print("🔌 VibeHQ Factory WebSocket Monitor")
    print("Usage:")
    print("  python3 ws_monitor.py  # Start continuous monitoring")
    print("")
    print("Or import and use:")
    print("  from ws_monitor import monitor, check_websocket_health")
    print("  result = await check_websocket_health('ws://localhost:8080/health')")

    # Run monitoring
    asyncio.run(websocket_monitor())
