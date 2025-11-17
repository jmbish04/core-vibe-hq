#!/usr/bin/env tsx
/**
 * Problem Analyzer Script
 * 
 * Runs npm run problems, analyzes the output, and uses AI to categorize errors
 * into a structured checklist for efficient batch fixing.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ErrorEntry {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  raw: string;
}

interface ErrorCategory {
  type: string;
  description: string;
  count: number;
  errors: ErrorEntry[];
  suggestion: string;
  canBatchFix: boolean;
  batchFixPattern?: {
    search: string;
    replace: string;
    description: string;
  };
}

interface ProblemAnalysis {
  timestamp: string;
  totalErrors: number;
  categories: ErrorCategory[];
  summary: string;
}

const OPENAI_API_URL = 'https://openai-api-worker.hacolby.workers.dev/v1/chat/completions';
const PROBLEMS_LOG = join(process.cwd(), 'problems.log');
const ANALYSIS_OUTPUT = join(process.cwd(), 'problems-analysis.json');
const CHECKLIST_OUTPUT = join(process.cwd(), 'problems-checklist.md');

/**
 * Parse TypeScript errors from problems.log
 */
function parseErrors(logContent: string): ErrorEntry[] {
  const errors: ErrorEntry[] = [];
  const lines = logContent.split('\n');

  for (const line of lines) {
    // Match TypeScript error format: filepath(line,col): error TSCODE: message
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: match[4],
        message: match[5],
        raw: line,
      });
    }
  }

  return errors;
}

/**
 * Group errors by type and code
 */
function groupErrors(errors: ErrorEntry[]): Map<string, ErrorEntry[]> {
  const groups = new Map<string, ErrorEntry[]>();

  for (const error of errors) {
    const key = `${error.code}:${error.message}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(error);
  }

  return groups;
}

/**
 * Analyze errors using AI
 */
async function analyzeWithAI(errors: ErrorEntry[]): Promise<ErrorCategory[]> {
  const groups = groupErrors(errors);
  const categories: ErrorCategory[] = [];

  // Group by error code for AI analysis
  const codeGroups = new Map<string, ErrorEntry[]>();
  for (const error of errors) {
    if (!codeGroups.has(error.code)) {
      codeGroups.set(error.code, []);
    }
    codeGroups.get(error.code)!.push(error);
  }

  // Analyze each error code group
  for (const [code, errorList] of codeGroups.entries()) {
    // Sample a few errors for AI analysis (limit to avoid token limits)
    const sampleErrors = errorList.slice(0, 5);
    const sampleMessages = sampleErrors.map(e => e.message).join('\n');
    const uniqueFiles = [...new Set(errorList.map(e => e.file))];

    const prompt = `Analyze these TypeScript errors and provide:
1. Error type name (concise)
2. Description of what causes this error
3. Fix suggestion
4. Whether this can be batch fixed (true/false)
5. If batch fixable, provide search/replace pattern

Errors (${errorList.length} total):
${sampleMessages}

Files affected: ${uniqueFiles.slice(0, 10).join(', ')}${uniqueFiles.length > 10 ? ' and more' : ''}

Respond in JSON format:
{
  "type": "error type name",
  "description": "what causes this",
  "suggestion": "how to fix",
  "canBatchFix": true/false,
  "batchFixPattern": {
    "search": "pattern to find",
    "replace": "replacement",
    "description": "what this fixes"
  }
}`;

    try {
      // Use the OpenAI-compatible API endpoint
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: API key may not be required for this endpoint, but include if needed
          ...(process.env.OPENAI_API_KEY ? { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Using OpenAI-compatible model name
          messages: [
            {
              role: 'system',
              content: 'You are a TypeScript error analysis expert. Analyze errors and provide structured, actionable fix suggestions. Always respond with valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        console.warn(`AI analysis failed for ${code}, using fallback`);
        const fallback = createFallbackCategory(code, errorList);
        categories.push(fallback);
        continue;
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        console.warn(`No content in AI response for ${code}`);
        const fallback = createFallbackCategory(code, errorList);
        categories.push(fallback);
        continue;
      }

      const analysis = JSON.parse(content);
      categories.push({
        type: analysis.type || code,
        description: analysis.description || errorList[0].message,
        count: errorList.length,
        errors: errorList,
        suggestion: analysis.suggestion || 'Manual review required',
        canBatchFix: analysis.canBatchFix || false,
        batchFixPattern: analysis.batchFixPattern || undefined,
      });
    } catch (error) {
      console.warn(`Error analyzing ${code}:`, error);
      const fallback = createFallbackCategory(code, errorList);
      categories.push(fallback);
    }
  }

  return categories;
}

/**
 * Create fallback category when AI analysis fails
 */
function createFallbackCategory(code: string, errors: ErrorEntry[]): ErrorCategory {
  const commonPatterns: Record<string, { type: string; suggestion: string; canBatchFix: boolean }> = {
    'TS18046': {
      type: 'Unknown Type Error',
      suggestion: 'Add type assertions or proper type definitions',
      canBatchFix: false,
    },
    'TS18003': {
      type: 'Config File Error',
      suggestion: 'Fix tsconfig.json include/exclude paths',
      canBatchFix: true,
    },
    'TS2307': {
      type: 'Module Not Found',
      suggestion: 'Fix import paths or install missing dependencies',
      canBatchFix: true,
    },
    'TS2322': {
      type: 'Type Mismatch',
      suggestion: 'Fix type assignments',
      canBatchFix: false,
    },
  };

  const pattern = commonPatterns[code] || {
    type: `TypeScript Error ${code}`,
    suggestion: 'Review and fix manually',
    canBatchFix: false,
  };

  return {
    type: pattern.type,
    description: errors[0]?.message || 'Unknown error',
    count: errors.length,
    errors,
    suggestion: pattern.suggestion,
    canBatchFix: pattern.canBatchFix,
  };
}

/**
 * Generate markdown checklist
 */
function generateChecklist(analysis: ProblemAnalysis): string {
  const { categories, totalErrors, timestamp } = analysis;

  let markdown = `# Problems Analysis Checklist\n\n`;
  markdown += `**Generated:** ${timestamp}\n`;
  markdown += `**Total Errors:** ${totalErrors}\n\n`;
  markdown += `---\n\n`;

  // Batch fixable errors first
  const batchFixable = categories.filter(c => c.canBatchFix);
  const manualFix = categories.filter(c => !c.canBatchFix);

  if (batchFixable.length > 0) {
    markdown += `## 🔧 Batch Fixable Errors (${batchFixable.reduce((sum, c) => sum + c.count, 0)} errors)\n\n`;
    for (const category of batchFixable) {
      markdown += `### ${category.type} (${category.count} errors)\n\n`;
      markdown += `**Description:** ${category.description}\n\n`;
      markdown += `**Suggestion:** ${category.suggestion}\n\n`;

      if (category.batchFixPattern) {
        markdown += `**Batch Fix Pattern:**\n`;
        markdown += `\`\`\`\n`;
        markdown += `Search:  ${category.batchFixPattern.search}\n`;
        markdown += `Replace: ${category.batchFixPattern.replace}\n`;
        markdown += `\`\`\`\n\n`;
        markdown += `${category.batchFixPattern.description}\n\n`;
      }

      markdown += `**Affected Files:**\n`;
      const uniqueFiles = [...new Set(category.errors.map(e => e.file))];
      for (const file of uniqueFiles.slice(0, 10)) {
        const fileErrors = category.errors.filter(e => e.file === file);
        markdown += `- [ ] \`${file}\` (${fileErrors.length} errors)\n`;
      }
      if (uniqueFiles.length > 10) {
        markdown += `- ... and ${uniqueFiles.length - 10} more files\n`;
      }
      markdown += `\n`;
    }
  }

  if (manualFix.length > 0) {
    markdown += `## 📝 Manual Fix Required (${manualFix.reduce((sum, c) => sum + c.count, 0)} errors)\n\n`;
    for (const category of manualFix) {
      markdown += `### ${category.type} (${category.count} errors)\n\n`;
      markdown += `**Description:** ${category.description}\n\n`;
      markdown += `**Suggestion:** ${category.suggestion}\n\n`;

      markdown += `**Affected Files:**\n`;
      const uniqueFiles = [...new Set(category.errors.map(e => e.file))];
      for (const file of uniqueFiles.slice(0, 10)) {
        const fileErrors = category.errors.filter(e => e.file === file);
        markdown += `- [ ] \`${file}\` (${fileErrors.length} errors)\n`;
      }
      if (uniqueFiles.length > 10) {
        markdown += `- ... and ${uniqueFiles.length - 10} more files\n`;
      }
      markdown += `\n`;
    }
  }

  markdown += `---\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- **Total Errors:** ${totalErrors}\n`;
  markdown += `- **Batch Fixable:** ${batchFixable.reduce((sum, c) => sum + c.count, 0)} errors\n`;
  markdown += `- **Manual Fix:** ${manualFix.reduce((sum, c) => sum + c.count, 0)} errors\n`;
  markdown += `- **Error Categories:** ${categories.length}\n`;

  return markdown;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Running problems check...');
  
  try {
    // Run problems check
    execSync('npm run problems', { stdio: 'inherit' });
  } catch (error) {
    // Continue even if problems check fails (we want to analyze errors)
    console.log('⚠️  Problems check completed with errors (this is expected)');
  }

  console.log('📖 Reading problems.log...');
  let logContent: string;
  try {
    logContent = readFileSync(PROBLEMS_LOG, 'utf-8');
  } catch (error) {
    console.error('❌ Could not read problems.log');
    process.exit(1);
  }

  console.log('🔎 Parsing errors...');
  const errors = parseErrors(logContent);
  console.log(`Found ${errors.length} errors`);

  if (errors.length === 0) {
    console.log('✅ No errors found!');
    return;
  }

  console.log('🤖 Analyzing errors with AI...');
  const categories = await analyzeWithAI(errors);

  const analysis: ProblemAnalysis = {
    timestamp: new Date().toISOString(),
    totalErrors: errors.length,
    categories,
    summary: `Found ${errors.length} errors across ${categories.length} categories`,
  };

  console.log('💾 Saving analysis...');
  writeFileSync(ANALYSIS_OUTPUT, JSON.stringify(analysis, null, 2));
  console.log(`✅ Analysis saved to ${ANALYSIS_OUTPUT}`);

  console.log('📋 Generating checklist...');
  const checklist = generateChecklist(analysis);
  writeFileSync(CHECKLIST_OUTPUT, checklist);
  console.log(`✅ Checklist saved to ${CHECKLIST_OUTPUT}`);

  console.log('\n✨ Analysis complete!');
  console.log(`📄 View checklist: ${CHECKLIST_OUTPUT}`);
  console.log(`📊 View analysis: ${ANALYSIS_OUTPUT}`);
}

main().catch(console.error);

