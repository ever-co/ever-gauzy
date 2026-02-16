import { PluginUiConfig } from './plugin-ui.types';

/**
 * Recursively freezes an object and its nested objects/arrays so that
 * consumers cannot mutate getPluginUiConfig().plugins or nested properties.
 * Functions and primitives are left as-is.
 */
function deepFreeze<T>(value: T): T {
	if (value === null || typeof value !== 'object') {
		return value;
	}
	if (Object.isFrozen(value)) {
		return value;
	}
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			deepFreeze(value[i]);
		}
		return Object.freeze(value) as T;
	}
	for (const key of Object.keys(value) as (keyof T)[]) {
		deepFreeze((value as Record<keyof T, unknown>)[key]);
	}
	return Object.freeze(value) as T;
}

/**
 * Module-scoped reference to the loaded UI configuration.
 * Populated by `setPluginUiConfig()` before Angular bootstrap.
 */
let _uiConfig: PluginUiConfig | undefined;

/**
 * Stores the application UI configuration.
 *
 * Deep-freezes the configuration (including plugins, availableLanguages, and
 * nested plugin entries) so that consumers cannot mutate it after bootstrap.
 *
 * Must be called before Angular bootstraps so that `getPluginUiConfig()` can be used
 * safely from any module/service/component.
 */
export function setPluginUiConfig(config: PluginUiConfig): void {
	_uiConfig = deepFreeze(config) as PluginUiConfig;
}

/**
 * Retrieves the current application UI configuration.
 *
 * @throws If called before `setPluginUiConfig()` has been invoked.
 * @returns A frozen `PluginUiConfig` object.
 */
export function getPluginUiConfig(): Readonly<PluginUiConfig> {
	if (!_uiConfig) {
		throw new Error(
			'[PluginUiConfig] Configuration not loaded. Ensure setPluginUiConfig() is called before bootstrap.'
		);
	}
	return _uiConfig;
}

/**
 * Resets the configuration to undefined. Primarily useful for testing.
 */
export function resetPluginUiConfig(): void {
	_uiConfig = undefined;
}

