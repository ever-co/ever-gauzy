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
import { getConfig } from './config-loader';
import { environment } from './environments/environment';
import { IEnvironment } from './environments/ienvironment';

@Injectable()
export class ConfigService {
	private readonly environment = environment;
	private readonly logger = new Logger(ConfigService.name);
	private config: Partial<ApplicationPluginConfig>;

	constructor() {
		void this.initConfig();
	}

	/**
	 * Initializes the configuration and environment variables.
	 * Uses an async method since constructors cannot be async.
	 */
	private async initConfig(): Promise<void> {
		this.config = getConfig();

		// Assign environment variables dynamically
		Object.entries(this.environment.env).forEach(([key, value]) => {
			process.env[key] = value as string;
		});

		this.logger.log(`Is Production: ${this.environment.production}`);
	}

	/**
	 * Retrieves the entire configuration object as a read-only copy.
	 *
	 * @returns {Readonly<Partial<ApplicationPluginConfig>>} - The entire configuration object.
	 */
	public getConfig(): Readonly<Partial<ApplicationPluginConfig>> {
		return Object.freeze({ ...this.config });
	}

	/**
	 * Retrieves a specific configuration value from the application configuration.
	 *
	 * @param {keyof ApplicationPluginConfig} key - The configuration key to fetch.
	 * @returns {Readonly<ApplicationPluginConfig[keyof ApplicationPluginConfig]>} - The requested configuration value.
	 */
	public getConfigValue<K extends keyof ApplicationPluginConfig>(key: K): Readonly<ApplicationPluginConfig[K]> {
		if (!(key in this.config)) {
			throw new Error(`Configuration key "${String(key)}" not found.`);
		}
		return this.config[key] as Readonly<ApplicationPluginConfig[K]>;
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
		return this.config.apiConfigOptions?.graphqlConfigOptions;
	}

	/**
	 * Get the TypeORM connection options.
	 */
	get dbConnectionOptions(): Readonly<TypeOrmModuleOptions> {
		return this.config.dbConnectionOptions ?? {};
	}

	/**
	 * Get the MikroORM connection options.
	 */
	get dbMikroOrmConnectionOptions(): Readonly<MikroOrmModuleOptions> {
		return this.config.dbMikroOrmConnectionOptions ?? {};
	}

	/**
	 * Get the Knex connection options.
	 */
	get dbKnexConnectionOptions(): Readonly<KnexModuleOptions> {
		return this.config.dbKnexConnectionOptions;
	}

	/**
	 * Get the plugins configuration.
	 */
	get plugins(): Array<Type<any> | DynamicModule> {
		return this.config.plugins ?? [];
	}

	/**
	 * Get the asset configuration options.
	 */
	get assetOptions(): Readonly<AssetConfigurationOptions> {
		return this.config.assetOptions;
	}

	/**
	 * Get an environment variable value.
	 *
	 * @param key The environment variable key.
	 * @returns The corresponding environment value.
	 */
	get<T>(key: keyof IEnvironment): IEnvironment[keyof IEnvironment] {
		return this.environment[key] as T;
	}

	/**
	 * Check if the application is running in production mode.
	 *
	 * @returns `true` if production mode, otherwise `false`.
	 */
	isProd(): boolean {
		return this.environment.production;
	}
}
