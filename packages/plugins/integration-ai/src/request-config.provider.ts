import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationOptions } from './configuration.interface';
import { GAUZY_AI_CONFIG_OPTIONS } from './constants';

@Injectable()
export class RequestConfigProvider {

    private config: IConfigurationOptions = new Object();

    constructor(
        @Inject(GAUZY_AI_CONFIG_OPTIONS)
        protected readonly options: IConfigurationOptions
    ) {
        this.setConfig(options);
    }

    /**
     * Set the configuration options.
     * @param config - The configuration options to set.
     */
    setConfig(config: IConfigurationOptions) {
        this.config = config;
    }


    /**
     * Get the current configuration options.
     * @returns The current configuration options.
     */
    getConfig(): IConfigurationOptions {
        return this.config;
    }
}
