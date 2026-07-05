import * as ElectronStore from 'electron-store';
import { StoreSchema } from './types';

/**
 * Lazily-initialized ElectronStore singleton.
 * Construction is deferred until first access so that electron-store's
 * internal call to app.getPath('userData') does not run before app.ready.
 */
let _store: ElectronStore<StoreSchema> | null = null;

function getStore(): ElectronStore<StoreSchema> {
	if (!_store) {
		_store = new ElectronStore<StoreSchema>();
	}
	return _store;
}

// Proxy that forwards every property/method access to the lazy instance,
// preserving the existing `store.get(...)` / `store.set(...)` call-sites.
export const store = new Proxy({} as ElectronStore<StoreSchema>, {
	get(_target, prop) {
		const instance = getStore();
		const value = (instance as any)[prop];
		return typeof value === 'function' ? value.bind(instance) : value;
	},
	set(_target, prop, value) {
		(getStore() as any)[prop] = value;
		return true;
	}
});
