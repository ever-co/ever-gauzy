import { INestApplication, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IPluginConfig } from '@gauzy/common';
import { getConfig, setConfig } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { coreEntities } from '../app/core/entities';
// import { Logger } from '../logger/logger';

export async function bootstrap(
	pluginConfig?: Partial<IPluginConfig>
): Promise<INestApplication> {
	const config = await registerPluginConfig(pluginConfig);

	// Logger.setLogger(config.logger);
	// Logger.info(`Bootstrapping Server (pid: ${process.pid})...`);

	const bootstrapModule = await import('./bootstrap.module');
	const [classname] = Object.keys(bootstrapModule);

	const { hostname, port } = config.apiConfigOptions;
	const app = await NestFactory.create<NestExpressApplication>(
		bootstrapModule[classname]
	);

	await app.listen(port || 3000, hostname, () => {
		console.log(`Listening at http://${hostname}:${port}`);
	});
	return app;
}

/**
 * Setting the global config must be done prior to loading the Bootstrap Module.
 */
export async function registerPluginConfig(
	pluginConfig: Partial<IPluginConfig>
) {
	if (Object.keys(pluginConfig).length > 0) {
		setConfig(pluginConfig);
	}

	const entities = await registerAllEntities(pluginConfig);
	setConfig({
		dbConnectionOptions: {
			entities
		}
	});

	let registeredConfig = getConfig();
	return registeredConfig;
}

/**
 * Returns an array of core entities and any additional entities defined in plugins.
 */
export async function registerAllEntities(
	pluginConfig: Partial<IPluginConfig>
) {
	const allEntities = coreEntities as Array<Type<any>>;
	const pluginEntities = getEntitiesFromPlugins(pluginConfig.plugins);

	for (const pluginEntity of pluginEntities) {
		allEntities.push(pluginEntity);
	}
	return allEntities;
}
