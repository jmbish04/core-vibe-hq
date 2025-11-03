import type { MessageBatch } from "@cloudflare/workers-types";

import type { Bindings, OrderQueueMessage } from "../types";
import { logger } from "../services/logger";

/**
 * ORDERS_QUEUE consumer entry point.
 * TODO: Implement downstream factory communication and status updates.
 */
export const handleOrdersQueue = async (batch: MessageBatch<OrderQueueMessage>, env: Bindings) => {
  for (const message of batch.messages) {
    try {
      logger.info("Processing order queue message", { orderId: message.body.orderId });
      // TODO: Integrate with factory APIs and update order status/results.
      await env.CACHE.put(`order:last-processed:${message.body.orderId}`, new Date().toISOString());
      await message.ack();
    } catch (error) {
      logger.error("Failed to process order message", { error, orderId: message.body.orderId });
      await message.retry();
    }
  }
};
