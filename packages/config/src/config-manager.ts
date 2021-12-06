import { deepMerge, IPluginConfig } from '@gauzy/common';
import { defaultConfiguration } from './default-configuration';

let defaultConfig: IPluginConfig = defaultConfiguration;

/**
 * Override the default config by merging in the provided values.
 * 
 */
export function setConfig(providedConfig: Partial<IPluginConfig>): void {
	defaultConfig = deepMerge(defaultConfig, providedConfig);
}


/**
 * Returns the app bootstrap config object.
 * 
 */
export function getConfig(): Readonly<IPluginConfig> {
	return defaultConfig;
}
