import type { DemoItem } from './types';

export const MOCK_ITEMS: DemoItem[] = [
  { id: '1', name: 'Demo Item A', value: 42 },
  { id: '2', name: 'Demo Item B', value: 73 }
];

export const KV_SEED_DATA = {
  demo_items: MOCK_ITEMS,
  simple_counter: 10
};
