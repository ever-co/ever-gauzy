import { Injectable } from '@angular/core';
import { UiBridge, UiBridgeFramework } from './ui-bridge.interface';

/**
 * Registry service for UI framework bridges.
 *
 * Manages registration and retrieval of UI bridges that enable rendering
 * non-Angular framework components (React, Vue, Svelte, etc.) inside Angular.
 *
 * @example
 * ```typescript
 * // Register a bridge (typically done in APP_INITIALIZER)
 * const registry = inject(UiBridgeRegistryService);
 * registry.register(new ReactBridge());
 *
 * // Check if a framework is available
 * if (registry.has('react')) {
 *   const bridge = registry.get('react');
 *   bridge.mount({ component: MyReactComponent, hostElement, injector });
 * }
 *
 * // Auto-detect bridge for a component
 * const bridge = registry.detectBridge(someComponent);
 * if (bridge) {
 *   bridge.mount({ component: someComponent, hostElement, injector });
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class UiBridgeRegistryService {
	private readonly _bridges = new Map<string, UiBridge>();

	/**
	 * Register a UI framework bridge.
	 *
	 * If a bridge with the same frameworkId is already registered,
	 * it will be replaced with a warning.
	 *
	 * @param bridge The bridge instance to register
	 */
	register(bridge: UiBridge): void {
		const frameworkId = bridge.config.frameworkId;
		if (this._bridges.has(frameworkId)) {
			console.warn(`[UiBridgeRegistry] Bridge '${frameworkId}' already registered, replacing with ${bridge.config.name} v${bridge.config.version}`);
		}
		this._bridges.set(frameworkId, bridge);
	}

	/**
	 * Get a bridge by framework ID.
	 *
	 * @param frameworkId The framework identifier (e.g., 'react', 'vue')
	 * @returns The bridge instance, or undefined if not registered
	 */
	get(frameworkId: UiBridgeFramework): UiBridge | undefined {
		return this._bridges.get(frameworkId);
	}

	/**
	 * Get all registered bridges.
	 *
	 * @returns Array of all registered bridge instances
	 */
	getAll(): UiBridge[] {
		return Array.from(this._bridges.values());
	}

	/**
	 * Check if a framework bridge is registered.
	 *
	 * @param frameworkId The framework identifier to check
	 * @returns True if a bridge is registered for this framework
	 */
	has(frameworkId: UiBridgeFramework): boolean {
		return this._bridges.has(frameworkId);
	}

	/**
	 * Auto-detect which bridge can handle a component.
	 *
	 * Iterates through registered bridges and returns the first one
	 * that reports compatibility with the component.
	 *
	 * @param component The component to check
	 * @returns The compatible bridge, or undefined if none found
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
	 * Get a list of all registered framework IDs.
	 *
	 * @returns Array of framework identifiers
	 */
	getRegisteredFrameworks(): string[] {
		return Array.from(this._bridges.keys());
	}

	/**
	 * Unregister a bridge by framework ID.
	 *
	 * @param frameworkId The framework identifier to unregister
	 * @returns True if a bridge was removed, false if none was registered
	 */
	unregister(frameworkId: UiBridgeFramework): boolean {
		return this._bridges.delete(frameworkId);
	}

	/**
	 * Clear all registered bridges.
	 */
	clear(): void {
		this._bridges.clear();
	}
}
