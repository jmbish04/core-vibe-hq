/**
 * Conflict Resolver Service
 * Handles Git merge conflict resolution using AI
 */

import type { ConflictBlock, ConflictResolution, ConflictResolutionResult } from '../types';

export class ConflictResolver {
  private ai: any; // AI binding from Cloudflare Workers
  private githubToken: string;

  constructor(ai: any, githubToken: string) {
    this.ai = ai;
    this.githubToken = githubToken;
  }

  /**
   * Resolve conflicts using AI with keep-both strategy for environment variables
   */
  async resolveConflicts(
    conflicts: ConflictBlock[],
    strategy: 'keep-both' | 'prefer-base' | 'prefer-head' | 'merge-intelligent' = 'merge-intelligent'
  ): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      try {
        const resolved = await this.resolveConflict(conflict, strategy);
        resolutions.push(resolved);
      } catch (error) {
        console.error(`Failed to resolve conflict in ${conflict.file}:`, error);
        // Fallback to keep-both strategy
        const fallback = await this.resolveConflict(conflict, 'keep-both');
        resolutions.push(fallback);
      }
    }

    return resolutions;
  }

  private async resolveConflict(
    conflict: ConflictBlock,
    strategy: string
  ): Promise<ConflictResolution> {
    const prompt = this.buildResolutionPrompt(conflict, strategy);

    // Use Cloudflare AI to resolve the conflict
    const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are the Mission Control Conflict Specialist. Your job is to resolve code conflicts between branches. Preserve both sets of variables if they represent different bindings. Never delete environment variables. Follow "keep both" rule for non-destructive merges. Return resolved file content as unified diff.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.1 // Low temperature for deterministic conflict resolution
    });

    const resolvedContent = this.extractResolvedContent(response);
    const conflictsResolved = this.countConflictsInContent(conflict.baseContent, conflict.headContent);

    return {
      file: conflict.file,
      resolvedContent,
      strategy: strategy as any,
      conflictsResolved
    };
  }

  private buildResolutionPrompt(conflict: ConflictBlock, strategy: string): string {
    return `You are resolving a Git merge conflict in file: ${conflict.file}

Resolution Strategy: ${strategy}

CONFLICT BLOCK:
${conflict.conflictMarkers.start}
${conflict.baseContent}
${conflict.conflictMarkers.separator}
${conflict.headContent}
${conflict.conflictMarkers.end}

CRITICAL RULES:
1. If this is a configuration file (wrangler.jsonc, package.json, etc.), prefer "keep-both" for environment variables and bindings
2. Never delete environment variables or configuration keys unless they are truly duplicates
3. Preserve both sets of imports if they differ
4. For code logic conflicts, intelligently merge functionality
5. Return ONLY the resolved content without conflict markers

Return the complete resolved file content:`;
  }

  private extractResolvedContent(aiResponse: any): string {
    // Extract the resolved content from AI response
    if (aiResponse.response) {
      return aiResponse.response;
    }
    if (typeof aiResponse === 'string') {
      return aiResponse;
    }
    // Fallback: try to find content in response object
    return JSON.stringify(aiResponse);
  }

  private countConflictsInContent(base: string, head: string): number {
    // Simple heuristic: count conflict markers
    const baseMatches = (base.match(/<<<<<<</g) || []).length;
    const headMatches = (head.match(/<<<<<<</g) || []).length;
    return Math.max(baseMatches, headMatches);
  }

  /**
   * Parse conflict markers from file content
   */
  static parseConflicts(fileContent: string, filePath: string): ConflictBlock[] {
    const conflicts: ConflictBlock[] = [];
    const lines = fileContent.split('\n');
    let conflictStart = -1;
    let separatorIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for conflict start marker
      if (line.trim().startsWith('<<<<<<<')) {
        conflictStart = i;
      } 
      // Check for separator
      else if (line.trim().startsWith('=======') && conflictStart >= 0) {
        separatorIndex = i;
      }
      // Check for conflict end marker
      else if (line.trim().startsWith('>>>>>>>') && conflictStart >= 0 && separatorIndex > conflictStart) {
        // Extract base and head content
        const baseContent = lines.slice(conflictStart + 1, separatorIndex).join('\n');
        const headContent = lines.slice(separatorIndex + 1, i).join('\n');

        conflicts.push({
          file: filePath,
          startLine: conflictStart,
          endLine: i,
          baseContent,
          headContent,
          conflictMarkers: {
            start: lines[conflictStart],
            separator: lines[separatorIndex],
            end: lines[i]
          }
        });

        // Reset for next conflict
        conflictStart = -1;
        separatorIndex = -1;
      }
    }

    return conflicts;
  }
}

