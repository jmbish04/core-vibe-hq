import type { Bindings, OrderQueueMessage } from "../types";
import { logger } from "./logger";

/**
 * Enqueue orders for downstream factory workers.
 */
export const dispatchOrder = async (bindings: Bindings, message: OrderQueueMessage) => {
  await bindings.ORDERS_QUEUE.send(message);
  logger.info("Queued order for processing", { orderId: message.orderId, factory: message.factory });
};
