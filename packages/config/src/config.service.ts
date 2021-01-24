import { DynamicModule, Injectable, Type } from '@nestjs/common';
import { IPluginConfig } from '@gauzy/common';
import { ConnectionOptions } from 'typeorm/connection/ConnectionOptions';
import { getConfig } from './config-manager';

@Injectable()
export class ConfigService {
	public config: Partial<IPluginConfig>;

	constructor() {
		this.config = getConfig();
	}

	get apiConfigOptions() {
		return this.config.apiConfigOptions;
	}

	get graphqlConfigOptions() {
		return this.config.apiConfigOptions.graphqlConfigOptions;
	}

	get dbConnectionOptions(): ConnectionOptions {
		return this.config.dbConnectionOptions;
	}

	get plugins(): Array<DynamicModule | Type<any>> {
		return this.config.plugins;
	}
}
