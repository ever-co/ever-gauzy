import { useState, useCallback, useMemo } from 'react';
import { of } from 'rxjs';
import { DynamicPluginLoaderService, type PluginUiDefinition, type DynamicPluginLoadResult } from '@gauzy/plugin-ui';
import { useInjector } from './use-injector';
import { useObservable } from './use-observable';

/**
 * React hook for dynamically loading and unloading plugins.
 *
 * Provides imperative `load` / `unload` / `reload` functions and
 * reactive state for tracking which plugins are currently loaded.
 *
 * @example
 * ```tsx
 * function PluginManager() {
 *   const { loadedIds, load, unload, reload, loading, lastResult } = useDynamicPlugin();
 *
 *   const handleInstall = async () => {
 *     const result = await load({
 *       id: 'analytics',
 *       bootstrap: (injector) => { ... }
 *     });
 *     if (!result.success) alert(result.error);
 *   };
 *
 *   return (
 *     <div>
 *       <h3>Active Plugins: {loadedIds.join(', ')}</h3>
 *       <button onClick={handleInstall} disabled={loading}>Install Analytics</button>
 *       <button onClick={() => unload('analytics')}>Remove Analytics</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDynamicPlugin() {
	const injector = useInjector();
	const [loading, setLoading] = useState(false);
	const [lastResult, setLastResult] = useState<DynamicPluginLoadResult | null>(null);

	// Resolve the DynamicPluginLoaderService from the Angular injector
	const loader = useMemo(() => {
		try {
			return injector.get(DynamicPluginLoaderService) as DynamicPluginLoaderService | null;
		} catch {
			return null;
		}
	}, [injector]);

	// Observe loaded plugin IDs reactively
	const fallback$ = useMemo(() => of([] as string[]), []);
	const loadedIds = useObservable<string[]>(loader?.loadedPluginIds$ ?? fallback$, loader?.loadedPluginIds ?? []);

	const load = useCallback(
		async (definition: PluginUiDefinition): Promise<DynamicPluginLoadResult> => {
			if (!loader) {
				const result: DynamicPluginLoadResult = {
					success: false,
					pluginId: definition.id,
					error: 'DynamicPluginLoaderService not available.'
				};
				setLastResult(result);
				return result;
			}

			setLoading(true);
			try {
				const result = await loader.loadPlugin(definition);
				setLastResult(result);
				return result;
			} finally {
				setLoading(false);
			}
		},
		[loader]
	);

	const unload = useCallback(
		async (pluginId: string): Promise<DynamicPluginLoadResult> => {
			if (!loader) {
				const result: DynamicPluginLoadResult = {
					success: false,
					pluginId,
					error: 'DynamicPluginLoaderService not available.'
				};
				setLastResult(result);
				return result;
			}

			setLoading(true);
			try {
				const result = await loader.unloadPlugin(pluginId);
				setLastResult(result);
				return result;
			} finally {
				setLoading(false);
			}
		},
		[loader]
	);

	const reload = useCallback(
		async (definition: PluginUiDefinition): Promise<DynamicPluginLoadResult> => {
			if (!loader) {
				const result: DynamicPluginLoadResult = {
					success: false,
					pluginId: definition.id,
					error: 'DynamicPluginLoaderService not available.'
				};
				setLastResult(result);
				return result;
			}

			setLoading(true);
			try {
				const result = await loader.reloadPlugin(definition);
				setLastResult(result);
				return result;
			} finally {
				setLoading(false);
			}
		},
		[loader]
	);

	const isLoaded = useCallback(
		(pluginId: string): boolean => {
			return loader?.isLoaded(pluginId) ?? false;
		},
		[loader]
	);

	return {
		/** Currently loaded plugin IDs (reactive). */
		loadedIds,
		/** Load a plugin definition at runtime. */
		load,
		/** Unload a plugin by ID. */
		unload,
		/** Reload a plugin (unload + load). */
		reload,
		/** Check if a plugin is loaded. */
		isLoaded,
		/** Whether a load/unload operation is in progress. */
		loading,
		/** Result of the last load/unload operation. */
		lastResult
	};
}
