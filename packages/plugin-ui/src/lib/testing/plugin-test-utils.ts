import { Injector } from '@angular/core';
import { Subject, Observable, filter, map } from 'rxjs';
import type { PluginUiDefinition, PluginSettingsSchema } from '../plugin-ui.types';
import type { PageExtensionDefinition } from '../plugin-extension/page-extension-slot.types';
import {
	type PluginEvent,
	type EmitOptions,
	type SubscribeOptions
} from '../plugin-extension/plugin-event-bus.service';
import { PluginStateService } from '../plugin-host/plugin-state.service';
import { PageExtensionRegistryService } from '../plugin-extension/page-extension-registry.service';
import { PluginSettingsRegistryService } from '../plugin-host/plugin-settings-registry.service';
import { PluginServiceRegistryService } from '../plugin-host/plugin-service-registry.service';

// ─── createTestPlugin ───────────────────────────────────────────────────────

/**
 * Options for creating a test plugin definition.
 */
export interface CreateTestPluginOptions {
	id?: string;
	routes?: PluginUiDefinition['routes'];
	tabs?: PluginUiDefinition['tabs'];
	extensions?: PageExtensionDefinition[];
	translations?: Record<string, Record<string, any>>;
	settings?: PluginSettingsSchema;
	options?: Record<string, unknown>;
}

/**
 * Creates a minimal `PluginUiDefinition` for unit testing.
 *
 * @example
 * ```ts
 * const plugin = createTestPlugin({ id: 'test-plugin' });
 * expect(plugin.id).toBe('test-plugin');
 * expect(plugin.bootstrap).toBeDefined();
 * ```
 */
export function createTestPlugin(opts: CreateTestPluginOptions = {}): PluginUiDefinition {
	const id = opts.id ?? `test-plugin-${Math.random().toString(36).slice(2, 8)}`;
	return {
		id,
		routes: opts.routes ?? [],
		tabs: opts.tabs ?? [],
		extensions: opts.extensions ?? [],
		translations: opts.translations,
		settings: opts.settings,
		options: opts.options ?? {},
		bootstrap: () => {
			// no-op for tests
		}
	};
}

// ─── MockEventBus ───────────────────────────────────────────────────────────

/**
 * Mock event bus for testing inter-plugin communication.
 *
 * Records all emitted events and provides helpers for asserting.
 *
 * @example
 * ```ts
 * const eventBus = new MockEventBus();
 * eventBus.emit('my-event', { data: 42 });
 * expect(eventBus.emittedEvents).toHaveLength(1);
 * expect(eventBus.getEmittedByType('my-event')[0].payload).toEqual({ data: 42 });
 * ```
 */
export class MockEventBus {
	private readonly _stream$ = new Subject<PluginEvent>();
	private readonly _emitted: PluginEvent[] = [];

	/** All emitted events. */
	get emittedEvents(): ReadonlyArray<PluginEvent> {
		return this._emitted;
	}

	/** Observable stream of all events (matches PluginEventBusService.events$). */
	readonly events$ = this._stream$.asObservable();

	emit<T = unknown>(type: string, payload: T, options?: EmitOptions): void {
		const event: PluginEvent<T> = {
			type,
			payload,
			source: options?.source,
			timestamp: Date.now(),
			metadata: options?.metadata
		};
		this._emitted.push(event);
		this._stream$.next(event);
	}

	on<T = unknown>(type: string, options?: SubscribeOptions): Observable<PluginEvent<T>> {
		return this._stream$.pipe(
			filter((e) => type === '*' || e.type === type),
			filter((e) => !options?.source || e.source === options.source),
			map((e) => e as PluginEvent<T>)
		);
	}

	onPattern<T = unknown>(pattern: string, options?: SubscribeOptions): Observable<PluginEvent<T>> {
		const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
		return this._stream$.pipe(
			filter((e) => regex.test(e.type)),
			filter((e) => !options?.source || e.source === options.source),
			map((e) => e as PluginEvent<T>)
		);
	}

	once<T = unknown>(type: string, callback: (event: PluginEvent<T>) => void, options?: SubscribeOptions): void {
		const sub = this.on<T>(type, options).subscribe((event) => {
			callback(event);
			sub.unsubscribe();
		});
	}

	/** Gets emitted events filtered by type. */
	getEmittedByType<T = unknown>(type: string): PluginEvent<T>[] {
		return this._emitted.filter((e) => e.type === type) as PluginEvent<T>[];
	}

	/** Gets emitted events filtered by source. */
	getEmittedBySource(source: string): PluginEvent[] {
		return this._emitted.filter((e) => e.source === source);
	}

	/** Clears all recorded events. */
	clear(): void {
		this._emitted.length = 0;
	}

	/** Completes the stream. */
	destroy(): void {
		this._stream$.complete();
	}
}

// ─── TestPluginHarness ──────────────────────────────────────────────────────

/**
 * Options for TestPluginHarness.
 */
export interface TestPluginHarnessOptions {
	/** Custom event bus (defaults to MockEventBus). */
	eventBus?: MockEventBus;
	/** Pre-populate state. */
	initialState?: Record<string, unknown>;
	/** Pre-populate settings. */
	initialSettings?: Record<string, unknown>;
}

/**
 * Test harness for mounting/bootstrapping a plugin in isolation.
 *
 * Provides mock services and utilities for testing plugin behavior
 * without Angular's TestBed.
 *
 * @example
 * ```ts
 * const harness = new TestPluginHarness(myPlugin, {
 *   initialState: { 'my-plugin:count': 0 }
 * });
 *
 * // Bootstrap the plugin
 * await harness.bootstrap();
 *
 * // Access services
 * harness.state.set('my-plugin:count', 42);
 * expect(harness.state.get('my-plugin:count')).toBe(42);
 *
 * // Check registered extensions
 * expect(harness.extensions.getExtensions('dashboard-widgets')).toHaveLength(1);
 *
 * // Check emitted events
 * harness.eventBus.emit('my-event', { data: 'test' });
 * expect(harness.eventBus.emittedEvents).toHaveLength(1);
 *
 * harness.destroy();
 * ```
 */
export class TestPluginHarness {
	readonly eventBus: MockEventBus;
	readonly state: PluginStateService;
	readonly extensions: PageExtensionRegistryService;
	readonly settings: PluginSettingsRegistryService;
	readonly serviceRegistry: PluginServiceRegistryService;
	readonly plugin: PluginUiDefinition;

	private _bootstrapped = false;

	constructor(plugin: PluginUiDefinition, options?: TestPluginHarnessOptions) {
		this.plugin = plugin;
		this.eventBus = options?.eventBus ?? new MockEventBus();
		this.state = new PluginStateService();
		this.extensions = new PageExtensionRegistryService();
		this.settings = new PluginSettingsRegistryService();
		this.serviceRegistry = new PluginServiceRegistryService();

		// Pre-populate state
		if (options?.initialState) {
			for (const [key, value] of Object.entries(options.initialState)) {
				this.state.set(key, value);
			}
		}
	}

	/**
	 * Bootstraps the plugin by calling its bootstrap callback (if any)
	 * and registering its extensions.
	 */
	async bootstrap(): Promise<void> {
		if (this._bootstrapped) {
			throw new Error(`Plugin '${this.plugin.id}' is already bootstrapped.`);
		}

		// Register extensions
		if (this.plugin.extensions?.length) {
			this.extensions.registerAll(this.plugin.extensions, { pluginId: this.plugin.id });
		}

		// Register settings
		if (this.plugin.settings) {
			await this.settings.register(this.plugin.id, this.plugin.settings);
		}

		// Call bootstrap
		if (this.plugin.bootstrap) {
			// Create a minimal injector-like object for the bootstrap callback.
			// In tests, we can't easily create a full Angular Injector, so we
			// provide a simple get() that returns our mock services.
			const mockInjector = this._createMockInjector();
			const result = this.plugin.bootstrap(mockInjector);
			if (result instanceof Promise) await result;
		}

		this._bootstrapped = true;
	}

	/**
	 * Cleans up the harness.
	 */
	destroy(): void {
		this.extensions.deregisterByPlugin(this.plugin.id);
		this.settings.unregister(this.plugin.id);
		this.serviceRegistry.unregisterByPlugin(this.plugin.id);
		this.state.clear();
		this.eventBus.destroy();
	}

	/**
	 * Creates a minimal mock injector that returns harness services.
	 */
	private _createMockInjector(): Injector {
		const services = new Map<any, any>([
			[PluginStateService, this.state],
			[PageExtensionRegistryService, this.extensions],
			[PluginSettingsRegistryService, this.settings],
			[PluginServiceRegistryService, this.serviceRegistry]
		]);

		return {
			get: (token: any, notFoundValue?: any) => {
				return services.get(token) ?? notFoundValue ?? null;
			}
		} as Injector;
	}
}
