import { useMemo } from 'react';
import { PluginSettingsRegistryService } from '@gauzy/plugin-ui';
import { useInjector } from './use-injector';
import { useObservable } from './use-observable';

/**
 * React hook for reading plugin settings.
 *
 * Returns the current settings values for a plugin, updated reactively
 * when settings change.
 *
 * @param pluginId The plugin ID to read settings for.
 * @returns The current settings values as a key-value record.
 *
 * @example
 * ```tsx
 * function TimeTrackerSettings() {
 *   const settings = usePluginSettings('time-tracker');
 *   const autoStart = settings['autoStart'] as boolean ?? false;
 *   const interval = settings['interval'] as number ?? 10;
 *
 *   return (
 *     <div>
 *       <p>Auto-start: {autoStart ? 'Yes' : 'No'}</p>
 *       <p>Interval: {interval}s</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePluginSettings(pluginId: string): Record<string, unknown> {
	const settingsRegistry = useInjector(PluginSettingsRegistryService);
	const values$ = useMemo(() => settingsRegistry.getValues$(pluginId), [settingsRegistry, pluginId]);
	return useObservable(values$, {}) ?? {};
}

/**
 * React hook for reading a single plugin setting value.
 *
 * @param pluginId The plugin ID.
 * @param key The setting key.
 * @param defaultValue Fallback value when the setting is not defined.
 * @returns The current setting value.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const autoStart = usePluginSetting<boolean>('time-tracker', 'autoStart', false);
 *   return <span>{autoStart ? 'Enabled' : 'Disabled'}</span>;
 * }
 * ```
 */
export function usePluginSetting<T>(pluginId: string, key: string, defaultValue: T): T;
export function usePluginSetting<T>(pluginId: string, key: string): T | undefined;
export function usePluginSetting<T>(pluginId: string, key: string, defaultValue?: T): T | undefined {
	const settingsRegistry = useInjector(PluginSettingsRegistryService);
	const value$ = useMemo(() => settingsRegistry.getValue$<T>(pluginId, key), [settingsRegistry, pluginId, key]);
	return useObservable(value$, defaultValue) ?? defaultValue;
}
