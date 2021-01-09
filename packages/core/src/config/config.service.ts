import { DynamicModule, Injectable, Type } from '@nestjs/common';
import { PluginConfig } from '@gauzy/common';
import { ConnectionOptions } from 'typeorm/connection/ConnectionOptions';
import { getConfig } from './config-manager';

@Injectable()
export class ConfigService {
  public config: Partial<PluginConfig>;

  constructor() {
    this.config = getConfig();
  }

  get apiConfig() {
    return this.config.apiConfig;
  }

  get graphqlConfig() {
    return this.config.apiConfig.graphqlConfig;
  }

  get dbConnectionConfig(): ConnectionOptions {
    return this.config.dbConnectionConfig;
  }

  get plugins(): Array<DynamicModule | Type<any>> {
    return this.config.plugins;
  }
}
