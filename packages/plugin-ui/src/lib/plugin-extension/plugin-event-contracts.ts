import { Observable } from 'rxjs';
import type { PluginEvent, PluginEventBusService, EmitOptions, SubscribeOptions } from './plugin-event-bus.service';

// ─── Event Contract Definition ──────────────────────────────────────────────

/**
 * Defines a strongly-typed plugin event contract.
 *
 * Provides type-safe emit and subscribe methods so that event producers
 * and consumers share a common payload type at compile time.
 */
export interface PluginEventContract<T = unknown> {
	/** The event type string (e.g. 'time-tracker:time-tracked'). */
	readonly type: string;
	/** The plugin that owns this event. */
	readonly pluginId: string;
	/** Description of the event (for documentation/introspection). */
	readonly description?: string;
}

/**
 * Typed event emitter bound to a specific event contract.
 */
export interface TypedEventEmitter<T> {
	/** Emit this event with type-safe payload. */
	emit(payload: T, metadata?: Record<string, unknown>): void;
}

/**
 * Typed event subscriber bound to a specific event contract.
 */
export interface TypedEventSubscriber<T> {
	/** Subscribe to this event with type-safe payload. */
	on(options?: SubscribeOptions): Observable<PluginEvent<T>>;
	/** Subscribe once, then auto-unsubscribe. */
	once(callback: (event: PluginEvent<T>) => void, options?: SubscribeOptions): void;
}

/**
 * Combined typed event handle — provides both emit and subscribe with type safety.
 */
export interface TypedEventHandle<T> extends TypedEventEmitter<T>, TypedEventSubscriber<T> {
	/** The underlying event contract. */
	readonly contract: PluginEventContract<T>;
}

// ─── definePluginEvent ──────────────────────────────────────────────────────

/**
 * Defines a strongly-typed plugin event.
 *
 * Returns a contract object that can be used to create type-safe emitters
 * and subscribers. The contract itself is a plain data object — it does NOT
 * reference the event bus, so it can be used in plugin definitions without
 * Angular DI.
 *
 * Convention: prefix event types with the plugin ID (e.g. 'time-tracker:time-tracked').
 *
 * @example
 * ```ts
 * // Define events in your plugin's event file:
 * interface TimeTrackedPayload {
 *   duration: number;
 *   projectId: string;
 *   taskId?: string;
 * }
 *
 * export const TimeTrackedEvent = definePluginEvent<TimeTrackedPayload>(
 *   'time-tracker',
 *   'time-tracker:time-tracked',
 *   'Emitted when time tracking stops with the tracked duration.'
 * );
 *
 * // Emit (in your plugin code):
 * const handle = bindEventTobus(TimeTrackedEvent, eventBus);
 * handle.emit({ duration: 3600, projectId: '123' });
 *
 * // Subscribe (in another plugin):
 * const handle = bindEventToBus(TimeTrackedEvent, eventBus);
 * handle.on().subscribe(event => {
 *   console.log('Tracked:', event.payload.duration); // ← fully typed
 * });
 * ```
 *
 * @param pluginId The owning plugin ID.
 * @param type The event type string (unique across plugins).
 * @param description Optional human-readable description.
 */
export function definePluginEvent<T = unknown>(
	pluginId: string,
	type: string,
	description?: string
): PluginEventContract<T> {
	return Object.freeze({ type, pluginId, description });
}

// ─── bindEventToBus ─────────────────────────────────────────────────────────

/**
 * Binds an event contract to the event bus, returning a type-safe handle.
 *
 * @example
 * ```ts
 * // In Angular service or plugin bootstrap:
 * const handle = bindEventToBus(TimeTrackedEvent, this.eventBus);
 * handle.emit({ duration: 3600, projectId: '123' });
 *
 * // In React via useInjector:
 * const eventBus = useInjector(PluginEventBusService);
 * const handle = useMemo(() => bindEventToBus(TimeTrackedEvent, eventBus), [eventBus]);
 * handle.on().subscribe(event => { ... });
 * ```
 */
export function bindEventToBus<T>(
	contract: PluginEventContract<T>,
	eventBus: PluginEventBusService
): TypedEventHandle<T> {
	return {
		contract,
		emit(payload: T, metadata?: Record<string, unknown>): void {
			eventBus.emit<T>(contract.type, payload, {
				source: contract.pluginId,
				metadata
			});
		},
		on(options?: SubscribeOptions): Observable<PluginEvent<T>> {
			return eventBus.on<T>(contract.type, options);
		},
		once(callback: (event: PluginEvent<T>) => void, options?: SubscribeOptions): void {
			eventBus.once<T>(contract.type, callback, options);
		}
	};
}

// ─── Event Schema Registry ──────────────────────────────────────────────────

/**
 * Registered event schema entry for introspection.
 */
export interface EventSchemaEntry {
	/** The event contract. */
	contract: PluginEventContract;
	/** Direction from the plugin's perspective. */
	direction: 'emits' | 'consumes' | 'both';
}

/**
 * Registry for plugin event schemas.
 *
 * Allows plugins to declare which events they emit and consume,
 * enabling introspection, documentation, and runtime validation.
 *
 * @example
 * ```ts
 * const registry = new PluginEventSchemaRegistry();
 *
 * // Plugin A declares it emits TimeTrackedEvent:
 * registry.registerEmitter('time-tracker', TimeTrackedEvent);
 *
 * // Plugin B declares it consumes TimeTrackedEvent:
 * registry.registerConsumer('analytics', TimeTrackedEvent);
 *
 * // Introspect:
 * registry.getEventsForPlugin('time-tracker'); // → [{ contract, direction: 'emits' }]
 * registry.getConsumersOf('time-tracker:time-tracked'); // → ['analytics']
 * ```
 */
export class PluginEventSchemaRegistry {
	private readonly _schemas = new Map<string, Map<string, EventSchemaEntry>>();

	/**
	 * Registers that a plugin emits an event.
	 */
	registerEmitter(pluginId: string, contract: PluginEventContract): void {
		this._register(pluginId, contract, 'emits');
	}

	/**
	 * Registers that a plugin consumes an event.
	 */
	registerConsumer(pluginId: string, contract: PluginEventContract): void {
		this._register(pluginId, contract, 'consumes');
	}

	/**
	 * Gets all event schemas for a plugin.
	 */
	getEventsForPlugin(pluginId: string): EventSchemaEntry[] {
		const entries = this._schemas.get(pluginId);
		return entries ? Array.from(entries.values()) : [];
	}

	/**
	 * Gets all plugin IDs that emit a specific event type.
	 */
	getEmittersOf(eventType: string): string[] {
		const result: string[] = [];
		for (const [pluginId, entries] of this._schemas) {
			const entry = entries.get(eventType);
			if (entry && (entry.direction === 'emits' || entry.direction === 'both')) {
				result.push(pluginId);
			}
		}
		return result;
	}

	/**
	 * Gets all plugin IDs that consume a specific event type.
	 */
	getConsumersOf(eventType: string): string[] {
		const result: string[] = [];
		for (const [pluginId, entries] of this._schemas) {
			const entry = entries.get(eventType);
			if (entry && (entry.direction === 'consumes' || entry.direction === 'both')) {
				result.push(pluginId);
			}
		}
		return result;
	}

	/**
	 * Gets all registered event types.
	 */
	getAllEventTypes(): string[] {
		const types = new Set<string>();
		for (const entries of this._schemas.values()) {
			for (const key of entries.keys()) {
				types.add(key);
			}
		}
		return Array.from(types);
	}

	/**
	 * Unregisters all schemas for a plugin.
	 */
	unregisterByPlugin(pluginId: string): void {
		this._schemas.delete(pluginId);
	}

	/**
	 * Clears all schemas.
	 */
	clear(): void {
		this._schemas.clear();
	}

	private _register(pluginId: string, contract: PluginEventContract, direction: 'emits' | 'consumes'): void {
		if (!this._schemas.has(pluginId)) {
			this._schemas.set(pluginId, new Map());
		}
		const entries = this._schemas.get(pluginId)!;
		const existing = entries.get(contract.type);
		if (existing) {
			// If already registered in opposite direction, mark as 'both'
			if (existing.direction !== direction) {
				entries.set(contract.type, { contract, direction: 'both' });
			}
		} else {
			entries.set(contract.type, { contract, direction });
		}
	}
}
