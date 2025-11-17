/**
 * Exec Utility
 * 
 * Safe one-shot runner for shell commands.
 * In Workers runtime, this is a no-op since we can't spawn processes.
 * In factory containers, this should be replaced with a Node child_process wrapper.
 */

export async function exec(
  cmd: string, 
  stdin?: string
): Promise<{ ok: boolean; code: number; stdout: string; stderr: string }> {
  // In Workers runtime you can't spawn; this util is for your container/CLI runs.
  // Keep here as a placeholder so your local runner & containers use it.
  return { 
    ok: false, 
    code: 1, 
    stdout: '', 
    stderr: 'exec not supported in Workers runtime - use in factory containers with child_process' 
  }
}




