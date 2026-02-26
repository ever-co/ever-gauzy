import { useEffect, useMemo, useCallback } from 'react';
import { Observable } from 'rxjs';
import { useInjector } from './use-injector';

import {
	PluginEvent,
	EmitOptions,
	SubscribeOptions,
	PluginEventBusService
} from '../../plugin-extension/plugin-event-bus.service';

/**
 * Hook return type for usePluginEvents.
 */
export interface UsePluginEventsReturn {
	/**
	 * Emit an event to the plugin event bus.
	 */
	emit: <T = unknown>(type: string, payload: T, options?: EmitOptions) => void;

	/**
	 * Subscribe to events of a specific type.
	 * Returns an Observable that can be subscribed to.
	 */
	on: <T = unknown>(type: string, options?: SubscribeOptions) => Observable<PluginEvent<T>>;

	/**
	 * Subscribe to events matching a pattern (supports wildcards).
	 */
	onPattern: <T = unknown>(pattern: string, options?: SubscribeOptions) => Observable<PluginEvent<T>>;

	/**
	 * Subscribe once and automatically unsubscribe.
	 */
	once: <T = unknown>(type: string, callback: (event: PluginEvent<T>) => void, options?: SubscribeOptions) => void;
}

/**
 * React hook for accessing the Plugin Event Bus.
 *
 * Provides a clean interface for inter-plugin communication from React components.
 * Subscriptions are automatically cleaned up when the component unmounts.
 *
 * @param pluginId Optional plugin ID for scoped event emission
 * @returns Event bus utilities (emit, on, onPattern, once)
 *
 * @example
 * ```tsx
 * function MyReactWidget() {
 *   const events = usePluginEvents('my-plugin');
 *
 *   // Subscribe to events
 *   useEffect(() => {
 *     const sub = events.on('time-tracked').subscribe(event => {
 *       console.log('Time tracked:', event.payload);
 *     });
 *     return () => sub.unsubscribe();
 *   }, [events]);
 *
 *   // Emit an event
 *   const handleClick = () => {
 *     events.emit('widget-clicked', { widgetId: 'my-widget' });
 *   };
 *
 *   return <button onClick={handleClick}>Click me</button>;
 * }
 * ```
 */
export function usePluginEvents(pluginId?: string): UsePluginEventsReturn {
	const injector = useInjector();

	// Get the event bus service from Angular DI
	const eventBus = useMemo<PluginEventBusService | null>(() => {
		if (!injector) return null;
		try {
			return injector.get(PluginEventBusService, null);
		} catch {
			return null;
		}
	}, [injector]);

	// Emit function
	const emit = useCallback(
		<T = unknown>(type: string, payload: T, options?: EmitOptions) => {
			if (!eventBus) {
				console.warn('[usePluginEvents] Event bus not available');
				return;
			}
			eventBus.emit(type, payload, {
				...options,
				source: options?.source ?? pluginId
			});
		},
		[eventBus, pluginId]
	);

	// Subscribe function
	const on = useCallback(
		<T = unknown>(type: string, options?: SubscribeOptions): Observable<PluginEvent<T>> => {
			if (!eventBus) {
				console.warn('[usePluginEvents] Event bus not available');
				// Return empty observable
				return new Observable<PluginEvent<T>>();
			}
			return eventBus.on(type, options) as Observable<PluginEvent<T>>;
		},
		[eventBus]
	);

	// Pattern subscribe function
	const onPattern = useCallback(
		<T = unknown>(pattern: string, options?: SubscribeOptions): Observable<PluginEvent<T>> => {
			if (!eventBus) {
				console.warn('[usePluginEvents] Event bus not available');
				return new Observable<PluginEvent<T>>();
			}
			return eventBus.onPattern(pattern, options) as Observable<PluginEvent<T>>;
		},
		[eventBus]
	);

	// Once function
	const once = useCallback(
		<T = unknown>(type: string, callback: (event: PluginEvent<T>) => void, options?: SubscribeOptions) => {
			if (!eventBus) {
				console.warn('[usePluginEvents] Event bus not available');
				return;
			}
			eventBus.once(type, callback as (event: PluginEvent) => void, options);
		},
		[eventBus]
	);

	return { emit, on, onPattern, once };
}

/**
 * Hook to subscribe to a specific event type with automatic cleanup.
 *
 * @param type Event type to subscribe to
 * @param callback Callback function
 * @param options Subscribe options
 * @param deps Dependency array for the effect
 *
 * @example
 * ```tsx
 * function MyWidget() {
 *   usePluginEvent('time-tracked', (event) => {
 *     console.log('Time tracked:', event.payload);
 *   });
 *
 *   return <div>Listening for time-tracked events...</div>;
 * }
 * ```
 */
export function usePluginEvent<T = unknown>(
	type: string,
	callback: (event: PluginEvent<T>) => void,
	options?: SubscribeOptions,
	deps: React.DependencyList = []
): void {
	const events = usePluginEvents();

	useEffect(() => {
		const subscription = events.on<T>(type, options).subscribe(callback);
		return () => subscription.unsubscribe();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type, ...deps]);
}

export default usePluginEvents;
