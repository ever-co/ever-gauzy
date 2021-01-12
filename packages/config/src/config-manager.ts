import { deepMerge, PluginConfig } from '@gauzy/common';
import { defaultConfiguration } from './default-configuration';

let defaultConfig: PluginConfig = defaultConfiguration;

export function setConfig(config: any): void {
	defaultConfig = deepMerge(defaultConfig, config);
}

export function getConfig(): Readonly<PluginConfig> {
	return defaultConfig;
}
