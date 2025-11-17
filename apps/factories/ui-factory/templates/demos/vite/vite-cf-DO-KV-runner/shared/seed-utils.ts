import { KV_SEED_DATA } from './mock-data';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  KVStore: KVNamespace;
}

export async function seedKVStore(kv: KVNamespace): Promise<void> {
  const promises = Object.entries(KV_SEED_DATA).map(([key, value]) =>
    kv.put(key, JSON.stringify(value))
  );
  await Promise.all(promises);
}

export async function isKVSeeded(kv: KVNamespace): Promise<boolean> {
  const items = await kv.get('demo_items');
  return items !== null;
}

export async function seedAll(env: Env): Promise<{ kv: boolean }> {
  if (await isKVSeeded(env.KVStore)) {
    return { kv: false };
  }
  
  await seedKVStore(env.KVStore);
  return { kv: true };
}
