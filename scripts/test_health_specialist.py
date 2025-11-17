#!/usr/bin/env python3
"""
Test script for Health Specialist - Tests dependency synchronization issues
like those found in GitHub repositories.
"""

import asyncio
import httpx
import json
import time
from typing import Dict, List, Any
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class TestResult:
    """Represents a single test result"""
    success: bool
    output: str
    metrics: Dict[str, Any]
    error: str = ""
    logs: List[str] = field(default_factory=list)

@dataclass
class HealthCheckScenario:
    """Represents a health check test scenario"""
    name: str
    description: str
    repository_url: str
    expected_issues: List[str]
    category: str = "integration"

class HealthSpecialistTester:
    """Test harness for Health Specialist functionality"""

    def __init__(self, base_url: str = "http://localhost:8787"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def test_dependency_sync_scenario(self) -> Dict[str, Any]:
        """
        Test the dependency synchronization scenario from the GitHub repo example.
        This simulates the npm ci failure due to package-lock.json being out of sync.
        """

        scenario = HealthCheckScenario(
            name="dependency-sync-failure",
            description="Test detection of package-lock.json synchronization issues",
            repository_url="https://github.com/jmbish04/core-linkedin-scraper",
            expected_issues=[
                "package-lock.json out of sync with package.json",
                "Missing dependencies: hono@4.10.4, yaml@2.8.1",
                "npm ci failed due to lockfile mismatch"
            ],
            category="security"
        )

        print("🩺 Testing Health Specialist - Dependency Sync Scenario"        print(f"📋 Scenario: {scenario.name}")
        print(f"📝 Description: {scenario.description}")
        print(f"🔗 Repository: {scenario.repository_url}")
        print(f"🎯 Expected Issues: {len(scenario.expected_issues)}")
        print()

        # Step 1: Create a test profile for dependency sync checking
        print("📝 Step 1: Creating dependency sync test profile...")
        profile_result = await self.create_test_profile({
            "name": "dependency-sync-check-test",
            "description": "Check package-lock.json synchronization with package.json",
            "category": "security",
            "target": "build-system",
            "enabled": True,
            "schedule": "manual",
            "config": {
                "check_lockfile_sync": True,
                "validate_dependencies": True,
                "repository_analysis": True
            }
        })

        if not profile_result.get("success"):
            print("❌ Failed to create test profile")
            return {"success": False, "error": "Profile creation failed"}

        profile_id = profile_result.get("profile", {}).get("id")
        print(f"✅ Created test profile with ID: {profile_id}")
        print()

        # Step 2: Run the health check manually
        print("🏃 Step 2: Running manual health check...")
        check_result = await self.run_manual_health_check({
            "profileId": profile_id,
            "target": scenario.repository_url,
            "context": {
                "build_error": """
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: hono@4.10.4 from lock file
npm error Missing: yaml@2.8.1 from lock file
npm error Clean install a project
                """,
                "expected_dependencies": ["hono@4.10.4", "yaml@2.8.1"],
                "lockfile_sync_issue": True
            }
        })

        if not check_result.get("success"):
            print("❌ Manual health check failed")
            return {"success": False, "error": "Health check failed"}

        test_result_id = check_result.get("testResult", {}).get("id")
        print(f"✅ Health check completed, result ID: {test_result_id}")
        print()

        # Step 3: Analyze results with AI
        print("🤖 Step 3: Running AI analysis on results...")
        ai_analysis = await self.run_ai_analysis(test_result_id, {
            "context": f"""
Repository: {scenario.repository_url}
Build Error: The npm ci command failed because package-lock.json is out of sync with package.json.
Missing dependencies: hono@4.10.4, yaml@2.8.1

This is a common issue where:
1. package.json was updated but package-lock.json wasn't regenerated
2. Dependencies were added manually without running npm install
3. Lockfile became corrupted or outdated

Expected solution: Run 'npm install' to regenerate package-lock.json
            """,
            "expected_findings": scenario.expected_issues
        })

        print(f"✅ AI analysis completed: {len(ai_analysis.get('aiLogs', []))} AI log entries")
        print()

        # Step 4: Get final results and dashboard data
        print("📊 Step 4: Retrieving final results and dashboard data...")
        final_results = await self.get_health_dashboard_data()

        # Step 5: Validate against expected issues
        print("✅ Step 5: Validating results against expected issues...")
        validation = self.validate_results(final_results, scenario.expected_issues)

        # Summary
        print("\n" + "="*60)
        print("🎯 HEALTH SPECIALIST TEST RESULTS")
        print("="*60)
        print(f"Scenario: {scenario.name}")
        print(f"Repository: {scenario.repository_url}")
        print(f"Category: {scenario.category}")
        print()
        print(f"✅ Test Profile Created: {profile_result.get('success', False)}")
        print(f"✅ Health Check Executed: {check_result.get('success', False)}")
        print(f"✅ AI Analysis Performed: {len(ai_analysis.get('aiLogs', [])) > 0}")
        print(f"✅ Dashboard Data Retrieved: {bool(final_results)}")
        print()
        print("🎯 Expected Issues:")
        for i, issue in enumerate(scenario.expected_issues, 1):
            status = "✅" if issue in str(validation.get("detected_issues", [])) else "❌"
            print(f"  {i}. {status} {issue}")

        print()
        print(f"📈 Validation Score: {validation.get('score', 0)}%")
        print(f"🔍 Issues Detected: {len(validation.get('detected_issues', []))}")
        print(f"💡 AI Insights Generated: {len(ai_analysis.get('aiLogs', []))}")

        return {
            "success": validation.get("score", 0) > 70,
            "scenario": scenario.name,
            "validation_score": validation.get("score", 0),
            "detected_issues": validation.get("detected_issues", []),
            "ai_insights": len(ai_analysis.get("aiLogs", [])),
            "test_result_id": test_result_id,
            "profile_id": profile_id
        }

    async def create_test_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a test profile via API"""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/health/profiles",
                json=profile_data,
                headers={"Content-Type": "application/json"}
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def run_manual_health_check(self, check_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run a manual health check"""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/health/run",
                json=check_data,
                headers={"Content-Type": "application/json"}
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def run_ai_analysis(self, test_result_id: int, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run AI analysis on test results"""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/health/analyze/{test_result_id}",
                json=analysis_data,
                headers={"Content-Type": "application/json"}
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_health_dashboard_data(self) -> Dict[str, Any]:
        """Get health dashboard data"""
        try:
            response = await self.client.get(f"{self.base_url}/api/health/dashboard")
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def validate_results(self, results: Dict[str, Any], expected_issues: List[str]) -> Dict[str, Any]:
        """Validate test results against expected issues"""
        detected_issues = []
        results_str = json.dumps(results).lower()

        for issue in expected_issues:
            if issue.lower() in results_str:
                detected_issues.append(issue)

        score = (len(detected_issues) / len(expected_issues)) * 100 if expected_issues else 0

        return {
            "score": round(score, 1),
            "detected_issues": detected_issues,
            "missed_issues": [i for i in expected_issues if i not in detected_issues],
            "total_expected": len(expected_issues),
            "total_detected": len(detected_issues)
        }

async def main():
    """Main test function"""
    print("🚀 Starting Health Specialist Integration Test")
    print("="*60)

    async with HealthSpecialistTester() as tester:
        start_time = time.time()

        result = await tester.test_dependency_sync_scenario()

        end_time = time.time()
        duration = end_time - start_time

        print(f"\n⏱️  Test Duration: {duration:.2f} seconds")

        if result["success"]:
            print("🎉 TEST PASSED!")
            print("✅ Health Specialist successfully detected dependency sync issues")
            print("✅ AI analysis provided insights")
            print("✅ Dashboard data generated")
        else:
            print("❌ TEST FAILED!")
            print("❌ Health Specialist did not meet expectations")

        print("\n📋 Final Results:")
        print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
