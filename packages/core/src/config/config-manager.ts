import { deepMergeObject } from '@gauzy/common';
import { defaultConfiguration } from './default-configuration';

let defaultConfig = defaultConfiguration;

export function setConfig(config: any): void {
  defaultConfig = deepMergeObject(defaultConfig, config);
}

export function getConfig(): Readonly<any> {
  return defaultConfig;
}
