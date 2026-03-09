import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, filter, map, Subscription, TeardownLogic } from 'rxjs';

/**
 * Event payload for plugin events.
 */
export interface PluginEvent<T = unknown> {
	/** Event type/name */
	type: string;
	/** Event payload data */
	payload: T;
	/** Source plugin ID */
	source?: string;
	/** Timestamp when the event was emitted */
	timestamp: number;
	/** Optional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Options for emitting events.
 */
export interface EmitOptions {
	/** Source plugin ID */
	source?: string;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Options for subscribing to events.
 */
export interface SubscribeOptions {
	/** Filter events by source plugin */
	source?: string;
	/** Only receive events emitted after this timestamp */
	afterTimestamp?: number;
}

/**
 * Plugin Event Bus Service.
 *
 * Provides a centralized event bus for inter-plugin communication.
 * Plugins can emit events and subscribe to events from other plugins.
 *
 * @example
 * ```typescript
 * // Emit an event
 * eventBus.emit('time-tracked', { duration: 3600, projectId: '123' });
 *
 * // Subscribe to events
 * eventBus.on('time-tracked').subscribe(event => {
 *   console.log('Time tracked:', event.payload);
 * });
 *
 * // Subscribe with filtering
 * eventBus.on('*', { source: 'time-tracker-plugin' }).subscribe(event => {
 *   console.log('Event from time-tracker:', event);
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PluginEventBusService implements OnDestroy {
	private readonly _eventStream$ = new Subject<PluginEvent>();
	private readonly _subscriptions = new Map<string, Subscription[]>();

	/**
	 * Observable stream of all events.
	 */
	readonly events$ = this._eventStream$.asObservable();

	/**
	 * Emits an event to the event bus.
	 *
	 * @param type Event type/name
	 * @param payload Event payload data
	 * @param options Optional emit options
	 */
	emit<T = unknown>(type: string, payload: T, options?: EmitOptions): void {
		const event: PluginEvent<T> = {
			type,
			payload,
			source: options?.source,
			timestamp: Date.now(),
			metadata: options?.metadata
		};
		this._eventStream$.next(event);
	}

	/**
	 * Subscribes to events of a specific type.
	 *
	 * @param type Event type to subscribe to, or '*' for all events
	 * @param options Optional subscribe options for filtering
	 * @returns Observable of matching events
	 */
	on<T = unknown>(type: string, options?: SubscribeOptions): Observable<PluginEvent<T>> {
		return this._eventStream$.pipe(
			filter((event) => {
				// Type filter
				if (type !== '*' && event.type !== type) {
					return false;
				}
				// Source filter
				if (options?.source && event.source !== options.source) {
					return false;
				}
				// Timestamp filter
				if (options?.afterTimestamp && event.timestamp <= options.afterTimestamp) {
					return false;
				}
				return true;
			}),
			map((event) => event as PluginEvent<T>)
		);
	}

	/**
	 * Subscribes to events matching a pattern.
	 * Supports wildcards: 'user.*' matches 'user.created', 'user.updated', etc.
	 *
	 * @param pattern Event type pattern with optional wildcards
	 * @param options Optional subscribe options
	 * @returns Observable of matching events
	 */
	onPattern<T = unknown>(pattern: string, options?: SubscribeOptions): Observable<PluginEvent<T>> {
		// Escape regex metacharacters, then convert wildcard '*' back to '.*'
		const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
		const regex = new RegExp('^' + escaped + '$');
		return this._eventStream$.pipe(
			filter((event) => {
				if (!regex.test(event.type)) {
					return false;
				}
				if (options?.source && event.source !== options.source) {
					return false;
				}
				if (options?.afterTimestamp && event.timestamp <= options.afterTimestamp) {
					return false;
				}
				return true;
			}),
			map((event) => event as PluginEvent<T>)
		);
	}

	/**
	 * Subscribes to an event once, then automatically unsubscribes.
	 *
	 * @param type Event type to subscribe to
	 * @param callback Callback function
	 * @param options Optional subscribe options
	 */
	once<T = unknown>(
		type: string,
		callback: (event: PluginEvent<T>) => void,
		options?: SubscribeOptions
	): void {
		const subscription = this.on<T>(type, options).subscribe((event) => {
			callback(event);
			subscription.unsubscribe();
		});
	}

	/**
	 * Registers a subscription for a plugin (for automatic cleanup).
	 *
	 * @param pluginId Plugin ID
	 * @param subscription Subscription to track
	 */
	registerSubscription(pluginId: string, subscription: Subscription): void {
		const subs = this._subscriptions.get(pluginId) ?? [];
		subs.push(subscription);
		this._subscriptions.set(pluginId, subs);
	}

	/**
	 * Unsubscribes all subscriptions for a plugin.
	 * Call this when a plugin is destroyed.
	 *
	 * @param pluginId Plugin ID
	 */
	unsubscribeByPlugin(pluginId: string): void {
		const subs = this._subscriptions.get(pluginId);
		if (subs) {
			subs.forEach((sub) => sub.unsubscribe());
			this._subscriptions.delete(pluginId);
		}
	}

	/**
	 * Creates a scoped event emitter for a plugin.
	 * Events emitted through this emitter automatically include the plugin source.
	 *
	 * @param pluginId Plugin ID
	 * @returns Scoped event emitter
	 */
	forPlugin(pluginId: string): PluginEventEmitter {
		return new PluginEventEmitter(this, pluginId);
	}

	ngOnDestroy(): void {
		this._eventStream$.complete();
		this._subscriptions.forEach((subs) => subs.forEach((sub) => sub.unsubscribe()));
		this._subscriptions.clear();
	}
}

/**
 * Scoped event emitter for a specific plugin.
 */
export class PluginEventEmitter {
	constructor(
		private readonly _eventBus: PluginEventBusService,
		private readonly _pluginId: string
	) {}

	/**
	 * Emits an event with the plugin source automatically set.
	 */
	emit<T = unknown>(type: string, payload: T, metadata?: Record<string, unknown>): void {
		this._eventBus.emit(type, payload, {
			source: this._pluginId,
			metadata
		});
	}

	/**
	 * Subscribes to events and registers for automatic cleanup on `destroy()`.
	 */
	on<T = unknown>(type: string, options?: SubscribeOptions): Observable<PluginEvent<T>> {
		return this._trackSubscription(this._eventBus.on<T>(type, options));
	}

	/**
	 * Subscribes to events matching a pattern and registers for automatic cleanup on `destroy()`.
	 */
	onPattern<T = unknown>(pattern: string, options?: SubscribeOptions): Observable<PluginEvent<T>> {
		return this._trackSubscription(this._eventBus.onPattern<T>(pattern, options));
	}

	/**
	 * Wraps an observable so that subscriptions are automatically tracked
	 * for cleanup when `destroy()` is called.
	 */
	private _trackSubscription<T>(source$: Observable<T>): Observable<T> {
		const pluginId = this._pluginId;
		const eventBus = this._eventBus;
		return new Observable<T>((subscriber) => {
			const sub = source$.subscribe(subscriber);
			eventBus.registerSubscription(pluginId, sub);
			return sub;
		});
	}

	/**
	 * Subscribes once then unsubscribes.
	 */
	once<T = unknown>(
		type: string,
		callback: (event: PluginEvent<T>) => void,
		options?: SubscribeOptions
	): void {
		this._eventBus.once<T>(type, callback, options);
	}

	/**
	 * Cleans up all subscriptions for this plugin.
	 */
	destroy(): void {
		this._eventBus.unsubscribeByPlugin(this._pluginId);
	}
}
