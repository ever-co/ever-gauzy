import { effect, type Injector, type Signal } from '@angular/core';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * useAngularSignal
 *
 * Subscribes a React component to an Angular signal so the component
 * re-renders whenever the signal changes — regardless of whether the
 * change originated in React or anywhere on the Angular side (layout
 * chevrons, header toggles, other services).
 *
 * Bridged with `useSyncExternalStore`: an Angular `effect` (created
 * against the host injector, so it works outside an injection context)
 * acts as the subscription and is destroyed on unmount.
 */
export function useAngularSignal<T>(injector: Injector, source: Signal<T>): T {
	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const ref = effect(
				() => {
					source();
					onStoreChange();
				},
				{ injector }
			);
			return () => ref.destroy();
		},
		[injector, source]
	);
	return useSyncExternalStore(subscribe, source, source);
}
