/**
 * Core utilities for the Cloudflare Durable Object template
 * STRICTLY DO NOT MODIFY THIS FILE - Hidden from AI to prevent breaking core functionality
 */
import { GlobalDurableObject } from './durableObject';

export { GlobalDurableObject };

export type Env = {
    GlobalDurableObject: DurableObjectNamespace<GlobalDurableObject>;
}