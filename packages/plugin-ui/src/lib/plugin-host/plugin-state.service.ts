import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, filter } from 'rxjs';

/**
 * Reactive, plugin-scoped state store.
 *
 * Provides a simple key/value store backed by BehaviorSubjects so both
 * Angular components (via Observables) and React components (via the
 * usePluginState() hook in @gauzy/plugin-ui) can reactively
 * consume and update shared state.
 *
 * Keys are arbitrary strings. Convention: prefix with your plugin id
 * to avoid collisions: `'my-plugin:counter'`.
 *
 * @example Angular:
 * ```ts
 * const state = inject(PluginStateService);
 *
 * // Write
 * state.set('my-plugin:count', 42);
 *
 * // Read (snapshot)
 * const value = state.get<number>('my-plugin:count');
 *
 * // Subscribe (reactive)
 * state.select<number>('my-plugin:count').subscribe(v => console.log(v));
 * ```
 *
 * @example React (via hook):
 * ```tsx
 * const [count, setCount] = usePluginState<number>('my-plugin:count', 0);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PluginStateService {
	private readonly _store = new Map<string, BehaviorSubject<unknown>>();
	/** Keys that were explicitly set (not lazily created by select). */
	private readonly _explicitKeys = new Set<string>();

	// ─── Write ────────────────────────────────────────────────────────────────

	/**
	 * Set a value. Creates the key if it doesn't exist.
	 */
	set<T>(key: string, value: T): void {
		this._explicitKeys.add(key);
		const subject = this._getOrCreate<T>(key, value);
		subject.next(value);
	}

	/**
	 * Update a value using a reducer function.
	 *
	 * @example
	 * state.update<number>('my-plugin:count', n => (n ?? 0) + 1);
	 */
	update<T>(key: string, reducer: (current: T | undefined) => T): void {
		const current = this.get<T>(key);
		this.set(key, reducer(current));
	}

	// ─── Read ─────────────────────────────────────────────────────────────────

	/**
	 * Get a snapshot value. Returns undefined if key not set.
	 */
	get<T>(key: string): T | undefined {
		return this._store.get(key)?.getValue() as T | undefined;
	}

	/**
	 * Get a snapshot value with a fallback default.
	 */
	getOrDefault<T>(key: string, defaultValue: T): T {
		const value = this.get<T>(key);
		return value !== undefined ? value : defaultValue;
	}

	/**
	 * Returns an Observable for a key that emits whenever the value changes.
	 * Emits the current value immediately on subscribe.
	 */
	select<T>(key: string): Observable<T | undefined> {
		return this._getOrCreate<T | undefined>(key, undefined).pipe(distinctUntilChanged());
	}

	/**
	 * Returns an Observable that only emits defined (non-undefined) values.
	 */
	selectDefined<T>(key: string): Observable<T> {
		return this.select<T>(key).pipe(
			filter((v): v is T => v !== undefined),
			distinctUntilChanged()
		);
	}

	// ─── Delete ───────────────────────────────────────────────────────────────

	/**
	 * Delete a key and complete its subject.
	 */
	delete(key: string): void {
		const subject = this._store.get(key);
		if (subject) {
			subject.complete();
			this._store.delete(key);
		}
		this._explicitKeys.delete(key);
	}

	/**
	 * Delete all keys that start with a given prefix.
	 * Use this in ngOnPluginDestroy to clean up plugin state.
	 *
	 * @example
	 * state.deleteByPrefix('my-plugin:');
	 */
	deleteByPrefix(prefix: string): void {
		for (const key of this._store.keys()) {
			if (key.startsWith(prefix)) {
				this.delete(key);
			}
		}
	}

	/**
	 * Delete all state keys. Use with caution in production.
	 */
	clear(): void {
		for (const subject of this._store.values()) {
			subject.complete();
		}
		this._store.clear();
		this._explicitKeys.clear();
	}

	// ─── Utilities ────────────────────────────────────────────────────────────

	/**
	 * Returns true if the key has been explicitly set via `set()` or `update()`.
	 * Keys lazily created by `select()` do not count.
	 */
	has(key: string): boolean {
		return this._explicitKeys.has(key);
	}

	/**
	 * Returns all currently registered keys.
	 */
	keys(): string[] {
		return Array.from(this._store.keys());
	}

	// ─── Internal ─────────────────────────────────────────────────────────────

	private _getOrCreate<T>(key: string, initialValue: T): BehaviorSubject<T> {
		if (!this._store.has(key)) {
			this._store.set(key, new BehaviorSubject<unknown>(initialValue));
		}
		return this._store.get(key) as BehaviorSubject<T>;
	}
}
