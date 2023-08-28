import { Inject, Injectable } from '@nestjs/common';
import { ConfigurationOptions } from './configuration.interface';
import { GAUZY_AI_CONFIG_OPTIONS } from './constants';

@Injectable()
export class RequestConfigProvider {

    private config: ConfigurationOptions = {};

    constructor(
        @Inject(GAUZY_AI_CONFIG_OPTIONS)
        private readonly options: ConfigurationOptions
    ) {
        this.setConfig(options);
    }

    setConfig(config: ConfigurationOptions) {
        this.config = config;
    }

    getConfig(): ConfigurationOptions {
        return this.config;
    }
}
