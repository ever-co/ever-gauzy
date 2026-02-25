import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, map } from 'rxjs';
import { UiBridge, UiBridgeFramework } from './ui-bridge.interface';

/**
 * Factory function for lazy loading a bridge.
 */
export type BridgeFactory = () => UiBridge | Promise<UiBridge>;

/**
 * Lazy bridge registration.
 */
export interface LazyBridgeRegistration {
	/** The framework ID this bridge handles */
	frameworkId: UiBridgeFramework;
	/** Factory function to create the bridge */
	factory: BridgeFactory;
	/** Whether the bridge has been loaded */
	loaded: boolean;
	/** The loaded bridge instance (if loaded) */
	bridge?: UiBridge;
	/** Loading promise (if currently loading) */
	loading?: Promise<UiBridge>;
}

/**
 * Options for registering a bridge.
 */
export interface BridgeRegistrationOptions {
	/**
	 * If true, the bridge will be loaded lazily on first use.
	 * Default: false (immediate registration)
	 */
	lazy?: boolean;
}

/**
 * Registry service for UI framework bridges.
 *
 * Manages registration and retrieval of UI bridges that enable rendering
 * non-Angular framework components (React, Vue, Svelte, etc.) inside Angular.
 *
 * Supports lazy loading for bridges that are only needed when their
 * framework components are actually used.
 *
 * @example
 * ```typescript
 * // Immediate registration
 * registry.register(new ReactBridge());
 *
 * // Lazy registration (loaded on first use)
 * registry.registerLazy('react', () => import('@gauzy/ui-react-bridge').then(m => new m.ReactBridge()));
 *
 * // Get a bridge (loads lazily if needed)
 * const bridge = await registry.getAsync('react');
 * if (bridge) {
 *   bridge.mount({ component: MyReactComponent, hostElement, injector });
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class UiBridgeRegistryService {
	private readonly _bridges = new Map<string, UiBridge>();
	private readonly _lazyBridges = new Map<string, LazyBridgeRegistration>();
	private readonly _bridges$ = new BehaviorSubject<Map<string, UiBridge>>(new Map());

	/**
	 * Observable of all registered bridges (excluding lazy unloaded).
	 */
	readonly bridges$: Observable<UiBridge[]> = this._bridges$.pipe(
		map((bridges) => Array.from(bridges.values()))
	);

	/**
	 * Register a UI framework bridge (immediate).
	 *
	 * @param bridge The bridge instance to register
	 */
	register(bridge: UiBridge): void {
		const frameworkId = bridge.config.frameworkId;
		if (this._bridges.has(frameworkId)) {
			console.warn(
				`[UiBridgeRegistry] Bridge '${frameworkId}' already registered, replacing with ${bridge.config.name} v${bridge.config.version}`
			);
		}
		this._bridges.set(frameworkId, bridge);
		this._lazyBridges.delete(frameworkId); // Remove lazy registration if exists
		this._notifyBridgeChange();
	}

	/**
	 * Register a UI framework bridge lazily.
	 * The bridge will only be created when first requested.
	 *
	 * @param frameworkId The framework identifier
	 * @param factory Factory function to create the bridge
	 */
	registerLazy(frameworkId: UiBridgeFramework, factory: BridgeFactory): void {
		if (this._bridges.has(frameworkId)) {
			console.warn(
				`[UiBridgeRegistry] Bridge '${frameworkId}' already registered immediately, lazy registration ignored`
			);
			return;
		}
		this._lazyBridges.set(frameworkId, {
			frameworkId,
			factory,
			loaded: false
		});
	}

	/**
	 * Get a bridge by framework ID (synchronous).
	 * Returns undefined for lazy bridges that haven't been loaded yet.
	 *
	 * @param frameworkId The framework identifier
	 * @returns The bridge instance, or undefined
	 */
	get(frameworkId: UiBridgeFramework): UiBridge | undefined {
		// Check immediate bridges first
		const bridge = this._bridges.get(frameworkId);
		if (bridge) return bridge;

		// Check loaded lazy bridges
		const lazy = this._lazyBridges.get(frameworkId);
		if (lazy?.loaded && lazy.bridge) {
			return lazy.bridge;
		}

		return undefined;
	}

	/**
	 * Get a bridge by framework ID (async, supports lazy loading).
	 *
	 * @param frameworkId The framework identifier
	 * @returns Promise resolving to the bridge, or undefined
	 */
	async getAsync(frameworkId: UiBridgeFramework): Promise<UiBridge | undefined> {
		// Check immediate bridges first
		const bridge = this._bridges.get(frameworkId);
		if (bridge) return bridge;

		// Check lazy bridges
		const lazy = this._lazyBridges.get(frameworkId);
		if (!lazy) return undefined;

		// Already loaded
		if (lazy.loaded && lazy.bridge) {
			return lazy.bridge;
		}

		// Currently loading
		if (lazy.loading) {
			return lazy.loading;
		}

		// Load the bridge
		return this._loadLazyBridge(lazy);
	}

	/**
	 * Preload a lazy bridge without using it.
	 *
	 * @param frameworkId The framework identifier to preload
	 */
	async preload(frameworkId: UiBridgeFramework): Promise<void> {
		await this.getAsync(frameworkId);
	}

	/**
	 * Preload all lazy bridges.
	 */
	async preloadAll(): Promise<void> {
		const lazyFrameworks = Array.from(this._lazyBridges.keys());
		await Promise.all(lazyFrameworks.map((id) => this.preload(id)));
	}

	/**
	 * Loads a lazy bridge.
	 */
	private async _loadLazyBridge(lazy: LazyBridgeRegistration): Promise<UiBridge> {
		try {
			lazy.loading = Promise.resolve(lazy.factory()).then((bridge) => {
				lazy.bridge = bridge;
				lazy.loaded = true;
				lazy.loading = undefined;
				// Also add to immediate bridges for faster subsequent access
				this._bridges.set(lazy.frameworkId, bridge);
				this._notifyBridgeChange();
				return bridge;
			});
			return await lazy.loading;
		} catch (error) {
			lazy.loading = undefined;
			console.error(`[UiBridgeRegistry] Failed to load bridge '${lazy.frameworkId}':`, error);
			throw error;
		}
	}

	/**
	 * Notifies subscribers of bridge changes.
	 */
	private _notifyBridgeChange(): void {
		this._bridges$.next(new Map(this._bridges));
	}

	/**
	 * Get all registered bridges (excludes unloaded lazy bridges).
	 */
	getAll(): UiBridge[] {
		return Array.from(this._bridges.values());
	}

	/**
	 * Check if a framework bridge is registered (immediate or lazy).
	 */
	has(frameworkId: UiBridgeFramework): boolean {
		return this._bridges.has(frameworkId) || this._lazyBridges.has(frameworkId);
	}

	/**
	 * Check if a framework bridge is loaded (not just registered lazily).
	 */
	isLoaded(frameworkId: UiBridgeFramework): boolean {
		if (this._bridges.has(frameworkId)) return true;
		const lazy = this._lazyBridges.get(frameworkId);
		return lazy?.loaded ?? false;
	}

	/**
	 * Auto-detect which bridge can handle a component.
	 * Only checks already-loaded bridges.
	 */
	detectBridge(component: unknown): UiBridge | undefined {
		for (const bridge of this._bridges.values()) {
			if (bridge.isCompatible(component)) {
				return bridge;
			}
		}
		return undefined;
	}

	/**
	 * Auto-detect which bridge can handle a component (async).
	 * Loads lazy bridges if necessary.
	 */
	async detectBridgeAsync(component: unknown): Promise<UiBridge | undefined> {
		// First check loaded bridges
		const immediate = this.detectBridge(component);
		if (immediate) return immediate;

		// Load all lazy bridges and check
		await this.preloadAll();
		return this.detectBridge(component);
	}

	/**
	 * Get a list of all registered framework IDs (immediate and lazy).
	 */
	getRegisteredFrameworks(): string[] {
		const immediate = Array.from(this._bridges.keys());
		const lazy = Array.from(this._lazyBridges.keys());
		return [...new Set([...immediate, ...lazy])];
	}

	/**
	 * Unregister a bridge by framework ID.
	 */
	unregister(frameworkId: UiBridgeFramework): boolean {
		const removed = this._bridges.delete(frameworkId);
		this._lazyBridges.delete(frameworkId);
		if (removed) {
			this._notifyBridgeChange();
		}
		return removed;
	}

	/**
	 * Clear all registered bridges.
	 */
	clear(): void {
		this._bridges.clear();
		this._lazyBridges.clear();
		this._notifyBridgeChange();
	}
}
