import { PluginUiConfig } from './plugin-ui.types';

/**
 * Module-scoped reference to the loaded UI configuration.
 * Populated by `setPluginUiConfig()` before Angular bootstrap.
 */
let _uiConfig: PluginUiConfig | undefined;

/**
 * Stores the application UI configuration.
 *
 * Freezes the configuration object to prevent accidental mutation after bootstrap.
 *
 * Must be called before Angular bootstraps so that `getPluginUiConfig()` can be used
 * safely from any module/service/component.
 */
export function setPluginUiConfig(config: PluginUiConfig): void {
	_uiConfig = Object.freeze(config) as PluginUiConfig;
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

