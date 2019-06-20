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
    console.log('is prod? ', environment.production);
  }

  get(key: keyof IEnvironment): IEnvironment[keyof IEnvironment] {
    return this.config[key];
  }

  getVersion(): string {
    if (!process.env.APP_VERSION) {
      process.env.APP_VERSION = packageJson.version;
    }
    return process.env.APP_VERSION;
  }

  isProd(): boolean {
    return this.config.production;
  }
}
