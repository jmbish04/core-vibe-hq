// Patch contracts
import { z } from 'zod';

export const PatchOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'replace']),
  path: z.string(),
  value: z.any().optional()
});

export const PatchBatchSchema = z.object({
  patches: z.array(PatchOperationSchema),
  description: z.string().optional()
});

export type PatchOperation = z.infer<typeof PatchOperationSchema>;
export type PatchBatch = z.infer<typeof PatchBatchSchema>;
