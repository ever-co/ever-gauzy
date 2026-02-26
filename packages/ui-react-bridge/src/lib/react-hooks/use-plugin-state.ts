import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PluginStateService } from '@gauzy/plugin-ui';
import { useInjector } from './use-injector';

/**
 * React hook for reading and writing to the shared PluginStateService.
 *
 * Works like useState but the state is stored in Angular's PluginStateService,
 * making it accessible from both Angular and React simultaneously.
 * All subscribers (React or Angular) are notified on every change.
 *
 * Keys are arbitrary strings. Convention: prefix with your plugin id
 * to avoid collisions: `'my-plugin:counter'`.
 *
 * @param key     State key (e.g. `'my-plugin:count'`)
 * @param initial Initial value used only if the key has never been set
 * @returns       [value, setter] tuple — identical API to useState
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = usePluginState<number>('my-plugin:count', 0);
 *
 *   return (
 *     <div>
 *       <span>{count}</span>
 *       <button onClick={() => setCount(count + 1)}>+</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Using an updater function (like React's functional setState):
 * ```tsx
 * setCount(prev => (prev ?? 0) + 1);
 * ```
 */
export function usePluginState<T>(key: string, initial?: T): [T | undefined, (value: T | ((prev: T | undefined) => T)) => void] {
	const injector = useInjector();

	const stateService = useMemo<PluginStateService | null>(() => {
		if (!injector) return null;
		try {
			const { PluginStateService: StateService } = require('@gauzy/plugin-ui');
			return injector.get(StateService, null) as PluginStateService | null;
		} catch {
			return null;
		}
	}, [injector]);

	// Local React state mirrors the Angular store value
	const [value, _setValue] = useState<T | undefined>(() => {
		if (!stateService) return initial;
		const existing = stateService.get<T>(key);
		if (existing === undefined && initial !== undefined) {
			stateService.set(key, initial);
			return initial;
		}
		return existing ?? initial;
	});

	// Subscribe to Angular store changes
	useEffect(() => {
		if (!stateService) return;

		const subscription = stateService.select<T>(key).subscribe((v) => {
			_setValue(v);
		});

		return () => subscription.unsubscribe();
	}, [stateService, key]);

	// Setter: writes to Angular store (triggers subscription above)
	const setValue = useCallback(
		(next: T | ((prev: T | undefined) => T)) => {
			if (!stateService) {
				// Fallback: update local state only
				_setValue((prev) => (typeof next === 'function' ? (next as (p: T | undefined) => T)(prev) : next));
				return;
			}
			const resolved = typeof next === 'function' ? (next as (p: T | undefined) => T)(stateService.get<T>(key)) : next;
			stateService.set(key, resolved);
		},
		[stateService, key]
	);

	return [value, setValue];
}
