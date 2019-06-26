// Modified code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Injectable, Logger } from '@nestjs/common';
import { environment } from '@env-api/environment';
import { IEnvironment } from '../../environments/ienvironment';

// tslint:disable-next-line
const packageJson = require('../../../../../package.json');

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly config = environment;

  constructor() {
    for (const [key, value] of Object.entries(environment.env)) {
      process.env[key] = value;
    }
    
    this.logger.log('Is Production: ' + environment.production);

    if (packageJson) {
      this.logger.log('Package.json version: ' + packageJson.version)
    }
  }

  get(key: keyof IEnvironment): IEnvironment[keyof IEnvironment] {
    return this.config[key];
  }

  getVersion(): string {
    if (!process.env.APP_VERSION) {
      if (packageJson && packageJson.version) {
        process.env.APP_VERSION = packageJson.version;
      }
    }
    
    return process.env.APP_VERSION;
  }

  isProd(): boolean {
    return this.config.production;
  }
}
