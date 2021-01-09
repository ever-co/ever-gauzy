import { INestApplication, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PluginConfig } from '@gauzy/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getConfig, setConfig } from '../config/config-manager';
import { coreEntities } from '../entities';
import { Logger } from '../logger/logger';
import { getEntitiesFromPlugins } from '../plugin/plugin-helper';

export async function bootstrap(pluginConfig?: Partial<PluginConfig>): Promise<INestApplication> {
  const config = await registerPluginConfig(pluginConfig);

  Logger.setLogger(config.logger);
  Logger.info(`Bootstrapping Server (pid: ${process.pid})...`);

  const bootstrapModule = await import('./bootstrap.module');
  const [classname] = Object.keys(bootstrapModule);

  const { hostname, port } = config.apiConfig;
  const app = await NestFactory.create<NestExpressApplication>(bootstrapModule[classname], {
    logger: new Logger(),
  });

  app.useLogger(app.get(Logger));

  await app.listen(port || 3000, hostname, () => {
    console.log(`Listening at http://${hostname}:${port}`);
  });
  return app;
}

/**
 * Setting the global config must be done prior to loading the Bootstrap Module.
 */
export async function registerPluginConfig(pluginConfig: Partial<PluginConfig>) {
  if (Object.keys(pluginConfig).length > 0) {
    setConfig(pluginConfig);
  }

  const entities = await registerAllEntities(pluginConfig);
  setConfig({
    dbConnectionConfig: {
      entities,
    },
  });

  let registeredConfig = getConfig();
  return registeredConfig;
}

/**
 * Returns an array of core entities and any additional entities defined in plugins.
 */
export async function registerAllEntities(pluginConfig: Partial<PluginConfig>) {
  const allEntities = coreEntities as Array<Type<any>>;
  const pluginEntities = getEntitiesFromPlugins(pluginConfig.plugins);

  for (const pluginEntity of pluginEntities) {
    allEntities.push(pluginEntity);
  }
  return allEntities;
}
