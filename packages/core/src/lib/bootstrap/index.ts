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
import { EventSubscriber, MikroORM, RequestContext } from '@mikro-orm/core';
import { useContainer } from 'class-validator';
import * as helmet from 'helmet';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { urlencoded, json } from 'express';
import { EntitySubscriberInterface } from 'typeorm';
import { ApplicationPluginConfig } from '@gauzy/common';
import { getConfig, defineConfig, environment } from '@gauzy/config';
import { getEntitiesFromPlugins, getPluginConfigurations, getSubscribersFromPlugins } from '@gauzy/plugin';
import { MultiORMEnum, getORMType } from '../core/utils';
import { coreEntities } from '../core/entities';
import { coreSubscribers } from '../core/entities/subscribers';
import { registerMikroOrmCustomFields, registerTypeOrmCustomFields } from '../core/entities/custom-entity-fields';
import { AuthGuard } from '../shared/guards';
import { ValidatorModule } from '../shared/validators/validator.module';
import { AppService } from '../app/app.service';
import { AppModule } from '../app/app.module';
import { configureRedisSession } from './redis-store';
import { setupSwagger } from './swagger';

/**
 * Bootstrap the NestJS application, configuring various settings and initializing the server.
 *
 * @param pluginConfig - Optional plugin configuration.
 * @returns A promise that resolves to the initialized NestJS application.
 */
export async function bootstrap(pluginConfig?: Partial<ApplicationPluginConfig>): Promise<INestApplication> {
	console.time(chalk.yellow('✔ Total Application Bootstrap Time'));

	// Pre-bootstrap the application configuration
	const config = await preBootstrapApplicationConfig(pluginConfig);

	// Import the BootstrapModule dynamically
	console.time(chalk.yellow('✔ Import BootstrapModule Time'));
	const { BootstrapModule } = await import('./bootstrap.module');
	console.timeEnd(chalk.yellow('✔ Import BootstrapModule Time'));

	// Create the NestJS application
	console.time(chalk.yellow('✔ Create NestJS Application Time'));
	const app = await NestFactory.create<NestExpressApplication>(BootstrapModule, {
		logger: ['log', 'error', 'warn', 'debug', 'verbose'], // Set logging levels
		bufferLogs: environment.isElectron ? false : true // Buffer logs to avoid loss during startup // set to false when is electron
	});
	console.timeEnd(chalk.yellow('✔ Create NestJS Application Time'));

	// Set query parser to extended (In Express v5, query parameters are no longer parsed using the qs library by default.)
	app.set('query parser', 'extended');

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
	const { sentry } = environment;
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

	// Configure Redis or in-memory sessions
	await configureRedisSession(app);

	// let's use helmet for security in production
	if (environment.envName === 'prod') {
		app.use(helmet());
	}

	// Set the global prefix for routes
	const globalPrefix = 'api';
	app.setGlobalPrefix(globalPrefix);

	// Get the AppService
	const appService = app.select(AppModule).get(AppService);

	// Seed DB if empty, using ORM-specific behavior
	await seedDatabaseIfEmpty(app, appService);

	/**
	 * Dependency injection with class-validator
	 */
	useContainer(app.select(ValidatorModule), { fallbackOnErrors: true });

	// Start the server
	const { port = 3000, host = '0.0.0.0' } = config.apiConfigOptions;
	console.log(chalk.green(`Configured Host: ${host}`));
	console.log(chalk.green(`Configured Port: ${port}`));

	// Configure Swagger for API documentation
	const swaggerPath = await setupSwagger(app);
	console.log(chalk.green(`Swagger documentation available at http://${host}:${port}/${swaggerPath}`));

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

		if (environment.demo) {
			console.log(chalk.yellow('Application is running in DEMO mode'));

			// Run demo seed after the HTTP server starts
			seedDemoIfEmpty(app, appService)
				.then(() => {
					console.log(chalk.green('Demo environment seeded successfully'));
				})
				.catch((error) => {
					console.log(chalk.red('Error seeding demo environment:'), error);
				});
		}
	});

	console.timeEnd(chalk.yellow('✔ Total Application Bootstrap Time'));

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
 * Run demo seed after the HTTP server starts.
 * When MikroORM is selected, wrap in a RequestContext so repositories use a scoped EntityManager.
 */
async function seedDemoIfEmpty(app: INestApplication, appService: AppService): Promise<void> {
	console.log('Seeding demo data if database is empty...', environment.demo);

	// Get the ORM type
	const ormType = getORMType();

	// Seed DB if empty based on the ORM type
	if (ormType === MultiORMEnum.MikroORM) {
		// Get the MikroORM instance
		const mikroOrm = app.get(MikroORM);

		// Seed DB if empty inside a MikroORM RequestContext
		await RequestContext.create(mikroOrm.em, async () => {
			await appService.seedDemoIfEmpty();
		});
	} else {
		// Seed DB if empty for TypeORM
		await appService.seedDemoIfEmpty();
	}
}

/**
 * Seed DB if empty.
 * - When MikroORM is selected (DB_ORM=mikro-orm), run seeding inside a RequestContext
 *   so repositories use a scoped EntityManager instead of the global instance.
 * - Otherwise (TypeORM), keep the existing behavior.
 */
async function seedDatabaseIfEmpty(app: INestApplication, appService: AppService): Promise<void> {
	console.log('Seeding database if empty...', environment.demo);

	// Get the ORM type
	const ormType = getORMType();

	// Seed DB if empty based on the ORM type
	if (ormType === MultiORMEnum.MikroORM) {
		// Get the MikroORM instance
		const mikroOrm = app.get(MikroORM);

		// Seed DB if empty inside a MikroORM RequestContext
		await RequestContext.create(mikroOrm.em, async () => {
			await appService.seedDBIfEmpty();
		});
	} else {
		// Seed DB if empty for TypeORM
		await appService.seedDBIfEmpty();
	}
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
	console.time(chalk.yellow('✔ Pre Bootstrap Application Config Time'));

	if (Object.keys(applicationConfig).length > 0) {
		// Set initial configuration if any properties are provided
		await defineConfig(applicationConfig);
	}

	// Register core and plugin entities and subscribers in parallel
	const [entities, subscribers] = await Promise.all([
		preBootstrapRegisterEntities(applicationConfig),
		preBootstrapRegisterSubscribers(applicationConfig)
	]);

	// Update configuration with migrations, registered entities and subscribers
	await defineConfig({
		dbConnectionOptions: {
			...getMigrationsConfig(),
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

	// Log the current database configuration (for debugging or informational purposes)
	logDBConfig(config);

	// Register custom entity fields for Type ORM
	await registerTypeOrmCustomFields(config);

	console.timeEnd(chalk.yellow('✔ Pre Bootstrap Application Config Time'));

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
	console.time(chalk.yellow('✔ Pre Bootstrap Plugin Configurations Time'));

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

	console.timeEnd(chalk.yellow('✔ Pre Bootstrap Plugin Configurations Time'));

	// Return the modified configuration
	return config;
}

/**
 * Register entities from core and plugin configurations.
 * Ensures no conflicts between core entities and plugin entities.
 *
 * Uses a Set for O(1) conflict detection instead of Array.some() which is O(n).
 *
 * @param config - Plugin configuration containing plugin entities.
 * @returns A promise that resolves to an array of registered entity types.
 * @throws ConflictException if a plugin entity conflicts with a core entity.
 */
export async function preBootstrapRegisterEntities(
	config: Partial<ApplicationPluginConfig>
): Promise<Array<Type<any>>> {
	try {
		console.time(chalk.yellow('✔ Pre Bootstrap Register Entities Time'));

		// Retrieve core entities and plugin entities
		const coreEntitiesList = [...coreEntities] as Array<Type<any>>;
		const pluginEntitiesList = getEntitiesFromPlugins(config.plugins);

		// Build a Set of core entity names for O(1) conflict detection
		const coreEntityNames = new Set(coreEntitiesList.map((entity) => entity.name));

		// Check for conflicts - O(n) instead of O(n²) with Array.some()
		for (const pluginEntity of pluginEntitiesList) {
			if (coreEntityNames.has(pluginEntity.name)) {
				throw new ConflictException({
					message: `Entity conflict: ${pluginEntity.name} conflicts with core entities.`
				});
			}
		}

		// Merge entities - spread is more efficient than repeated push
		const registeredEntities = [...coreEntitiesList, ...pluginEntitiesList];

		console.timeEnd(chalk.yellow('✔ Pre Bootstrap Register Entities Time'));
		return registeredEntities;
	} catch (error) {
		console.log(chalk.red('Error registering entities:'), error);
		throw error;
	}
}

/**
 * Registers subscriber entities from core and plugin configurations, ensuring no conflicts.
 *
 * Uses a Set for O(1) conflict detection instead of Array.some() which is O(n).
 *
 * @param config - The application configuration that might contain plugin subscribers.
 * @returns A promise that resolves to an array of registered subscriber entity types.
 * @throws ConflictException if a plugin subscriber conflicts with a core subscriber.
 */
async function preBootstrapRegisterSubscribers(
	config: Partial<ApplicationPluginConfig>
): Promise<Array<Type<EntitySubscriberInterface>>> {
	try {
		console.time(chalk.yellow('✔ Pre Bootstrap Register Subscribers Time'));

		// List of core subscribers
		const coreSubscribersList = [...coreSubscribers] as Array<Type<EntitySubscriberInterface>>;

		// Get plugin subscribers from the application configuration
		const pluginSubscribersList = getSubscribersFromPlugins(config.plugins);

		// Build a Set of core subscriber names for O(1) conflict detection
		const coreSubscriberNames = new Set(coreSubscribersList.map((subscriber) => subscriber.name));

		// Check for conflicts - O(n) instead of O(n²) with Array.some()
		for (const pluginSubscriber of pluginSubscribersList) {
			if (coreSubscriberNames.has(pluginSubscriber.name)) {
				throw new ConflictException({
					message: `Error: ${pluginSubscriber.name} conflicts with default subscribers.`
				});
			}
		}

		// Merge subscribers - spread is more efficient than repeated push
		const registeredSubscribers = [...coreSubscribersList, ...pluginSubscribersList];

		console.timeEnd(chalk.yellow('✔ Pre Bootstrap Register Subscribers Time'));

		// Return the merged list of subscribers
		return registeredSubscribers;
	} catch (error) {
		console.log(chalk.red('Error registering subscribers:'), error);
		throw error;
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
	const isElectron = !!environment.isElectron; // check if electron

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

/**
 * Logs the current database configuration for debugging or informational purposes.
 * Excludes entities and subscribers arrays to keep the output readable.
 */
function logDBConfig(config: ApplicationPluginConfig): void {
	// Destructure to exclude entities and subscribers from the log output
	const { entities, subscribers, ...dbConfigWithoutEntities } = config.dbConnectionOptions;
	console.log(chalk.green(`DB Config: ${JSON.stringify(dbConfigWithoutEntities)}`));
}
