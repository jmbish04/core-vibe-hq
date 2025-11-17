# Vibecode Comprehensive Test Suite

This directory contains the comprehensive testing framework for Vibecode functionality validation and release hardening.

## Files

- `vibecode_comprehensive_test.py` - Main test suite script
- `README_VIBECODE_TESTING.md` - This documentation

## Quick Start

```bash
# Make sure Vibecode is running on localhost:8787
cd /Volumes/Projects/workers/core-vibe-hq

# List all available tests
python scripts/vibecode_comprehensive_test.py --list

# Run a specific functional test
python scripts/vibecode_comprehensive_test.py --test new_feature_frontend_backend

# Run error/recovery tests
python scripts/vibecode_comprehensive_test.py --error-test invalid_request_handling

# Run all functional tests
python scripts/vibecode_comprehensive_test.py --run-all

# Run all error/recovery tests
python scripts/vibecode_comprehensive_test.py --run-all-errors
```

## Prerequisites

1. **Vibecode Running**: Ensure the full Vibecode stack is deployed and running
   ```bash
   # Check if services are responding
   curl http://localhost:8787/api/status
   ```

2. **Python Dependencies**:
   ```bash
   pip install httpx websockets
   ```

3. **Test Environment**: Tests assume default ports and configurations

## Test Categories

### Functional Tests (29 scenarios)

**Core Features:**
- `new_feature_frontend_backend` - Multi-factory coordination
- `conflict_resolution_pr` - Specialist activation
- `brand_new_application` - Full-stack generation

**Development Scenarios:**
- `bug_fix_critical` - Security-focused development
- `api_integration_stripe` - External service integration
- `database_schema_change` - Data modeling
- `ui_redesign_responsive` - Frontend development
- `performance_optimization` - Backend optimization

**Advanced Features:**
- `real_time_collaboration` - WebSocket functionality
- `multi_tenant_architecture` - Complex architecture
- `internationalization_i18n` - Localization

### Error & Recovery Tests (9 scenarios)

**Network & Connectivity:**
- `network_timeout_recovery` - Timeout handling
- `websocket_connection_drop` - WebSocket reconnection
- `invalid_request_handling` - Input validation

**System Limits:**
- `ai_provider_rate_limit` - Rate limiting
- `system_resource_limits` - Resource constraints
- `large_payload_processing` - Large request handling

**Infrastructure:**
- `database_connection_failure` - DB failure recovery
- `container_deployment_timeout` - Container timeouts
- `concurrent_request_handling` - Concurrent load

## Validation Checks

Each test validates:

- ✅ **Factory Activation**: Correct factories are triggered
- ✅ **Specialist Activation**: Appropriate specialists respond
- ✅ **Database Records**: Proper data persistence
- ✅ **AI Provider Usage**: LLM calls are made and tracked
- ✅ **WebSocket Messages**: Real-time communication
- ✅ **Container Deployment**: Sandbox environments created
- ✅ **Error Handling**: Graceful failure recovery

## Test Architecture

```
VibecodeTestSuite
├── Functional Tests (get_test_scenarios)
│   ├── Request Generation (_generate_test_request)
│   ├── System State Monitoring (_check_system_state)
│   └── Expectation Validation (_validate_expectations)
├── Error/Recovery Tests (test_error_recovery)
│   ├── Network Simulation (_simulate_network_timeout)
│   ├── Request Validation (_simulate_invalid_request)
│   ├── Load Testing (_simulate_concurrent_requests)
│   └── Resource Limits (_simulate_resource_limits)
└── Reporting & Analytics
    ├── Test Results (TestResult dataclass)
    ├── Performance Metrics (duration tracking)
    └── Summary Reports (print_summary)
```

## Configuration

**Default Settings:**
- Base URL: `http://localhost:8787`
- WebSocket URL: `ws://localhost:8787`
- Request Timeout: 60 seconds
- Test Timeout: 300-1200 seconds (scenario-dependent)

**Custom Configuration:**
```bash
# Use different URLs
python scripts/vibecode_comprehensive_test.py --test conflict_resolution_pr --base-url http://staging.vibecode.dev:8787
```

## Troubleshooting

**Common Issues:**

1. **Connection Refused**
   ```
   Error: [Errno 111] Connection refused
   Solution: Ensure Vibecode is running on localhost:8787
   ```

2. **Test Timeout**
   ```
   Error: Test exceeded timeout
   Solution: Check system load and Vibecode health
   ```

3. **Validation Failures**
   ```
   Error: Expected factories not activated
   Solution: Check Vibecode logs for processing errors
   ```

**Debug Mode:**
```bash
# Enable debug logging
export PYTHONPATH=scripts
python -c "
import logging
logging.basicConfig(level=logging.DEBUG)
import vibecode_comprehensive_test
"
```

## Integration with CI/CD

**GitHub Actions Example:**
```yaml
- name: Run Vibecode Tests
  run: |
    python scripts/vibecode_comprehensive_test.py --run-all
  timeout-minutes: 30

- name: Run Error Recovery Tests
  run: |
    python scripts/vibecode_comprehensive_test.py --run-all-errors
  timeout-minutes: 15
```

## Performance Benchmarks

**Expected Test Durations:**
- Simple tests: 30-60 seconds
- Complex tests: 5-20 minutes
- Full suite: 2-3 hours

**Resource Requirements:**
- Memory: 512MB minimum
- Network: Stable connection to Vibecode
- CPU: 1 core minimum

## Contributing

**Adding New Tests:**
1. Add scenario to `get_test_scenarios()` method
2. Implement request generation in `_generate_test_request()`
3. Add validation logic if needed
4. Update this README

**Test Naming Convention:**
- Use snake_case
- Be descriptive but concise
- Group related tests (e.g., `api_*`, `ui_*`)

## Support

For issues with the test suite:
1. Check Vibecode is healthy: `curl http://localhost:8787/api/status`
2. Review test logs for specific errors
3. Check network connectivity
4. Verify Python dependencies

For Vibecode issues:
- Check orchestrator logs
- Verify database connectivity
- Check AI provider configurations
- Review WebSocket connections
