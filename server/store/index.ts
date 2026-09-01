import { IRelayStore } from './types';
import { PosixRelayStore, PosixStoreHooks } from './posixStore';

export * from './types';
export * from './canonical';
export * from './posixStore';

let activeStore: IRelayStore | null = null;

/**
 * Configure and register active store implementation
 */
export function setStore(store: IRelayStore): void {
  activeStore = store;
}

/**
 * Retrieve current active store singleton (defaults to PosixRelayStore if not initialized)
 */
export function getStore(hooks?: PosixStoreHooks): IRelayStore {
  if (!activeStore) {
    activeStore = new PosixRelayStore(undefined, hooks);
    activeStore.init();
  }
  return activeStore;
}
