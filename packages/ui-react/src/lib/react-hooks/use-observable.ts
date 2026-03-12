import { useState, useEffect, useRef } from 'react';
import type { Observable, BehaviorSubject } from 'rxjs';

/**
 * React hook that subscribes to an RxJS Observable and returns its latest value.
 *
 * - Subscribes on mount (or when `observable$` changes), unsubscribes on unmount.
 * - If the Observable is a `BehaviorSubject`, the current value is used as the
 *   initial state (no flash of `initialValue`).
 * - Handles observable reference changes gracefully (resubscribes automatically).
 *
 * @param observable$ The RxJS Observable to subscribe to.
 * @param initialValue Fallback value used before the first emission.
 * @returns The latest emitted value, or `initialValue` if nothing has emitted yet.
 *
 * @example
 * ```tsx
 * const users$ = useMemo(() => userService.getUsers(), [userService]);
 * const users = useObservable(users$, []);
 *
 * return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
 * ```
 *
 * @example BehaviorSubject (synchronous initial value)
 * ```tsx
 * const count$ = useMemo(() => stateService.select<number>('counter'), []);
 * const count = useObservable(count$, 0);
 * ```
 */
export function useObservable<T>(observable$: Observable<T>, initialValue: T): T;
export function useObservable<T>(observable$: Observable<T>): T | undefined;
export function useObservable<T>(observable$: Observable<T>, initialValue?: T): T | undefined {
	// Try to read synchronous value from BehaviorSubject
	const syncValue = readBehaviorSubjectValue<T>(observable$);

	const [value, setValue] = useState<T | undefined>(syncValue !== undefined ? syncValue : initialValue);

	// Track the latest observable reference to avoid stale closure updates
	const observableRef = useRef(observable$);
	observableRef.current = observable$;

	useEffect(() => {
		// Re-read sync value in case observable$ changed between render and effect
		const currentSync = readBehaviorSubjectValue<T>(observable$);
		if (currentSync !== undefined) {
			setValue(currentSync);
		}

		const subscription = observable$.subscribe({
			next: (val) => setValue(val),
			error: (err) => console.error('[useObservable] Subscription error:', err)
		});

		return () => subscription.unsubscribe();
	}, [observable$]);

	return value;
}

/**
 * Attempts to synchronously read the current value of a BehaviorSubject.
 * Returns `undefined` for plain Observables (no `.getValue()` method).
 */
function readBehaviorSubjectValue<T>(obs: Observable<T>): T | undefined {
	if (obs && typeof (obs as BehaviorSubject<T>).getValue === 'function') {
		try {
			return (obs as BehaviorSubject<T>).getValue();
		} catch {
			return undefined;
		}
	}
	return undefined;
}
