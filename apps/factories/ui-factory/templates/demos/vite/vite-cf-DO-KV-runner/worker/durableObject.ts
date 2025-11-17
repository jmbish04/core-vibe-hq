import { DurableObject } from "cloudflare:workers";

// **DO NOT MODIFY THE CLASS NAME**
export class GlobalDurableObject extends DurableObject {
    async getCounterValue() {
      let value = (await this.ctx.storage.get("value")) || 0;
      return value;
    }
  
    async increment(amount = 1) {
      let value: number = (await this.ctx.storage.get("value")) || 0;
      value += amount;
      await this.ctx.storage.put("value", value);
      return value;
    }
  
    async decrement(amount = 1) {
      let value: number = (await this.ctx.storage.get("value")) || 0;
      value -= amount;
      await this.ctx.storage.put("value", value);
      return value;
    }
}