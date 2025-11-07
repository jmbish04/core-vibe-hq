/**
 * Queue worker for async conflict and delivery handling.
 * Optional if Queues are enabled in the orchestrator.
 */

import { OpsSpecialist } from './index'
import type { Env } from '../../../../orchestrator/worker/types'

export default {
  async queue(batch: MessageBatch<unknown>, env: Env) {
    for (const msg of batch.messages) {
      const data = JSON.parse(msg.body as string)
      if (data.type === 'resolve_conflict') {
        await OpsSpecialist.resolveConflict(env, data.repo, data.branch, data.files)
      } else if (data.type === 'final_qa') {
        await OpsSpecialist.finalQA(env, data.order_id)
      }
    }
  },
}

