import { AppUIConfig } from './ui-plugin.types';

/**
 * Module-scoped reference to the loaded UI configuration.
 * Populated by `setAppUIConfig()` before Angular bootstrap.
 */
let _uiConfig: AppUIConfig | undefined;

/**
 * Stores the application UI configuration.
 *
 * Freezes the configuration object to prevent accidental mutation
 * after bootstrap.
 *
 * Must be called **before** `platformBrowser().bootstrapModule()` so that
 * `UIPluginModule` and any other consumer can safely call `getAppUIConfig()`.
 *
 * @param config The validated application UI configuration.
 */
export function setAppUIConfig(config: AppUIConfig): void {
	_uiConfig = Object.freeze(config) as AppUIConfig;
}

/**
 * Retrieves the current application UI configuration.
 *
 * Safe to call from any Angular module constructor, service, or
 * component — as long as `setAppUIConfig()` was called in `main.ts`
 * before Angular bootstraps.
 *
 * @throws If called before `setAppUIConfig()` has been invoked.
 * @returns A frozen `AppUIConfig` object.
 */
export function getAppUIConfig(): Readonly<AppUIConfig> {
	if (!_uiConfig) {
		throw new Error(
			'[AppUIConfig] Configuration not loaded. Ensure setAppUIConfig() is called before bootstrap.'
		);
	}
	return _uiConfig;
}

/**
 * Resets the configuration to undefined.
 * Primarily useful for testing.
 */
export function resetAppUIConfig(): void {
	_uiConfig = undefined;
}
