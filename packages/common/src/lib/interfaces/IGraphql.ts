import { Type } from '@nestjs/common';
import { DocumentNode } from 'graphql';
import { ApolloServerPlugin } from '@apollo/server';

/**
 * The ceilings a GraphQL deployment applies to a query before it is executed.
 *
 * Each ceiling is optional and each has a default, so a deployment that states none gets the
 * platform's own values and a deployment that raises one raises only that one.
 */
export interface GraphQLQueryLimitOptions {
	/** Maximum selection-set depth of one operation. */
	maxDepth?: number;
	/** Maximum weighted cost of one operation. */
	maxComplexity?: number;
	/** Maximum number of aliased fields in one operation. */
	maxAliases?: number;
	/** Maximum number of operations in one HTTP request. */
	maxBatchSize?: number;
}

/**
 * Configuration options for a GraphQL API in NestJS.
 */
export interface GraphQLApiConfigurationOptions {
	/**
	 * An array of file paths or glob patterns that specify the GraphQL schema types.
	 */
	typePaths: string[];

	/**
	 * The path where the GraphQL API will be accessible.
	 */
	path: string;

	/**
	 * A boolean indicating whether debugging should be enabled for the GraphQL API.
	 */
	debug: boolean;

	/**
	 * A boolean indicating whether the GraphQL Playground should be enabled.
	 */
	playground: boolean | any;

	/**
	 * Whether the deployment publishes its schema to clients. Defaults to the playground policy,
	 * and is overridable through the environment.
	 */
	introspection?: boolean;

	/**
	 * Apollo Server plugins this deployment installs. The platform's own limits are always present
	 * alongside them; this is the deployment's attach point, not the only one.
	 */
	apolloServerPlugins?: ApolloServerPlugin[];

	/**
	 * The ceilings this deployment applies to a query.
	 */
	limits?: GraphQLQueryLimitOptions;

	/**
	 * The module containing resolvers for the GraphQL API.
	 */
	resolverModule: Function;

	/**
	 * Further modules Apollo scans for resolvers, beside `resolverModule` and the configured plugins.
	 *
	 * A module that declares a resolver and is never scanned contributes nothing, silently: the schema
	 * still carries every field its SDL declares and each one answers null with no error anywhere. The
	 * host module covers the resolvers the platform lists itself; this is for a domain whose module
	 * cannot be imported *by* the host — a domain already inside a module cycle of its own, where
	 * adding the host as a participant fails the boot — so the domain declares its resolvers in its own
	 * module, beside the services they call, and names that module here instead.
	 */
	additionalResolverModules?: Function[];
}

/**
 * Configuration options for extensions provided by an API in NestJS.
 */
export interface ExtensionConfigurationOptions {
	/**
	 * The GraphQL schema or a function returning the schema.
	 */
	schema?: DocumentNode | (() => DocumentNode);

	/**
	 * An array of resolver classes or a function returning an array of resolver classes.
	 */
	resolvers?: Array<Type<any>> | (() => Array<Type<any>>);
}
