#!/usr/bin/env python3
"""
Factory REST API Monitoring

Provides REST API endpoints for monitoring factory health,
performance metrics, and operational status.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import time
import psutil
import asyncio
from datetime import datetime
import json
import os

app = FastAPI(
    title="VibeHQ Factory REST Monitor",
    description="REST API monitoring endpoints for factory health and metrics",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Monitoring state
monitoring_state = {
    "start_time": time.time(),
    "requests": 0,
    "errors": 0,
    "last_health_check": time.time(),
    "components": {
        "rest_api": {"status": "unknown", "last_check": 0},
        "websocket": {"status": "unknown", "last_check": 0},
        "rpc": {"status": "unknown", "last_check": 0},
        "ai_providers": {"status": "unknown", "last_check": 0}
    }
}

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    uptime: float
    components: Dict[str, Any]

class MetricsResponse(BaseModel):
    timestamp: str
    uptime: float
    memory_usage: Dict[str, float]
    cpu_percent: float
    requests_total: int
    errors_total: int
    components: Dict[str, Any]

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Basic health check endpoint"""
    now = time.time()
    monitoring_state["last_health_check"] = now

    # Check component statuses
    components_status = {}
    for name, component in monitoring_state["components"].items():
        # Consider stale if not checked in last 60 seconds
        is_stale = (now - component["last_check"]) > 60
        components_status[name] = "stale" if is_stale else component["status"]

    # Determine overall status
    unhealthy_components = [k for k, v in components_status.items() if v in ["unhealthy", "stale"]]
    overall_status = "unhealthy" if unhealthy_components else "healthy"

    return HealthResponse(
        status=overall_status,
        timestamp=datetime.utcnow().isoformat(),
        uptime=now - monitoring_state["start_time"],
        components=components_status
    )

@app.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """Detailed metrics endpoint"""
    now = time.time()

    # System metrics
    memory = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=0.1)

    return MetricsResponse(
        timestamp=datetime.utcnow().isoformat(),
        uptime=now - monitoring_state["start_time"],
        memory_usage={
            "total": memory.total / 1024 / 1024,  # MB
            "used": memory.used / 1024 / 1024,    # MB
            "percent": memory.percent
        },
        cpu_percent=cpu_percent,
        requests_total=monitoring_state["requests"],
        errors_total=monitoring_state["errors"],
        components=monitoring_state["components"]
    )

@app.post("/check/rest")
async def check_rest_api():
    """Check REST API connectivity"""
    try:
        # In a real implementation, this would check the actual REST API
        # For now, just mark as healthy
        monitoring_state["components"]["rest_api"] = {
            "status": "healthy",
            "last_check": time.time()
        }
        return {"success": True, "status": "healthy"}
    except Exception as e:
        monitoring_state["components"]["rest_api"] = {
            "status": "unhealthy",
            "last_check": time.time(),
            "error": str(e)
        }
        return {"success": False, "error": str(e)}

@app.post("/check/websocket")
async def check_websocket():
    """Check WebSocket connectivity"""
    try:
        # In a real implementation, this would attempt a WebSocket connection
        monitoring_state["components"]["websocket"] = {
            "status": "healthy",
            "last_check": time.time()
        }
        return {"success": True, "status": "healthy"}
    except Exception as e:
        monitoring_state["components"]["websocket"] = {
            "status": "unhealthy",
            "last_check": time.time(),
            "error": str(e)
        }
        return {"success": False, "error": str(e)}

@app.post("/check/rpc")
async def check_rpc():
    """Check RPC connectivity"""
    try:
        # In a real implementation, this would check RPC connectivity to orchestrator
        monitoring_state["components"]["rpc"] = {
            "status": "healthy",
            "last_check": time.time()
        }
        return {"success": True, "status": "healthy"}
    except Exception as e:
        monitoring_state["components"]["rpc"] = {
            "status": "unhealthy",
            "last_check": time.time(),
            "error": str(e)
        }
        return {"success": False, "error": str(e)}

@app.post("/check/ai-providers")
async def check_ai_providers():
    """Check AI provider connectivity"""
    try:
        # In a real implementation, this would check AI provider connectivity
        monitoring_state["components"]["ai_providers"] = {
            "status": "healthy",
            "last_check": time.time()
        }
        return {"success": True, "status": "healthy"}
    except Exception as e:
        monitoring_state["components"]["ai_providers"] = {
            "status": "unhealthy",
            "last_check": time.time(),
            "error": str(e)
        }
        return {"success": False, "error": str(e)}

@app.post("/check/all")
async def check_all_components():
    """Check all components and return comprehensive status"""
    results = await asyncio.gather(
        check_rest_api(),
        check_websocket(),
        check_rpc(),
        check_ai_providers()
    )

    all_healthy = all(result["success"] for result in results)

    return {
        "success": all_healthy,
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "rest": results[0],
            "websocket": results[1],
            "rpc": results[2],
            "ai_providers": results[3]
        }
    }

# Middleware to count requests
@app.middleware("http")
async def count_requests(request, call_next):
    monitoring_state["requests"] += 1
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        monitoring_state["errors"] += 1
        raise e

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting VibeHQ Factory REST Monitor on port 3000")
    print("📊 Available endpoints:")
    print("  GET  /health - Basic health check")
    print("  GET  /metrics - Detailed metrics")
    print("  POST /check/rest - Check REST API")
    print("  POST /check/websocket - Check WebSocket")
    print("  POST /check/rpc - Check RPC")
    print("  POST /check/ai-providers - Check AI providers")
    print("  POST /check/all - Check all components")

    uvicorn.run(
        "rest_monitor:app",
        host="0.0.0.0",
        port=3000,
        reload=False,
        log_level="info"
    )
