/**
 * Conflict Specialist Worker
 * Resolves Git merge conflicts automatically using AI
 */

import { Hono } from 'hono';
import { ConflictResolver } from './services/ConflictResolver';
import { GitService } from './services/GitService';
import type { ConflictResolutionOrder, ConflictResolutionResult } from './types';

export interface Env {
  // NOTE: DB binding removed - all database operations should go through orchestrator service bindings
  // TODO: Refactor to use ORCHESTRATOR_OPS or create new orchestrator entrypoint for conflict resolutions
  AI: any;
  GITHUB_TOKEN: string;
  ORCHESTRATOR: any;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /resolve
 * Receives conflict resolution order from Orchestrator
 */
app.post('/resolve', async (c) => {
  try {
    const order: ConflictResolutionOrder = await c.req.json();

    // Validate order
    if (!order.repo || !order.pr_number || !order.base_branch || !order.head_branch) {
      return c.json({ error: 'Invalid order: missing required fields' }, 400);
    }

    const githubToken = order.github_token || c.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json({ error: 'GitHub token required' }, 400);
    }

    // Initialize services
    const gitService = new GitService(githubToken);
    const conflictResolver = new ConflictResolver(c.env.AI, githubToken);

    // Fetch PR diff to identify conflicts
    const diff = await gitService.fetchPRDiff(order.repo, order.pr_number);
    
    // Parse conflicts from diff (simplified - in production, use proper diff parser)
    const conflicts = ConflictResolver.parseConflicts(diff, 'diff');

    if (conflicts.length === 0) {
      return c.json({ 
        success: true, 
        message: 'No conflicts found',
        filesResolved: 0 
      });
    }

    // Resolve conflicts
    const resolutions = await conflictResolver.resolveConflicts(conflicts, 'merge-intelligent');

    // Create resolution branch
    const timestamp = Date.now();
    const resolutionBranch = `ops/conflict-resolve-${timestamp}`;
    await gitService.createResolutionBranch(order.repo, order.base_branch, resolutionBranch);

    // Apply resolutions
    let filesResolved = 0;
    let conflictsKeptBoth = 0;
    let conflictsDeleted = 0;
    const decisionLog: string[] = [];

    for (const resolution of resolutions) {
      try {
        // In production, you'd need to fetch the file, apply resolution, and update
        // For now, we'll log the resolution
        decisionLog.push(
          `File: ${resolution.file}, Strategy: ${resolution.strategy}, Conflicts: ${resolution.conflictsResolved}`
        );
        
        if (resolution.strategy === 'keep-both') {
          conflictsKeptBoth += resolution.conflictsResolved;
        }
        
        filesResolved++;
      } catch (error) {
        console.error(`Failed to apply resolution for ${resolution.file}:`, error);
      }
    }

    // TODO: Refactor to use orchestrator service binding instead of direct DB access
    // Log to D1 via orchestrator service binding
    // For now, this will fail - need to create orchestrator entrypoint for conflict resolution logging
    throw new Error('Database access must go through orchestrator service binding. Refactor needed.');
    /* const result = await c.env.DB.prepare(
      `INSERT INTO ops_conflict_resolutions 
       (repo, pr_number, base_branch, head_branch, files_resolved, conflicts_kept_both, 
        conflicts_deleted, decision_log, resolution_branch, status, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      order.repo,
      order.pr_number,
      order.base_branch,
      order.head_branch,
      filesResolved,
      conflictsKeptBoth,
      conflictsDeleted,
      decisionLog.join('\n'),
      resolutionBranch,
      'resolved',
      new Date().toISOString()
    ).run(); */

    // Add PR comment
    const comment = `✅ **Conflict Specialist** resolved merge conflicts automatically.

📊 **Resolution Summary:**
- Files resolved: ${filesResolved}
- Conflicts kept both: ${conflictsKeptBoth}
- Resolution branch: \`${resolutionBranch}\`

**Resolution policy:** keep-both for environment var collisions.`;

    await gitService.addPRComment(order.repo, order.pr_number, comment);

    const response: ConflictResolutionResult = {
      success: true,
      filesResolved,
      conflictsKeptBoth,
      conflictsDeleted,
      resolutionBranch,
      decisionLog: decisionLog.join('\n')
    };

    return c.json(response);
  } catch (error) {
    console.error('Conflict resolution failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

/**
 * GET /status/:id
 * Get status of a conflict resolution
 */
app.get('/status/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  
  // TODO: Refactor to use orchestrator service binding instead of direct DB access
  throw new Error('Database access must go through orchestrator service binding. Refactor needed.');
  /* const result = await c.env.DB.prepare(
    'SELECT * FROM ops_conflict_resolutions WHERE id = ?'
  ).bind(id).first();

  if (!result) {
    return c.json({ error: 'Resolution not found' }, 404);
  }

  return c.json(result); */
});

export default app;

