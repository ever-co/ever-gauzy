import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationOptions } from './configuration.interface';
import { GAUZY_AI_CONFIG_OPTIONS } from './constants';

@Injectable()
export class RequestConfigProvider {
	private defaultConfig: IConfigurationOptions = new Object();
	private config: IConfigurationOptions = new Object();

	constructor(
		@Inject(GAUZY_AI_CONFIG_OPTIONS)
		protected readonly options: IConfigurationOptions
	) {
		this.setDefaultConfig(options);
		this.resetConfig();
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
		this.config = { ...this.defaultConfig };
	}

	/**
	 * Set the configuration options.
	 * @param config - The configuration options to set.
	 */
	setConfig(config: IConfigurationOptions) {
		this.config = { ...this.defaultConfig, ...config };
	}

	/**
	 * Get the current configuration options.
	 * @returns The current configuration options.
	 */
	getConfig(): IConfigurationOptions {
		return this.config;
	}
}
