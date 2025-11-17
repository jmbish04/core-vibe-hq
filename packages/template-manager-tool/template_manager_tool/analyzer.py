"""
Template Analyzer - Functions for analyzing templates using MCP tools.
"""

import json
import subprocess
from pathlib import Path
from typing import Dict


def analyze_improve_templates(template_path: str, mcp_tool_name: str, query: str) -> Dict:
    """
    Analyze templates using MCP tools.
    
    This function calls the MCP CLI tool to query external resources
    (like cloudflare-docs) for template analysis and improvement suggestions.
    
    Args:
        template_path: Path to template directory
        mcp_tool_name: Name of MCP tool to use (e.g., 'cloudflare-docs')
        query: Query to send to MCP tool
        
    Returns:
        Dictionary with analysis results and recommendations
    """
    template_dir = Path(template_path)
    
    try:
        # Call MCP CLI via subprocess
        # Note: The exact command format may vary based on mcp-cli implementation
        # This assumes: mcp-cli query <tool-name> <query>
        result = subprocess.run(
            ["mcp-cli", "query", mcp_tool_name, query],
            capture_output=True,
            text=True,
            cwd=str(template_dir),
            timeout=30  # 30 second timeout
        )
        
        if result.returncode != 0:
            return {
                "tool": mcp_tool_name,
                "query": query,
                "ok": False,
                "error": f"MCP CLI returned error code {result.returncode}",
                "stderr": result.stderr
            }
        
        # Try to parse JSON output from MCP CLI
        try:
            analysis_data = json.loads(result.stdout)
        except json.JSONDecodeError:
            # If output is not JSON, wrap it in a text field
            analysis_data = {
                "text": result.stdout
            }
        
        return {
            "tool": mcp_tool_name,
            "query": query,
            "ok": True,
            "analysis": analysis_data,
            "recommendations": _extract_recommendations(analysis_data)
        }
        
    except subprocess.TimeoutExpired:
        return {
            "tool": mcp_tool_name,
            "query": query,
            "ok": False,
            "error": "MCP CLI query timed out after 30 seconds"
        }
    except FileNotFoundError:
        return {
            "tool": mcp_tool_name,
            "query": query,
            "ok": False,
            "error": "mcp-cli not found. Ensure it is installed and in PATH."
        }
    except Exception as e:
        return {
            "tool": mcp_tool_name,
            "query": query,
            "ok": False,
            "error": f"Failed to execute MCP CLI: {str(e)}"
        }


def _extract_recommendations(analysis_data: Dict) -> List[str]:
    """
    Extract recommendations from MCP tool analysis data.
    
    This is a helper function that tries to extract actionable recommendations
    from the analysis data structure. The exact format depends on the MCP tool.
    
    Args:
        analysis_data: Parsed JSON from MCP tool
        
    Returns:
        List of recommendation strings
    """
    recommendations = []
    
    # Try common fields that might contain recommendations
    if isinstance(analysis_data, dict):
        if "recommendations" in analysis_data:
            recs = analysis_data["recommendations"]
            if isinstance(recs, list):
                recommendations.extend(recs)
            elif isinstance(recs, str):
                recommendations.append(recs)
        
        if "suggestions" in analysis_data:
            suggestions = analysis_data["suggestions"]
            if isinstance(suggestions, list):
                recommendations.extend(suggestions)
        
        if "improvements" in analysis_data:
            improvements = analysis_data["improvements"]
            if isinstance(improvements, list):
                recommendations.extend(improvements)
    
    return recommendations

