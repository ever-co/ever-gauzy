import { REQUEST } from '@nestjs/core';
import { Inject, Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigurationOptions } from './configuration.interface';

@Injectable({ scope: Scope.REQUEST })
export class RequestScopedConfigProvider extends ConfigService {

    private config: ConfigurationOptions = {};

    constructor(
        @Inject(REQUEST) protected readonly request: Request
    ) {
        super();
    }

    setConfig(config: ConfigurationOptions) {
        this.config = config;
    }

    getConfig(): ConfigurationOptions {
        return this.config;
    }
}
