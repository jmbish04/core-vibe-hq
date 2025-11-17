/**
 * Core utilities for Multiple Entities sharing a single Durable Object class
 * DO NOT MODIFY THIS FILE - You may break the project functionality
 */
import type { ApiResponse } from "@shared/types";
import { DurableObject } from "cloudflare:workers";
import type { Context } from "hono";

export interface Env {
  GlobalDurableObject: DurableObjectNamespace<GlobalDurableObject>;
}

type Doc<T> = { v: number; data: T };

/**
 * Global Durable object for storage-purpose ONLY, to be used as a KV-like storage by multiple entities
 */
export class GlobalDurableObject extends DurableObject<Env, unknown> {
  constructor(public ctx: DurableObjectState, public env: Env) {
    super(ctx, env);
  }

  /** Delete a key; returns true if it existed. */
  async del(key: string): Promise<boolean> {
    const existed = (await this.ctx.storage.get(key)) !== undefined;
    await this.ctx.storage.delete(key);
    return existed;
  }

  /** Fast existence check. */
  async has(key: string): Promise<boolean> {
    return (await this.ctx.storage.get(key)) !== undefined;
  }

  async getDoc<T>(key: string): Promise<Doc<T> | null> {
    const v = await this.ctx.storage.get<Doc<T>>(key);
    return v ?? null;
  }

  async casPut<T>(key: string, expectedV: number, data: T): Promise<{ ok: boolean; v: number }> {
    return this.ctx.storage.transaction(async (txn) => {
      const cur = await txn.get<Doc<T>>(key);
      const curV = cur?.v ?? 0;
      if (curV !== expectedV) return { ok: false, v: curV };
      const nextV = curV + 1;
      await txn.put(key, { v: nextV, data });
      return { ok: true, v: nextV };
    });
  }

  async listPrefix(prefix: string, startAfter?: string | null, limit?: number) {
    const opts: Record<string, unknown> = { prefix };
    if (limit != null) opts.limit = limit;
    if (startAfter)   opts.startAfter = startAfter;
  
    const m = await this.ctx.storage.list(opts);            // Map<string, unknown>
    const names = Array.from((m as Map<string, unknown>).keys());
    // Heuristic: if we got "limit" items, assume there might be more; use the last key as the cursor.
    const next = limit != null && names.length === limit ? names[names.length - 1] : null;
    return { keys: names, next };
  }
  
  async indexAddBatch<T>(items: T[]): Promise<void> {
    if (items.length === 0) return;
    await this.ctx.storage.transaction(async (txn) => {
      for (const it of items) await txn.put('i:' + String(it), 1);
    });
  }
  
  async indexRemoveBatch<T>(items: T[]): Promise<number> {
    if (items.length === 0) return 0;
    let removed = 0;
    await this.ctx.storage.transaction(async (txn) => {
      for (const it of items) {
        const k = 'i:' + String(it);
        const existed = (await txn.get(k)) !== undefined;
        await txn.delete(k);
        if (existed) removed++;
      }
    });
    return removed;
  }  

  async indexDrop(_rootKey: string): Promise<void> { await this.ctx.storage.deleteAll(); }
}

export interface EntityStatics<S, T extends Entity<S>> {
  new (env: Env, id: string): T; // inherited default ctor
  readonly entityName: string;
  readonly initialState: S;
}

/**
 * Base class for entities - extend this class to create new entities
 */
export abstract class Entity<State> {
  protected _state!: State;
  protected _version: number = 0;
  protected readonly stub: DurableObjectStub<GlobalDurableObject>;
  protected readonly _id: string;
  protected readonly entityName: string;
  protected readonly env: Env;

  constructor(env: Env, id: string) {
    this.env = env;
    this._id = id;

    // Read subclass statics via new.target / constructor
    const Ctor = this.constructor as EntityStatics<State, this>;
    this.entityName = Ctor.entityName;

    const instanceName = `${this.entityName}:${this._id}`;
    const doId = env.GlobalDurableObject.idFromName(instanceName);
    this.stub = env.GlobalDurableObject.get(doId);
  }

  /** Synchronous accessors */
  get id(): string {
    return this._id;
  }
  get state(): State {
    return this._state;
  }

  /** Storage key for this entity document. */
  protected key(): string {
    return `${this.entityName}:${this._id}`;
  }

  /** Save and refresh cache. */
  async save(next: State): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await this.ensureState();
      const res = await this.stub.casPut(this.key(), this._version, next);
      if (res.ok) {
        this._version = res.v;
        this._state = next;
        return;
      }
      // retry on contention
    }
    throw new Error("Concurrent modification detected");
  }

  protected async ensureState(): Promise<State> {
    const Ctor = this.constructor as EntityStatics<State, this>;
    const doc = (await this.stub.getDoc(this.key())) as Doc<State> | null;
    if (doc == null) {
      this._version = 0;
      this._state = Ctor.initialState;
      return this._state;
    }
    this._version = doc.v;
    this._state = doc.data;
    return this._state;
  }

  async mutate(updater: (current: State) => State): Promise<State> {
    // Small bounded retry loop for CAS contention
    for (let i = 0; i < 4; i++) {
      const current = await this.ensureState();
      const startV = this._version;
      const next = updater(current);
      const res = await this.stub.casPut(this.key(), startV, next);
      if (res.ok) {
        this._version = res.v;
        this._state = next;
        return next;
      }
      // someone else updated; retry
    }
    throw new Error("Concurrent modification detected");
  }

  async getState(): Promise<State> {
    return this.ensureState();
  }

  async patch(p: Partial<State>): Promise<void> {
    await this.mutate((s) => ({ ...s, ...p }));
  }

  async exists(): Promise<boolean> {
    return this.stub.has(this.key());
  }

  /** Delete the entity. */
  async delete(): Promise<boolean> {
    const ok = await this.stub.del(this.key());
    if (ok) {
      const Ctor = this.constructor as EntityStatics<State, this>;
      this._version = 0;
      this._state = Ctor.initialState;
    }
    return ok;
  }
}

// Minimal prefix-based index held in its own DO instance.
export class Index<T extends string> extends Entity<unknown> {
  static readonly entityName = "sys-index-root";

  constructor(env: Env, name: string) { super(env, `index:${name}`); }

  /**
   * Adds a batch of items to the index transactionally.
   */
  async addBatch(itemsToAdd: T[]): Promise<void> {
    if (itemsToAdd.length === 0) return;
    await this.stub.indexAddBatch(itemsToAdd);
  }

  async add(item: T): Promise<void> {
    return this.addBatch([item]);
  }

  async remove(item: T): Promise<boolean> {
    const removed = await this.removeBatch([item]);
    return removed > 0;
  }

  async removeBatch(itemsToRemove: T[]): Promise<number> {
    if (itemsToRemove.length === 0) return 0;
    return this.stub.indexRemoveBatch(itemsToRemove);
  }

  async clear(): Promise<void> { await this.stub.indexDrop(this.key()); }

  async page(cursor?: string | null, limit?: number): Promise<{ items: T[]; next: string | null }> {
    const { keys, next } = await this.stub.listPrefix('i:', cursor ?? null, limit);
    return { items: keys.map(k => k.slice(2) as T), next };
  }

  async list(): Promise<T[]> {
    const { keys } = await this.stub.listPrefix('i:');
    return keys.map(k => k.slice(2) as T);
  }
}

type IS<T> = T extends new (env: Env, id: string) => IndexedEntity<infer S> ? S : never;
type HS<TCtor> = TCtor & { indexName: string; keyOf(state: IS<TCtor>): string; seedData?: ReadonlyArray<IS<TCtor>> };
type CtorAny = new (env: Env, id: string) => IndexedEntity<{ id: string }>;

export abstract class IndexedEntity<S extends { id: string }> extends Entity<S> {
  static readonly indexName: string;
  static keyOf<U extends { id: string }>(state: U): string { return state.id; }

  // Static helpers infer S from `this` and the arguments
  static async create<TCtor extends CtorAny>(this: HS<TCtor>, env: Env, state: IS<TCtor>): Promise<IS<TCtor>> {
    const id = this.keyOf(state);
    const inst = new this(env, id);
    await inst.save(state);
    const idx = new Index<string>(env, this.indexName);
    await idx.add(id);
    return state;
  }

  static async list<TCtor extends CtorAny>(
    this: HS<TCtor>,
    env: Env,
    cursor?: string | null,
    limit?: number
  ): Promise<{ items: IS<TCtor>[]; next: string | null }> {
    const idx = new Index<string>(env, this.indexName);
    const { items: ids, next } = await idx.page(cursor, limit);
    const rows = (await Promise.all(ids.map((id) => new this(env, id).getState()))) as IS<TCtor>[];
    return { items: rows, next };
  }

  static async ensureSeed<TCtor extends CtorAny>(this: HS<TCtor>, env: Env): Promise<void> {
    const idx = new Index<string>(env, this.indexName);
    const ids = await idx.list();
    const seeds = this.seedData;
    if (ids.length === 0 && seeds && seeds.length > 0) {
      await Promise.all(seeds.map(s => new this(env, this.keyOf(s)).save(s)));
      await idx.addBatch(seeds.map(s => this.keyOf(s)));
    }
  }

  /** Delete an entity document and remove its id from the index. */
  static async delete<TCtor extends CtorAny>(this: HS<TCtor>, env: Env, id: string): Promise<boolean> {
    const inst = new this(env, id);
    const existed = await inst.delete();
    const idx = new Index<string>(env, this.indexName);
    await idx.remove(id);
    return existed;
  }

  /** Delete many entities and prune their ids from the index. Returns number of docs removed. */
  static async deleteMany<TCtor extends CtorAny>(this: HS<TCtor>, env: Env, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const results = await Promise.all(ids.map(async (id) => new this(env, id).delete()));
    const idx = new Index<string>(env, this.indexName);
    await idx.removeBatch(ids);
    return results.filter(Boolean).length;
  }

  /** Remove only the id from the index; does not delete the entity document. */
  static async removeFromIndex<TCtor extends CtorAny>(this: HS<TCtor>, env: Env, id: string): Promise<void> {
    const idx = new Index<string>(env, this.indexName);
    await idx.remove(id);
  }

  protected override async ensureState(): Promise<S> {
    const s = (await super.ensureState()) as S;
    if (!s.id) {
      // Ensure the entity state id matches the instance id for consistency
      const withId = { ...s, id: this.id } as S;
      this._state = withId;
      return withId;
    }
    return s;
  }
}

// API HELPERS

export const ok = <T>(c: Context, data: T) => c.json({ success: true, data } as ApiResponse<T>);
export const bad = (c: Context, error: string) => c.json({ success: false, error } as ApiResponse, 400);
export const notFound = (c: Context, error = 'not found') => c.json({ success: false, error } as ApiResponse, 404);
export const isStr = (s: unknown): s is string => typeof s === 'string' && s.length > 0;