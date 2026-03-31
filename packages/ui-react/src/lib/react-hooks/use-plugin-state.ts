import { useMemo, useCallback } from 'react';
import { PluginStateService } from '@gauzy/plugin-ui';
import { useInjector } from './use-injector';
import { useObservable } from './use-observable';

/**
 * React hook for reactive access to the plugin state store.
 *
 * Returns a `[value, setValue]` tuple (like React's `useState`) backed by
 * `PluginStateService`. Changes made from **any** source — Angular components,
 * other React components, or other plugins — trigger a re-render automatically.
 *
 * Convention: prefix keys with your plugin id to avoid collisions
 * (e.g. `'my-plugin:counter'`).
 *
 * @param key The state key to subscribe to.
 * @param initialValue Optional initial value (set only if the key doesn't exist yet).
 * @returns `[currentValue, setValue]` tuple.
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = usePluginState<number>('my-plugin:count', 0);
 *
 *   return (
 *     <button onClick={() => setCount(count + 1)}>
 *       Count: {count}
 *     </button>
 *   );
 * }
 * ```
 *
 * @example With updater function
 * ```tsx
 * const [items, setItems] = usePluginState<string[]>('my-plugin:items', []);
 * setItems(prev => [...prev, 'new item']);
 * ```
 */
export function usePluginState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void];
export function usePluginState<T>(key: string): [T | undefined, (value: T | ((prev: T | undefined) => T)) => void];
export function usePluginState<T>(
	key: string,
	initialValue?: T
): [T | undefined, (value: T | ((prev: T | undefined) => T)) => void] {
	const stateService = useInjector(PluginStateService);

	// Initialize the key if an initial value is provided and the key doesn't exist yet
	useMemo(() => {
		if (initialValue !== undefined && !stateService.has(key)) {
			stateService.set(key, initialValue);
		}
	}, [stateService, key, initialValue]);

	// Subscribe to reactive updates
	const value$ = useMemo(() => stateService.select<T>(key), [stateService, key]);
	const value = useObservable(value$, initialValue);

	// Setter — supports both direct value and updater function
	const setValue = useCallback(
		(valueOrUpdater: T | ((prev: T | undefined) => T)) => {
			if (typeof valueOrUpdater === 'function') {
				const current = stateService.get<T>(key);
				stateService.set(key, (valueOrUpdater as (prev: T | undefined) => T)(current));
			} else {
				stateService.set(key, valueOrUpdater);
			}
		},
		[stateService, key]
	);

	return [value, setValue];
}
