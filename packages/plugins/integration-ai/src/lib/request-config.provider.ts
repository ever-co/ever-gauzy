import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import { GAUZY_AI_CONFIG_TOKEN } from '@gauzy/constants';
import { IConfigurationOptions } from './configuration.interface';

@Injectable()
export class RequestConfigProvider {
	private defaultConfig: IConfigurationOptions = new Object();
	// One provider serves concurrent requests, so each request keeps its own keys in its async context.
	private readonly storage = new AsyncLocalStorage<IConfigurationOptions>();

	constructor(
		@Inject(GAUZY_AI_CONFIG_TOKEN)
		protected readonly options: IConfigurationOptions
	) {
		this.setDefaultConfig(options);
	}

	/**
	 * Set the default configuration options.
	 * @param defaultConfig - The default configuration options to set.
	 */
	setDefaultConfig(defaultConfig: IConfigurationOptions) {
		this.defaultConfig = defaultConfig;
	}

	/**
	 * Reset the configuration options to the default values.
	 */
	resetConfig() {
		this.storage.enterWith({ ...this.defaultConfig });
	}

	/**
	 * Set the configuration options.
	 * @param config - The configuration options to set.
	 */
	setConfig(config: IConfigurationOptions) {
		this.storage.enterWith({ ...this.defaultConfig, ...config });
	}

	/**
	 * Get the current configuration options.
	 * @returns The current configuration options.
	 */
	getConfig(): IConfigurationOptions {
		return this.storage.getStore() ?? this.defaultConfig;
	}
}
