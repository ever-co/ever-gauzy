import { DynamicModule, Injectable, Type, Logger } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { KnexModuleOptions } from 'nest-knexjs';
import {
	ApplicationPluginConfig,
	ApiServerConfigurationOptions,
	AssetConfigurationOptions,
	GraphqlConfigurationOptions
} from '@gauzy/common';
import { getConfig } from './config-manager';
import { environment } from './environments/environment';
import { IEnvironment } from './environments/ienvironment';

@Injectable()
export class ConfigService {
	public readonly config: Partial<ApplicationPluginConfig>;
	private readonly environment = environment;
	private readonly logger = new Logger(ConfigService.name);

	constructor() {
		this.config = getConfig();

		for (const [key, value] of Object.entries(environment.env)) {
			process.env[key] = value;
		}

		this.logger.log(`Is Production: ${environment.production}`);
	}

	/**
	 * Get the API server configuration options.
	 */
	get apiConfigOptions(): Readonly<ApiServerConfigurationOptions> {
		return this.config.apiConfigOptions;
	}

	/**
	 * Get the GraphQL configuration options.
	 */
	get graphqlConfigOptions(): Readonly<GraphqlConfigurationOptions> {
		return this.config.apiConfigOptions.graphqlConfigOptions;
	}

	/**
	 * Get the TypeORM connection options.
	 */
	get dbConnectionOptions(): Readonly<TypeOrmModuleOptions> {
		return this.config.dbConnectionOptions;
	}

	/**
	 * Get the MikroORM connection options.
	 */
	get dbMikroOrmConnectionOptions(): Readonly<MikroOrmModuleOptions> {
		return this.config.dbMikroOrmConnectionOptions;
	}

	/**
	 * Get the MikroORM connection options.
	 */
	get dbKnexConnectionOptions(): Readonly<KnexModuleOptions> {
		return this.config.dbKnexConnectionOptions;
	}

	/**
	 * Get the plugins configuration.
	 */
	get plugins(): Array<Type<any> | DynamicModule> {
		return this.config.plugins || [];
	}

	/**
	 * Get the asset configuration options.
	 */
	get assetOptions(): Readonly<AssetConfigurationOptions> {
		return this.config.assetOptions;
	}

	/**
	 * Get the environment variable value.
	 *
	 * @param key
	 * @returns
	 */
	get<T>(key: keyof IEnvironment): IEnvironment[keyof IEnvironment] {
		return this.environment[key] as T;
	}

	/**
	 * Check if the application is running in production mode.
	 *
	 * @returns
	 */
	isProd(): boolean {
		return this.environment.production;
	}
}
