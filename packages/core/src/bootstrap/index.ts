// import * as csurf from 'csurf';
import tracer from './tracer';
import { ConflictException, INestApplication, Type } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SentryService } from '@ntegral/nestjs-sentry';
import * as Sentry from '@sentry/node';
import { useContainer } from 'class-validator';
import * as expressSession from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
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

export async function bootstrap(pluginConfig?: Partial<IPluginConfig>): Promise<INestApplication> {
	if (process.env.OTEL_ENABLED === 'true') {
		// Start tracing using Signoz first
		await tracer.start();
		console.log('OTEL/Signoz Tracing started');
	} else {
		console.log('OTEL/Signoz Tracing not enabled');
	}

	const config = await registerPluginConfig(pluginConfig);

	const { BootstrapModule } = await import('./bootstrap.module');

	const app = await NestFactory.create<NestExpressApplication>(BootstrapModule, {
		logger: ['log', 'error', 'warn', 'debug', 'verbose']
	});

	// Enable Express behind proxies (https://expressjs.com/en/guide/behind-proxies.html)
	app.set('trust proxy', true);

	// Starts listening for shutdown hooks
	app.enableShutdownHooks();

	// This will lock all routes and make them accessible by authenticated users only.
	const reflector = app.get(Reflector);
	app.useGlobalGuards(new AuthGuard(reflector));

	// Assuming `env` contains the environment configuration, including Sentry DSN
	const { sentry } = env;

	// Initialize Sentry if the DSN is available
	if (sentry && sentry.dsn) {
		// Attach the Sentry logger to the app
		app.useLogger(app.get(SentryService));

		// NOTE: possible below is not needed because already included inside SentryService constructor

		process.on('uncaughtException', (error) => {
			console.error('Uncaught Exception:', error);
			Sentry.captureException(error);
			Sentry.flush(2000).then(() => {
				process.exit(1);
			});
		});

		process.on('unhandledRejection', (reason, promise) => {
			console.error('Unhandled Rejection at:', promise, 'reason:', reason);
			Sentry.captureException(reason);
		});
	} else {
		process.on('uncaughtException', (error) => {
			console.error('Uncaught Exception:', error);
			process.exit(1);
		});

		process.on('unhandledRejection', (reason, promise) => {
			console.error('Unhandled Rejection at:', promise, 'reason:', reason);
		});
	}

	app.use(json({ limit: '50mb' }));
	app.use(urlencoded({ extended: true, limit: '50mb' }));

	app.enableCors({
		origin: '*',
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
		credentials: true,
		allowedHeaders:
			'Authorization, Language, Tenant-Id, Organization-Id, X-Requested-With, X-Auth-Token, X-HTTP-Method-Override, Content-Type, Content-Language, Accept, Accept-Language, Observe'
	});

	// TODO: enable csurf is not good idea because it was deprecated.
	// Maybe review https://github.com/Psifi-Solutions/csrf-csrf as alternative?
	// As explained on the csurf middleware page https://github.com/expressjs/csurf#csurf,
	// the csurf module requires either a session middleware or cookie-parser to be initialized first.
	// app.use(csurf());

	// We use sessions for Passport Auth
	// For production we use RedisStore
	// https://github.com/tj/connect-redis

	let redisWorked = false;

	console.log('REDIS_ENABLED: ', process.env.REDIS_ENABLED);

	if (process.env.REDIS_ENABLED === 'true') {
		try {
			const redisClient = await createClient({
				url: process.env.REDIS_URL
			})
				.on('error', (err) => {
					console.log('Redis Client Error: ', err);
				})
				.on('connect', () => {
					console.log('Redis Client Connected');
				})
				.on('ready', () => {
					console.log('Redis Client Ready');
				})
				.on('reconnecting', () => {
					console.log('Redis Client Reconnecting');
				})
				.on('end', () => {
					console.log('Redis Client End');
				});

			// connecting to Redis
			await redisClient.connect();

			// ping Redis
			const res = await redisClient.ping();
			console.log('Redis Client ping: ', res);

			const redisStore = new RedisStore({
				client: redisClient,
				prefix: env.production ? 'gauzyprodsess:' : 'gauzydevsess:'
			});

			app.use(
				expressSession({
					store: redisStore,
					secret: env.EXPRESS_SESSION_SECRET,
					resave: false, // required: force lightweight session keep alive (touch)
					saveUninitialized: true
					// cookie: { secure: true } // TODO
				})
			);

			redisWorked = true;
		} catch (error) {
			console.log(error);
		}
	}

	if (!redisWorked) {
		app.use(
			// this runs in memory, so we lose sessions on restart of server/pod
			expressSession({
				secret: env.EXPRESS_SESSION_SECRET,
				resave: true, // we use this because Memory store does not support 'touch' method
				saveUninitialized: true
				// cookie: { secure: true } // TODO
			})
		);
	}

	app.use(helmet());
	const globalPrefix = 'api';
	app.setGlobalPrefix(globalPrefix);

	const service = app.select(AppModule).get(AppService);
	await service.seedDBIfEmpty();

	const options = new DocumentBuilder().setTitle('Gauzy API').setVersion('1.0').addBearerAuth().build();

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

	// Configure Atlassian Connect Express
	// const addon = ac(express());
	// app.use(addon.middleware());

	await app.listen(port, host, () => {
		const message = `Listening at http://${host}:${port}/${globalPrefix}`;
		console.log(chalk.magenta(message));
		// Send message to parent process (desktop app)
		if (process.send) {
			process.send(message);
		}
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
export async function registerPluginConfig(pluginConfig: Partial<IPluginConfig>) {
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

	console.log(chalk.green(`DB Config: ${JSON.stringify(getConfig().dbConnectionOptions)}`));

	/**
	 * Registered core & plugins entities
	 */
	const entities = await registerAllEntities(pluginConfig);
	setConfig({
		dbConnectionOptions: {
			entities,
			subscribers: coreSubscribers as Array<Type<EntitySubscriberInterface>>
		}
	});

	const registeredConfig = getConfig();
	return registeredConfig;
}

/**
 * Returns an array of core entities and any additional entities defined in plugins.
 */
export async function registerAllEntities(pluginConfig: Partial<IPluginConfig>) {
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
		}
	};
}
