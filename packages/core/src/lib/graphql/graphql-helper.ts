import { GqlModuleOptions, GraphQLTypesLoader } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GraphQLError, buildSchema, extendSchema, printSchema } from 'graphql';
import * as path from 'path';
import { GraphQLApiConfigurationOptions } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { getPluginExtensions, isDynamicModule, reflectDynamicModuleMetadata } from '@gauzy/plugin';
import { isNotEmpty } from '@gauzy/utils';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { RequestContext } from '../core/context/request-context';
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

	// The modules Apollo scans for resolvers.
	//
	// A resolver is an ordinary provider, and Apollo finds one by scanning a module for it — so a
	// module that declares resolvers but is never scanned contributes nothing, silently: the schema
	// still carries every field the plugin's SDL declared, and each one resolves to null with no error
	// anywhere. Each plugin's own module already declares its resolvers as providers, which is what
	// lets them inject the same services the REST controllers do, so listing those modules here is what
	// binds them.
	//
	// The list is built from the configuration the application is *running* with — this helper is
	// evaluated while the container is being assembled, after the configuration has been installed —
	// rather than from the configuration's defaults, which is what the resolver host module itself sees
	// when its decorator runs at import time. An installation that configures plugins therefore gets
	// their resolvers, and one that does not gets none, both without a second code path.
	const pluginResolverModules = configService.plugins.flatMap((plugin) => {
		const identity = isDynamicModule(plugin) ? plugin.module : plugin;
		return reflectDynamicModuleMetadata(identity).imports as Function[];
	});

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
		// Every plugin module as well as the host, so the resolvers those modules declare are found —
		// and the domains the host cannot import, which declare their resolvers in their own module and
		// are named by the configuration rather than by the host's own import list.
		include: [options.resolverModule, ...(options.additionalResolverModules ?? []), ...pluginResolverModules],
		// No stack, in any environment. The server's own default is to attach `extensions.stacktrace`
		// whenever the surface is not in production, which is a second, unversioned envelope beside the
		// platform's: a client that switches on `extensions.code` finds a stack where it expected a
		// status, and an internal failure's message and frames — which the filter deliberately scrubs
		// and logs instead — reach the caller anyway. The `traceId` the envelope carries is what joins
		// a report to those logs, so nothing is lost by refusing the shortcut.
		//
		// The name is the installed server's own: it is `includeStacktraceInErrorResponses` and not the
		// older `includeStacktrace`, and an option the server does not know is silently ignored rather
		// than refused — which is exactly how a leak survives a fix that looks correct.
		includeStacktraceInErrorResponses: false,
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
		//
		// 🛑 The **second** argument is the one the filter must be given. Apollo calls this as
		// `formatError(enrichedError, originalError)`: the first is a copy it has already normalised —
		// a plain `{ message, locations, path, extensions }` — and the platform's own failure carries
		// its status, code and details on the exception that was actually thrown, which is the second.
		// Handing the first one over made `toSafeHttpException` find no status at all, so every
		// resolver failure answered `INTERNAL_ERROR`/`500` with the details dropped — a not-found read
		// that REST reports as `RESOURCE_NOT_FOUND`/`404` — and a mistake in the document itself was
		// reported as a server fault instead of a bad request.
		formatError: (error, originalError) => formatGraphqlError(error, originalError),
		// Subscriptions ride the same path and the same authorisation. The key is added only when the
		// transport package is installed, so an installation without it boots as it does today.
		...subscriptionTransportOptions()
	} as GqlModuleOptions;
}

/**
 * Renders one failure into the platform's error envelope.
 *
 * Three kinds of failure reach this function, and each is answered by a different rule:
 *
 * 1. **A resolver failure that is an HTTP failure** — an `HttpException` or one of the platform's
 *    `ApiException`s, which is what every service throws. The filter is the only code that knows the
 *    code/status/details mapping, so it is handed the exception itself and its answer is the reply.
 * 2. **A failure graphql-js raised before any resolver ran** — an unknown field, a malformed
 *    document, a variable of the wrong type. Nothing threw it, no HTTP meaning exists for it, and the
 *    request is what is wrong: it is reported as `VALIDATION_FAILED` with a `400`. The message is kept
 *    verbatim, because it names the field or the position the caller has to fix.
 * 3. **Anything else the resolver threw** — a raw `Error`, a driver failure. That is the server's
 *    problem, and the filter reports it as it does over REST: a classified 5xx, logged here, with no
 *    stack and no driver text sent to the caller.
 *
 * A `GraphQLError` that already carries a `code` and a `status` in its extensions is passed through
 * untouched. That is not a courtesy: a resolver may raise one deliberately — the field gates do, and
 * so does the cost limiter — and re-classifying it would answer a permission denial with a validation
 * failure, which is a different statement about a different thing.
 *
 * @param error The enriched error Apollo is about to send.
 * @param originalError The error as it was thrown, which is where the platform's own envelope lives.
 * @returns The error the response's `errors` array carries.
 */
function formatGraphqlError(error: GraphQLError, originalError?: unknown): GraphQLError {
	const filter = new GraphqlExceptionFilter();

	/*
	 * The exception is unwrapped before anything is decided about it. The driver's transport turns a
	 * resolver's failure into a `GraphQLError` and keeps the exception on that error's `originalError`,
	 * so what arrives here is usually a wrapper and the platform's status, code and details are one —
	 * sometimes two — links down the chain. Walking it is what makes a not-found read answer
	 * `RESOURCE_NOT_FOUND`/`404` like its REST route instead of a validation failure.
	 */
	const thrown = unwrapThrownError(originalError ?? error);

	// A resolver failure the platform itself raised: the filter is the only code that knows the
	// code/status/details mapping, and it must see the exception rather than any copy of it.
	if (thrown instanceof HttpException) {
		return filter.catch(thrown);
	}

	if (thrown instanceof GraphQLError) {
		const extensions = (thrown.extensions ?? {}) as Record<string, unknown>;

		// A deliberate GraphQLError: it has already stated its envelope, and re-classifying it would
		// answer a field gate's permission denial with a validation failure. The enriched error is
		// returned, so the caller keeps the path and the locations the driver resolved.
		if (typeof extensions.code === 'string' && typeof extensions.status === 'number') {
			return error;
		}

		// A failure graphql-js raised on the document, which never reached a resolver: the request is
		// what is wrong, and the message names the field or the position the caller has to fix.
		const traceId = RequestContext.currentTraceId();

		return new GraphQLError(error.message, {
			nodes: error.nodes,
			source: error.source,
			positions: error.positions,
			path: error.path,
			originalError: error.originalError,
			extensions: {
				...error.extensions,
				code: ApiErrorCode.VALIDATION_FAILED,
				status: HttpStatus.BAD_REQUEST,
				...(traceId ? { traceId } : {})
			}
		});
	}

	// Anything else the resolver threw — a raw `Error`, a driver failure: the server's problem, and the
	// filter reports it exactly as the REST path does, logging the original and telling the caller only
	// that it failed.
	return filter.catch(originalError ?? error);
}

/**
 * Walks a thrown value's `originalError` chain to the error that was actually raised.
 *
 * The transport wraps what a resolver threw, and the wrapper is what reaches the error formatter: a
 * `GraphQLError` carrying the exception on `originalError`, sometimes through more than one link. The
 * walk stops at the first `HttpException` — which is what every service in the platform throws, either
 * directly or as an `ApiException` — and otherwise returns the deepest error it found, so a plain
 * `Error` is still classified by the filter rather than by its wrapper.
 *
 * The depth bound is deliberate: a malformed chain must not become an infinite loop inside the error
 * path, which is the one place that cannot fail.
 *
 * @param error The error as it arrived.
 * @returns The error that was raised, or the value given when the chain holds neither.
 */
function unwrapThrownError(error: unknown): unknown {
	let current: unknown = error;

	for (let depth = 0; depth < 8 && current; depth++) {
		if (current instanceof HttpException) {
			return current;
		}

		const next = (current as { originalError?: unknown }).originalError;

		if (!next || next === current) {
			break;
		}

		current = next;
	}

	return current;
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
