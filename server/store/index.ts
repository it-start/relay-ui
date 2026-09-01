import { IRelayStore } from './types';
import { PosixRelayStore, PosixStoreHooks } from './posixStore';
import { PeTextRelayStore } from './peTextStore';

export * from './types';
export * from './canonical';
export * from './posixStore';
export * from './peTextStore';

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
    // PE_STORE_ROOT selects a read-only view of an existing p-e relay store
    // instead of this project's own. Opt-in: absent, nothing changes. The two
    // are different stores with different record formats, and the p-e one is
    // append-only — which is why that backend declares write, delete and reset
    // unavailable rather than emulating them.
    activeStore = process.env.PE_STORE_ROOT
      ? new PeTextRelayStore()
      : new PosixRelayStore(undefined, hooks);
    activeStore.init();
  }
  return activeStore;
}
