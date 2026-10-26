import ElectronStore from 'electron-store';
import type { ElectronStoreOf } from '../types';

export class AkitaStorageEngine {
	private readonly store: ElectronStoreOf;

	/**
	 * Create a new AkitaStorageEngine.
	 *
	 * @param store - Optional ElectronStore instance.
	 */
	constructor(store?: ElectronStoreOf) {
		this.store = store ?? (new ElectronStore({ name: 'window-state' }) as ElectronStoreOf);
	}

	/**
	 * Retrieves the value associated with the specified key from the local store.
	 *
	 * @param key - The key for which to retrieve the value.
	 * @returns The value associated with the specified key or undefined.
	 */
	public getItem<T = any>(key: string): T | undefined {
		if (!key) return undefined;
		return this.store.get(key) as T | undefined;
	}

	/**
	 * Stores a value under the specified key in the local store.
	 *
	 * @param key - The key under which to store the value.
	 * @param value - The value to be stored.
	 */
	public setItem<T = any>(key: string, value: T): void {
		if (!key) throw new Error('Key is required');
		this.store.set(key, value);
	}

	/**
	 * Removes the value associated with the specified key from the local store.
	 *
	 * @param key - The key for which to remove the value.
	 */
	public removeItem(key: string): void {
		if (!key) return;
		this.store.delete(key);
	}

	/**
	 * Clears all key-value pairs from the local store.
	 */
	public clear(): void {
		this.store.clear();
	}

	/**
	 * Returns whether the given key exists in the store.
	 *
	 * @param key - The key to check.
	 */
	public has(key: string): boolean {
		if (!key) return false;
		return this.store.has(key);
	}
}
