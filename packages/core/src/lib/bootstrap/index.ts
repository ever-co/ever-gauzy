import * as v8 from 'v8';

function logMemoryLimit() {
	const heapStats = v8.getHeapStatistics();
	const heapSizeLimit = heapStats.heap_size_limit;
	console.log(`Heap size limit: ${heapSizeLimit / 1024 / 1024} MB`);
}

logMemoryLimit();

// Note: below code can't be moved to other places because it has to be executed first, before we load any other modules!

import tracer from './tracer';

/**
 * Start tracing using if OTEL is enabled.
 */
export function startTracing(): void {
	if (process.env.OTEL_ENABLED === 'true' && tracer) {
		// Start tracing
		tracer.start();
		console.log('OTEL Tracing started');
	} else {
		console.log('OTEL Tracing not enabled');
	}
}

startTracing(); // Start tracing if OTEL is enabled.

// import * as csurf from 'csurf';
import { ConflictException, INestApplication, Type } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EventSubscriber } from '@mikro-orm/core';
import { useContainer } from 'class-validator';
import * as expressSession from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import * as helmet from 'helmet';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { urlencoded, json } from 'express';
import { EntitySubscriberInterface } from 'typeorm';
import { ApplicationPluginConfig } from '@gauzy/common';
import { getConfig, setConfig, environment as env } from '@gauzy/config';
import { getEntitiesFromPlugins, getPluginConfigurations, getSubscribersFromPlugins } from '@gauzy/plugin';
import { coreEntities } from '../core/entities';
import { coreSubscribers } from '../core/entities/subscribers';
import { registerMikroOrmCustomFields, registerTypeOrmCustomFields } from '../core/entities/custom-entity-fields';
import { AuthGuard } from '../shared/guards';
import { SharedModule } from '../shared/shared.module';
import { AppService } from '../app/app.service';
import { AppModule } from '../app/app.module';

/**
 * Bootstrap the NestJS application, configuring various settings and initializing the server.
 *
 * @param pluginConfig - Optional plugin configuration.
 * @returns A promise that resolves to the initialized NestJS application.
 */
export async function bootstrap(pluginConfig?: Partial<ApplicationPluginConfig>): Promise<INestApplication> {
	console.time('✔ Total Application Startup Time');

	// Pre-bootstrap the application configuration
	const config = await preBootstrapApplicationConfig(pluginConfig);

	// Import the BootstrapModule dynamically
	const { BootstrapModule } = await import('./bootstrap.module');

	// Create the NestJS application
	const app = await NestFactory.create<NestExpressApplication>(BootstrapModule, {
		logger: ['log', 'error', 'warn', 'debug', 'verbose'], // Set logging levels
		bufferLogs: env.isElectron ? false : true // Buffer logs to avoid loss during startup // set to false when is electron
	});

	// Register custom entity fields for Mikro ORM
	await registerMikroOrmCustomFields(config);

	// Enable Express behind proxies (https://expressjs.com/en/guide/behind-proxies.html)
	app.set('trust proxy', true);

	// Starts listening for shutdown hooks
	app.enableShutdownHooks();

	// This will lock all routes and make them accessible by authenticated users only.
	const reflector = app.get(Reflector);
	app.useGlobalGuards(new AuthGuard(reflector));

	// Configure Sentry for error tracking, if applicable
	const { sentry } = env;
	if (sentry && sentry.dsn && config.logger) {
		app.useLogger(config.logger); // Use Sentry logger
	} else {
		// Handle uncaught exceptions and unhandled rejections
		process.on('uncaughtException', handleUncaughtException);
		process.on('unhandledRejection', handleUnhandledRejection);
	}

	// Set JSON and URL-encoded body parsers with a size limit
	app.use(json({ limit: '50mb' }));
	app.use(urlencoded({ extended: true, limit: '50mb' }));

	// Enable CORS with specific settings
	app.enableCors({
		origin: '*',
		credentials: true,
		methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'].join(','),
		allowedHeaders: [
			'Authorization',
			'Language',
			'Tenant-Id',
			'Organization-Id',
			'X-Requested-With',
			'X-Auth-Token',
			'X-HTTP-Method-Override',
			'Content-Type',
			'Content-Language',
			'Accept',
			'Accept-Language',
			'Observe'
		].join(', ')
	});

	// TODO: enable csurf is not good idea because it was deprecated.
	// Maybe review https://github.com/Psifi-Solutions/csrf-csrf as alternative?
	// As explained on the csurf middleware page https://github.com/expressjs/csurf#csurf,
	// the csurf module requires either a session middleware or cookie-parser to be initialized first.
	// app.use(csurf());

	// We use sessions for Passport Auth
	// For production we use RedisStore
	// https://github.com/tj/connect-redis

	// Manage sessions with Redis or in-memory fallback
	let redisWorked = false;
	console.log('REDIS_ENABLED: ', process.env.REDIS_ENABLED);

	if (process.env.REDIS_ENABLED === 'true') {
		try {
			const url =
				process.env.REDIS_URL ||
				(process.env.REDIS_TLS === 'true'
					? `rediss://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
					: `redis://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

			console.log('REDIS_URL: ', url);

			let host, port, username, password;

			const isTls = url.startsWith('rediss://');

			// Removing the protocol part
			let authPart = url.split('://')[1];

			// Check if the URL contains '@' (indicating the presence of username/password)
			if (authPart.includes('@')) {
				// Splitting user:password and host:port
				let [userPass, hostPort] = authPart.split('@');
				[username, password] = userPass.split(':');
				[host, port] = hostPort.split(':');
			} else {
				// If there is no '@', it means there is no username/password
				[host, port] = authPart.split(':');
			}

			port = parseInt(port);

			const redisConnectionOptions = {
				url: url,
				username: username,
				password: password,
				isolationPoolOptions: {
					min: 1,
					max: 100
				},
				socket: {
					tls: isTls,
					host: host,
					port: port,
					passphrase: password,
					rejectUnauthorized: process.env.NODE_ENV === 'production'
				},
				ttl: 60 * 60 * 24 * 7 // 1 week
			};

			const redisClient = createClient(redisConnectionOptions)
				.on('error', (err) => {
					console.log('Redis Session Store Client Error: ', err);
				})
				.on('connect', () => {
					console.log('Redis Session Store Client Connected');
				})
				.on('ready', () => {
					console.log('Redis Session Store Client Ready');
				})
				.on('reconnecting', () => {
					console.log('Redis Session Store Client Reconnecting');
				})
				.on('end', () => {
					console.log('Redis Session Store Client End');
				});

			// connecting to Redis
			await redisClient.connect();

			// ping Redis
			const res = await redisClient.ping();
			console.log('Redis Session Store Client Sessions Ping: ', res);

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
			console.error(error);
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

	// let's use helmet for security in production
	if (env.envName === 'prod') {
		app.use(helmet());
	}

	// Set the global prefix for routes
	const globalPrefix = 'api';
	app.setGlobalPrefix(globalPrefix);

	const service = app.select(AppModule).get(AppService);
	await service.seedDBIfEmpty();

	/**
	 * Dependency injection with class-validator
	 */
	useContainer(app.select(SharedModule), { fallbackOnErrors: true });

	// Start the server
	const { port = 3000, host = '0.0.0.0' } = config.apiConfigOptions;
	console.log(chalk.green(`Configured Host: ${host}`));
	console.log(chalk.green(`Configured Port: ${port}`));

	// Configure Swagger for API documentation
	const options = new DocumentBuilder().setTitle('Gauzy API').setVersion('1.0').addBearerAuth().build();
	const document = SwaggerModule.createDocument(app, options);
	SwaggerModule.setup('swg', app, document);
	console.log(chalk.green(`Swagger UI available at http://${host}:${port}/swg`));

	// Configure Atlassian Connect Express
	// const addon = ac(express());
	// app.use(addon.middleware());

	await app.listen(port, host, () => {
		console.log(`Application is running on http://${host}:${port}`);

		// Note: do not change this prefix because we may use it to detect the success message from the running server!
		const successMessagePrefix = 'Listening at http';

		const message = `${successMessagePrefix}://${host}:${port}/${globalPrefix}`;
		console.log(chalk.magenta(message));

		// Send message to parent process (desktop app)
		if (process.send) {
			process.send(message);
		}

		if (env.demo) {
			service.executeDemoSeed(); // Seed demo data if in demo mode
		}
	});

	return app;
}

/**
 * Handles uncaught exceptions.
 * @param error - The uncaught exception.
 */
function handleUncaughtException(error: Error) {
	console.error('Uncaught Exception Handler in Bootstrap:', error);
	setTimeout(() => {
		process.exit(1);
	}, 3000);
}

/**
 * Handles unhandled rejections.
 * @param reason - The reason for the unhandled rejection.
 * @param promise - The rejected promise.
 */
function handleUnhandledRejection(reason: any, promise: Promise<any>) {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}

/**
 * Registers a plugin configuration, applying pre-bootstrap operations to ensure it's ready for use.
 *
 * @param config - The partial application configuration to be pre-bootstrapped.
 * @returns A promise that resolves to the pre-bootstrapped application configuration.
 */
export async function registerPluginConfig(config: Partial<ApplicationPluginConfig>): Promise<ApplicationPluginConfig> {
	// Apply pre-bootstrap operations and return the updated configuration
	return await preBootstrapApplicationConfig(config);
}

/**
 * Prepares the application configuration before initializing plugins.
 * Configures migration settings, registers entities and subscribers,
 * and applies additional plugin configurations.
 *
 * @param applicationConfig - The initial application configuration.
 * @returns A promise that resolves to the final application configuration after pre-bootstrap operations.
 */
export async function preBootstrapApplicationConfig(applicationConfig: Partial<ApplicationPluginConfig>) {
	if (Object.keys(applicationConfig).length > 0) {
		// Set initial configuration if any properties are provided
		setConfig(applicationConfig);
	}

	// Configure migration settings
	setConfig({
		dbConnectionOptions: {
			...getMigrationsConfig()
		}
	});

	// Log the current database configuration (for debugging or informational purposes)
	console.log(chalk.green(`DB Config: ${JSON.stringify(getConfig().dbConnectionOptions)}`));

	// Register core and plugin entities and subscribers
	const entities = await preBootstrapRegisterEntities(applicationConfig);
	const subscribers = await preBootstrapRegisterSubscribers(applicationConfig);

	// Update configuration with registered entities and subscribers
	setConfig({
		dbConnectionOptions: {
			entities: entities as Array<Type<any>>, // Core and plugin entities
			subscribers: subscribers as Array<Type<EntitySubscriberInterface>> // Core and plugin subscribers
		},
		dbMikroOrmConnectionOptions: {
			entities: entities as Array<Type<any>>, // MikroORM entities
			subscribers: subscribers as Array<EventSubscriber> // MikroORM subscribers
		}
	});

	// Apply additional plugin configurations
	const config = await preBootstrapPluginConfigurations(getConfig());

	// Register custom entity fields for Type ORM
	await registerTypeOrmCustomFields(config);

	// Return the final configuration after all pre-bootstrap operations
	return config;
}

/**
 * Asynchronously applies configurations from plugin configuration functions
 * to the given application configuration, in parallel.
 *
 * @param config - The initial application configuration to be modified.
 * @returns A promise that resolves to the updated application configuration.
 */
async function preBootstrapPluginConfigurations(config: ApplicationPluginConfig): Promise<ApplicationPluginConfig> {
	// Retrieve a list of plugin configuration functions based on the provided config
	const pluginConfigurations = getPluginConfigurations(config.plugins);

	// Iterate over each plugin configuration function
	for await (const pluginConfigurationFn of pluginConfigurations) {
		// Check if the item is a function, and apply it to the current configuration
		if (typeof pluginConfigurationFn === 'function') {
			// Update the config by applying the function and awaiting its result
			config = await pluginConfigurationFn(config);
		}
	}

	// Return the modified configuration
	return config;
}

/**
 * Register entities from core and plugin configurations.
 * Ensures no conflicts between core entities and plugin entities.
 *
 * @param config - Plugin configuration containing plugin entities.
 * @returns A promise that resolves to an array of registered entity types.
 */
async function preBootstrapRegisterEntities(config: Partial<ApplicationPluginConfig>): Promise<Array<Type<any>>> {
	try {
		// Retrieve the list of core entities
		const coreEntitiesList = coreEntities as Array<Type<any>>;

		// Get the list of entities from the plugin configuration
		const pluginEntitiesList = getEntitiesFromPlugins(config.plugins);

		// Check for conflicts and register plugin entities
		for (const pluginEntity of pluginEntitiesList) {
			const entityName = pluginEntity.name;

			// If a core entity has the same name as a plugin entity, throw a conflict exception
			if (coreEntitiesList.some((entity) => entity.name === entityName)) {
				throw new ConflictException({
					message: `Error: ${entityName} conflicts with default entities.`
				});
			}

			// If no conflict, add the plugin entity to the core entity list
			coreEntitiesList.push(pluginEntity);
		}

		// Return the updated list of registered entities
		return coreEntitiesList;
	} catch (error) {
		// Log any errors and re-throw for further handling
		console.error('Error registering entities:', error);
		throw error;
	}
}

/**
 * Registers subscriber entities from core and plugin configurations, ensuring no conflicts.
 *
 * @param config - The application configuration that might contain plugin subscribers.
 * @returns A promise that resolves to an array of registered subscriber entity types.
 */
async function preBootstrapRegisterSubscribers(
	config: Partial<ApplicationPluginConfig>
): Promise<Array<Type<EntitySubscriberInterface>>> {
	try {
		// List of core subscribers
		const subscribers = coreSubscribers as Array<Type<EntitySubscriberInterface>>;

		// Get plugin subscribers from the application configuration
		const pluginSubscribersList = getSubscribersFromPlugins(config.plugins);

		// Check for conflicts and add new plugin subscribers
		for (const pluginSubscriber of pluginSubscribersList) {
			const subscriberName = pluginSubscriber.name;

			// Check for name conflicts with core subscribers
			if (subscribers.some((subscriber) => subscriber.name === subscriberName)) {
				// Throw an exception if there's a conflict
				throw new ConflictException({
					message: `Error: ${subscriberName} conflicts with default subscribers.`
				});
			} else {
				// Add the new plugin subscriber to the list if no conflict
				subscribers.push(pluginSubscriber);
			}
		}

		// Return the updated list of subscribers
		return subscribers;
	} catch (error) {
		// Handle errors and log to console
		console.error('Error registering subscribers:', error.message);
	}
}

/**
 * Gets the migrations directory and CLI migration paths.
 *
 * @returns An object containing paths for migrations and CLI migrations directory.
 */
export function getMigrationsConfig() {
	// Determine if running from dist or source
	const isDist = __dirname.includes('dist');
	const isElectron = !!env.isElectron; // check if electron

	console.log('Migration isDist: ->', isDist);
	console.log('Migration isElectron: ->', isElectron);
	console.log('Migration process.cwd(): ->', process.cwd());
	console.log('Migration __dirname: ->', __dirname);

	// Base migrations directory
	const migrationsDir = path.resolve(
		__dirname,
		isElectron
			? './../database/migrations/*.js' // Only .ts if Electron
			: './../database/migrations/*{.ts,.js}' // Otherwise .ts or .js
	);
	console.log('Migration migrationsDir: ->', migrationsDir);

	if (!fs.existsSync(path.dirname(migrationsDir))) {
		chalk.red(console.log(`Migrations directory not found: ${migrationsDir}`));
	}

	// CLI Migrations directory path
	const cliMigrationsDir = path.resolve(__dirname, './../database/migrations'); // Adjusted for src structure
	console.log('Migration cliMigrationsDir: ->', cliMigrationsDir);

	if (!fs.existsSync(path.dirname(cliMigrationsDir))) {
		chalk.red(console.log(`CLI migrations directory not found: ${cliMigrationsDir}`));
	}

	// Return the migration paths
	return {
		migrations: [migrationsDir],
		cli: {
			migrationsDir: cliMigrationsDir
		}
	};
}
