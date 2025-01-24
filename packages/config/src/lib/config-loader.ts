import { ApplicationPluginConfig } from '@gauzy/common';
import { deepMerge } from '@gauzy/utils';
import { defaultConfiguration } from './default-config';

let currentAppConfig: ApplicationPluginConfig = { ...defaultConfiguration };

/**
 * Merges provided configuration with the existing default configuration.
 *
 * @param {Partial<ApplicationPluginConfig>} providedConfig - The configuration values to merge.
 * @returns {Promise<void>} - Resolves once the configuration is successfully updated.
 */
export async function defineConfig(providedConfig: Partial<ApplicationPluginConfig>): Promise<void> {
	if (!providedConfig || typeof providedConfig !== 'object') {
		throw new Error('Invalid configuration provided. Expected a non-empty object.');
	}

	currentAppConfig = await deepMerge(currentAppConfig, providedConfig);
}

/**
 * Retrieves the current application configuration.
 *
 * @returns {Readonly<ApplicationPluginConfig>} - A frozen copy of the current configuration.
 */
export function getConfig(): Readonly<ApplicationPluginConfig> {
	return Object.freeze({ ...currentAppConfig });
}

/**
 * Resets the configuration to its default values.
 */
export function resetConfig(): void {
	currentAppConfig = { ...defaultConfiguration };
	console.log('Gauzy Config Reset to Defaults');
}
