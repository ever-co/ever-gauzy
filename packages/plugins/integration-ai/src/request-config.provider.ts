import { Inject, Injectable, Scope } from '@nestjs/common';
import { ConfigurationOptions } from './configuration.interface';

@Injectable({ scope: Scope.REQUEST })
export class RequestConfigProvider {

    private config: ConfigurationOptions = {};

    constructor(
        @Inject('CONFIG_OPTIONS')
        protected readonly options: ConfigurationOptions
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
