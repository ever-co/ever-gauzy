import { inject, Injectable } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import { getPluginUiConfig } from './plugin-ui.loader';
import { flattenPlugins, type PluginUiDefinition } from './plugin-ui.types';
import { PluginUiRegistryService } from './plugin-ui-registry.service';
import { PageExtensionRegistryService } from './plugin-extension/page-extension-registry.service';
import { PluginStateService } from './plugin-host/plugin-state.service';
import { PluginServiceRegistryService } from './plugin-host/plugin-service-registry.service';
import { PluginSettingsRegistryService } from './plugin-host/plugin-settings-registry.service';
import { DynamicPluginLoaderService } from './plugin-host/dynamic-plugin-loader.service';
import { PluginHealthService, type PluginHealthSnapshot } from './plugin-health.service';

// ─── DevTools Snapshot ──────────────────────────────────────────────────────

/**
 * Per-plugin debug info.
 */
export interface PluginDebugInfo {
	id: string;
	definition: PluginUiDefinition;
	/** Whether the plugin has a module class. */
	hasModule: boolean;
	/** Whether the plugin is declarative (bootstrap only). */
	isDeclarative: boolean;
	/** Extensions registered by this plugin. */
	extensionCount: number;
	/** Whether settings are registered. */
	hasSettings: boolean;
	/** Cross-plugin services provided by this plugin. */
	serviceContracts: string[];
	/** Dependencies declared via dependsOn. */
	dependencies: string[];
	/** Whether this plugin was dynamically loaded. */
	isDynamic: boolean;
}

/**
 * Full debug snapshot from the DevTools service.
 */
export interface DevToolsSnapshot {
	/** All registered plugin definitions (flattened). */
	plugins: PluginDebugInfo[];
	/** Health monitoring snapshot. */
	health: PluginHealthSnapshot;
	/** All registered extension slot IDs with their extension counts. */
	extensionSlots: Array<{ slotId: string; extensionCount: number }>;
	/** All registered cross-plugin service contract IDs. */
	serviceContracts: string[];
	/** All registered plugin settings plugin IDs. */
	settingsPluginIds: string[];
	/** All state keys currently in PluginStateService. */
	stateKeys: string[];
	/** Count of live plugin instances. */
	registrySize: number;
	/** Dynamically loaded plugin IDs. */
	dynamicPluginIds: string[];
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * Plugin DevTools / Debug Service.
 *
 * Aggregates data from all plugin subsystems for introspection.
 * Use for building debug panels, logging, or automated health checks.
 *
 * Dev-only — guard behind `isDevMode()` in production builds to
 * ensure tree-shaking removes it when unused.
 *
 * @example
 * ```ts
 * const devtools = inject(PluginDevToolsService);
 *
 * // Snapshot
 * const snap = devtools.getSnapshot();
 * console.table(snap.plugins);
 *
 * // Reactive
 * devtools.snapshot$.subscribe(snap => {
 *   console.log(`${snap.plugins.length} plugins, ${snap.health.healthy} healthy`);
 * });
 *
 * // Expose for browser console debugging
 * (window as any).__pluginDevtools = devtools;
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PluginDevToolsService {
	private readonly _registry = inject(PluginUiRegistryService);
	private readonly _extRegistry = inject(PageExtensionRegistryService);
	private readonly _stateService = inject(PluginStateService);
	private readonly _serviceRegistry = inject(PluginServiceRegistryService);
	private readonly _settingsRegistry = inject(PluginSettingsRegistryService);
	private readonly _dynamicLoader = inject(DynamicPluginLoaderService);
	private readonly _health = inject(PluginHealthService);

	// ─── Snapshot ───────────────────────────────────────────────

	/**
	 * Returns a point-in-time snapshot of the entire plugin system.
	 */
	getSnapshot(): DevToolsSnapshot {
		let allDefs: PluginUiDefinition[] = [];
		try {
			const config = getPluginUiConfig();
			allDefs = flattenPlugins(config.plugins);
		} catch {
			// Config not loaded yet — use empty
		}

		const dynamicIds = new Set(this._dynamicLoader.loadedPluginIds);

		const plugins: PluginDebugInfo[] = allDefs.map((def) => ({
			id: def.id,
			definition: def,
			hasModule: !!def.module || !!def.loadModule,
			isDeclarative: !!def.bootstrap && !def.module && !def.loadModule,
			extensionCount: def.extensions?.length ?? 0,
			hasSettings: this._settingsRegistry.has(def.id),
			serviceContracts: this._serviceRegistry.getByPlugin(def.id).map((r) => r.contractId),
			dependencies: def.dependsOn ?? [],
			isDynamic: dynamicIds.has(def.id)
		}));

		// Add dynamically loaded plugins not in the static config
		for (const dynId of dynamicIds) {
			if (!plugins.some((p) => p.id === dynId)) {
				plugins.push({
					id: dynId,
					definition: { id: dynId },
					hasModule: false,
					isDeclarative: true,
					extensionCount: 0,
					hasSettings: this._settingsRegistry.has(dynId),
					serviceContracts: this._serviceRegistry.getByPlugin(dynId).map((r) => r.contractId),
					dependencies: [],
					isDynamic: true
				});
			}
		}

		return {
			plugins,
			health: this._health.getSnapshot(),
			extensionSlots: this._getExtensionSlotSummary(),
			serviceContracts: this._serviceRegistry.getContractIds(),
			settingsPluginIds: this._settingsRegistry.getPluginIds(),
			stateKeys: this._stateService.keys(),
			registrySize: this._registry.size,
			dynamicPluginIds: this._dynamicLoader.loadedPluginIds
		};
	}

	/**
	 * Observable snapshot that updates when any subsystem changes.
	 */
	get snapshot$(): Observable<DevToolsSnapshot> {
		return combineLatest([
			this._extRegistry.slots$,
			this._serviceRegistry.all$,
			this._settingsRegistry.all$,
			this._dynamicLoader.loadedPluginIds$,
			this._health.snapshot$
		]).pipe(map(() => this.getSnapshot()));
	}

	// ─── Utilities ──────────────────────────────────────────────

	/**
	 * Logs a formatted summary to the console.
	 */
	logSummary(): void {
		const snap = this.getSnapshot();
		console.group('[PluginDevTools] Summary');
		console.log(`Plugins: ${snap.plugins.length} (${snap.dynamicPluginIds.length} dynamic)`);
		console.log(
			`Health: ${snap.health.healthy} healthy, ${snap.health.degraded} degraded, ${snap.health.errored} errored`
		);
		console.log(`Total boot time: ${snap.health.totalBootTimeMs}ms`);
		console.log(`Extension slots: ${snap.extensionSlots.length}`);
		console.log(`Cross-plugin services: ${snap.serviceContracts.length}`);
		console.log(`Settings: ${snap.settingsPluginIds.length} plugins`);
		console.log(`State keys: ${snap.stateKeys.length}`);
		console.table(
			snap.plugins.map((p) => ({
				id: p.id,
				type: p.isDeclarative ? 'declarative' : 'module',
				extensions: p.extensionCount,
				settings: p.hasSettings,
				services: p.serviceContracts.length,
				dynamic: p.isDynamic,
				health: this._health.getStatus(p.id)?.state ?? 'unknown',
				bootMs: this._health.getStatus(p.id)?.bootTimeMs ?? '-'
			}))
		);
		console.groupEnd();
	}

	/**
	 * Returns the dependency graph as adjacency list (pluginId → dependsOn[]).
	 */
	getDependencyGraph(): Map<string, string[]> {
		const snap = this.getSnapshot();
		const graph = new Map<string, string[]>();
		for (const p of snap.plugins) {
			graph.set(p.id, p.dependencies);
		}
		return graph;
	}

	/**
	 * Returns plugin IDs that nothing depends on (leaf plugins).
	 */
	getLeafPlugins(): string[] {
		const graph = this.getDependencyGraph();
		const depTargets = new Set<string>();
		for (const deps of graph.values()) {
			for (const dep of deps) depTargets.add(dep);
		}
		return Array.from(graph.keys()).filter((id) => !depTargets.has(id));
	}

	/**
	 * Returns plugin IDs that other plugins depend on (root/core plugins).
	 */
	getRootPlugins(): string[] {
		const graph = this.getDependencyGraph();
		const depTargets = new Set<string>();
		for (const deps of graph.values()) {
			for (const dep of deps) depTargets.add(dep);
		}
		return Array.from(depTargets);
	}

	// ─── Private ────────────────────────────────────────────────

	private _getExtensionSlotSummary(): Array<{ slotId: string; extensionCount: number }> {
		const result: Array<{ slotId: string; extensionCount: number }> = [];
		// Collect all known slot IDs from extension definitions
		try {
			const config = getPluginUiConfig();
			const allDefs = flattenPlugins(config.plugins);
			const slotIds = new Set<string>();
			for (const def of allDefs) {
				if (def.extensions) {
					for (const ext of def.extensions) {
						slotIds.add(ext.slotId);
					}
				}
			}
			for (const slotId of slotIds) {
				result.push({ slotId, extensionCount: this._extRegistry.getExtensions(slotId).length });
			}
		} catch {
			// Config not loaded
		}
		return result;
	}
}
