// import * as csurf from 'csurf';
import { ConflictException, INestApplication, Type } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SentryService } from '@ntegral/nestjs-sentry';
import { useContainer } from 'class-validator';
import * as expressSession from 'express-session';
import * as helmet from 'helmet';
import * as chalk from 'chalk';
import { join } from 'path';
import { urlencoded, json } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EntitySubscriberInterface } from 'typeorm';
import { IPluginConfig } from '@gauzy/common';
import { getConfig, setConfig, environment as env } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { coreEntities } from '../core/entities';
import { coreSubscribers } from './../core/entities/subscribers';
import { AppService } from '../app.service';
import { AppModule } from '../app.module';
import { AuthGuard } from './../shared/guards';
import { SharedModule } from './../shared/shared.module';

export async function bootstrap(
	pluginConfig?: Partial<IPluginConfig>
): Promise<INestApplication> {
	const config = await registerPluginConfig(pluginConfig);

	const { BootstrapModule } = await import('./bootstrap.module');
	const app = await NestFactory.create<NestExpressApplication>(BootstrapModule, {
		logger: ['log', 'error', 'warn', 'debug', 'verbose']
	});

	// This will lock all routes and make them accessible by authenticated users only.
	const reflector = app.get(Reflector);
	app.useGlobalGuards(new AuthGuard(reflector));

	app.useLogger(app.get(SentryService));
	app.use(json({ limit: '50mb' }));
	app.use(urlencoded({ extended: true, limit: '50mb' }));

	app.enableCors({
		origin: '*',
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
		credentials: true,
		allowedHeaders:
			'Authorization, Language, Tenant-Id, X-Requested-With, X-Auth-Token, X-HTTP-Method-Override, Content-Type, Content-Language, Accept, Accept-Language, Observe'
	});

	// TODO: enable csurf
	// As explained on the csurf middleware page https://github.com/expressjs/csurf#csurf,
	// the csurf module requires either a session middleware or cookie-parser to be initialized first.
	// app.use(csurf());

	app.use(
		expressSession({
			secret: env.EXPRESS_SESSION_SECRET,
			resave: true,
			saveUninitialized: true
		})
	);

	app.use(helmet());
	const globalPrefix = 'api';
	app.setGlobalPrefix(globalPrefix);

	const service = app.select(AppModule).get(AppService);
	await service.seedDBIfEmpty();

	const options = new DocumentBuilder()
		.setTitle('Gauzy API')
		.setVersion('1.0')
		.addBearerAuth()
		.build();

	const document = SwaggerModule.createDocument(app, options);
	SwaggerModule.setup('swg', app, document);

	let { port, host } = config.apiConfigOptions;
	if (!port) {
		port = 3000;
	}
	if (!host) {
		host = '0.0.0.0';
	}

	console.log(chalk.green(`Configured Host: ${host}`));
	console.log(chalk.green(`Configured Port: ${port}`));

	console.log(chalk.green(`Swagger UI available at http://${host}:${port}/swg`));

	/**
	 * Dependency injection with class-validator
	 */
	useContainer(app.select(SharedModule), { fallbackOnErrors: true });

	await app.listen(port, host, () => {
		console.log(chalk.magenta(`Listening at http://${host}:${port}/${globalPrefix}`));
		// Execute Seed For Demo Server
		if (env.demo) {
			service.executeDemoSeed();
		}
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

	/**
	 * Configure migration settings
	 */
	setConfig({
		dbConnectionOptions: {
			...getMigrationsSetting()
		}
	});

	console.log(
		chalk.green(
			`DB Config: ${JSON.stringify(getConfig().dbConnectionOptions)}`
		)
	);

	/**
	 * Registered core & plugins entities
	 */
	const entities = await registerAllEntities(pluginConfig);
	setConfig({
		dbConnectionOptions: {
			entities,
			subscribers: coreSubscribers as Array<Type<EntitySubscriberInterface>>,
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
		if (allEntities.find((e) => e.name === pluginEntity.name)) {
			throw new ConflictException({
				message: `error.${pluginEntity.name} conflict by default entities`
			});
		} else {
			allEntities.push(pluginEntity);
		}
	}
	return allEntities;
}

/**
 * GET migrations directory & CLI paths
 *
 * @returns
 */
export function getMigrationsSetting() {

	console.log(`Reporting __dirname: ${__dirname}`);

	//TODO: We need to define some dynamic path here
	return {
		migrations: [
			// join(__dirname, '../../src/database/migrations/*{.ts,.js}'),
			join(__dirname, '../database/migrations/*{.ts,.js}')
		],
		cli: {
			migrationsDir: join(__dirname, '../../src/database/migrations')
		},
	}
}