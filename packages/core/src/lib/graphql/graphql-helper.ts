import { GqlModuleOptions, GraphQLTypesLoader } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { buildSchema, extendSchema, printSchema } from 'graphql';
import * as path from 'path';
import { GraphQLApiConfigurationOptions } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { getPluginExtensions } from '@gauzy/plugin';
import { isNotEmpty } from '@gauzy/utils';
import { assertComposition, assertExtendable } from './graphql-composition';
import { createGraphqlRequestContext } from './graphql-context';
import { createBatchLimitPlugin, createGraphqlLimitRules } from './graphql-limits';
import { mergeLimitSettings, resolveGraphqlPolicy } from './graphql-policy';
import { subscriptionTransportOptions } from './subscriptions/subscription-transport';
import { GraphqlExceptionFilter } from './errors/graphql-exception.filter';

/**
 * Creates and configures the GraphQL module options for Apollo Server in a NestJS application.
 *
 * - Uses the `ApolloDriver` as the GraphQL driver.
 * - Dynamically loads type definitions (`typeDefs`) using the `typesLoader`.
 * - Configures playground and debug mode based on the provided options.
 * - Sets up CORS policies, including allowed methods and headers.
 * - Includes the specified resolver module.
 *
 * @param {ConfigService} configService - The NestJS configuration service for retrieving environment variables.
 * @param {GraphQLTypesLoader} typesLoader - A utility to dynamically load GraphQL type definitions.
 * @param {GraphQLApiConfigurationOptions} options - Configuration options for the GraphQL API.
 * @returns {Promise<GqlModuleOptions>} A promise that resolves to GraphQL module options.
 */
export async function createGraphqlModuleOptions(
	configService: ConfigService,
	typesLoader: GraphQLTypesLoader,
	options: GraphQLApiConfigurationOptions
): Promise<GqlModuleOptions> {
	// What this deployment publishes and accepts, resolved once per boot. The environment overrides
	// the configuration and the development behaviour is the default, so a workstation keeps the
	// playground it had while a production deployment stops serving one unless it asks for it.
	const policy = resolveGraphqlPolicy(process.env, {
		playground: options.playground,
		debug: options.debug,
		introspection: options.introspection,
		limits: mergeLimitSettings(configService.graphqlConfigOptions, options.limits)
	});

	// Reported once, at boot, next to the values that were actually applied: a deployment that set a
	// ceiling to something unusable needs to see that in the log, and it must not fail the boot.
	for (const warning of policy.warnings) {
		console.warn(`[GraphQL] ${warning}`);
	}

	// The deployment's own attach point. Until it was read here, `apolloServerPlugins` was declared
	// on the configuration, defaulted to an empty array in all three shipped configurations and
	// passed to nothing, so a plugin configured there had no effect whatsoever.
	const apolloServerPlugins =
		options.apolloServerPlugins ?? configService.graphqlConfigOptions?.apolloServerPlugins ?? [];

	return {
		driver: ApolloDriver,
		path: `/${options.path}`,
		typeDefs: await createTypeDefs(configService, options, typesLoader),
		playground: policy.playground,
		debug: policy.debug,
		plugins: [
			...apolloServerPlugins,
			// The platform's own plugin, so the batch ceiling holds in a deployment that configures
			// no plugin of its own — the deployment that forgets to attach one is the one that needs
			// the ceiling most.
			createBatchLimitPlugin(policy.maxBatchSize)
		],
		// Depth, cost, aliases and introspection ride validation rules rather than the plugin array,
		// so they hold even when `apolloServerPlugins` is empty.
		validationRules: createGraphqlLimitRules(policy),
		// Introspection is a policy, not a leftover. Apollo Server 5 has no `introspection` flag of
		// its own any more, which is why the refusal is a rule above: it is what carries the
		// catalogued code instead of a generic validation error.
		persistedQueries: policy.persistedQueries ? {} : false,
		cors: {
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
				'Observe',
				// A machine caller authenticates with a key pair rather than a bearer token, and a
				// caller that works on behalf of one sales surface states which. Both are needed
				// here as well as on the REST surface, or a browser client cannot preflight.
				'X-APP-ID',
				'X-API-KEY',
				'X-Channel-Id',
				// Retry-safe writes and conditional updates.
				'Idempotency-Key',
				'If-Match',
				// A conditional read states the version it already has.
				'If-None-Match'
			].join(', ')
		},
		include: [options.resolverModule],
		// The context is the request scope: every resolver in one operation shares it, and the loader
		// registry inside it is what makes a nested relation one query per relation rather than one
		// per parent row.
		context: ({ req }) => createGraphqlRequestContext({ req }),
		// The error contract. The platform's global filters render HTTP replies, so they step aside
		// for a context that has no HTTP response and let the exception reach graphql-js; this is
		// where it is given the shape the contract declares — the same stable `code`, the status the
		// REST route for the same operation would have answered, the structured `details` and the
		// `traceId` that joins a report to the logs. Without it the response would carry graphql-js's
		// own formatting and a caller switching on `extensions.code` would need a second table for
		// the GraphQL surface.
		formatError: (error) => new GraphqlExceptionFilter().catch(error),
		// Subscriptions ride the same path and the same authorisation. The key is added only when the
		// transport package is installed, so an installation without it boots as it does today.
		...subscriptionTransportOptions()
	} as GqlModuleOptions;
}

/**
 * Generates and returns the GraphQL type definitions (typeDefs) by:
 * - Normalizing file paths for cross-platform compatibility.
 * - Merging type definitions from the provided paths.
 * - Building the initial GraphQL schema.
 * - Extending the schema with additional plugin extensions if available.
 * - Printing the final schema as a string.
 *
 * @param {ConfigService} configService - The NestJS configuration service for accessing environment variables and plugins.
 * @param {GraphQLApiConfigurationOptions} options - The configuration options for GraphQL API, including type paths.
 * @param {GraphQLTypesLoader} typesLoader - The utility responsible for loading and merging GraphQL type definitions.
 * @returns {Promise<string>} A promise resolving to the final GraphQL schema as a string.
 */
async function createTypeDefs(
	configService: ConfigService,
	options: GraphQLApiConfigurationOptions,
	typesLoader: GraphQLTypesLoader
): Promise<string> {
	// Normalize type paths to ensure compatibility across different OS file systems
	const normalizedPaths = options.typePaths.map((p) => p.split(path.sep).join('/'));

	// Load and merge type definitions from the given paths
	const typeDefs = await typesLoader.mergeTypesByPaths(normalizedPaths);

	// Build the GraphQL schema from the merged type definitions
	let schema = buildSchema(typeDefs);

	// Extend the schema using plugin extensions (if available)
	getPluginExtensions(configService.plugins)
		.map((extension) => (typeof extension.schema === 'function' ? extension.schema() : extension.schema))
		.filter(isNotEmpty)
		.forEach((documentNode) => {
			// A plugin may add types and root fields and may never redefine one. Checking before the
			// extension is applied is what turns a schema-builder error into a message naming the
			// contribution that caused it.
			assertExtendable(schema, documentNode);
			schema = extendSchema(schema, documentNode);
		});

	// The composition pass runs over the assembled schema, before it is printed for the driver: a
	// redeclared kernel type, a root field two sources both claim, a reserved name or a deprecation
	// with no reason fails the boot here, with the type or the field named, rather than at the first
	// request that happens to select it. In a test run it reports instead, because the assertion
	// itself is what is under test there.
	assertComposition(schema, { reportOnly: process.env.NODE_ENV === 'test' });

	// Convert the final schema into a printable string format
	return printSchema(schema);
}
