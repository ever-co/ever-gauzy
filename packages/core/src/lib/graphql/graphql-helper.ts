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
import { subscriptionTransportOptions } from './subscriptions/subscription-transport';

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
	return {
		driver: ApolloDriver,
		path: `/${options.path}`,
		typeDefs: await createTypeDefs(configService, options, typesLoader),
		playground: options.playground || false,
		debug: options.debug || false,
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
				'If-Match'
			].join(', ')
		},
		include: [options.resolverModule],
		// The context is the request scope: every resolver in one operation shares it, and the loader
		// registry inside it is what makes a nested relation one query per relation rather than one
		// per parent row.
		context: ({ req }) => createGraphqlRequestContext({ req }),
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
